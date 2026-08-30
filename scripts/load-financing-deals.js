/**
 * Turn the AI-financing research table into a seed file.
 *
 *     node scripts/load-financing-deals.js <report.md>             # check, report
 *     node scripts/load-financing-deals.js <report.md> --write     # write the seed
 *     node scripts/load-financing-deals.js <report.md> --offline   # use cached URL statuses
 *
 * WHAT THIS IS FOR
 *
 * A deep-research agent produced 33 rows of pipe-delimited deal data. That
 * table is a PROPOSAL, not data. This script is the gate between the two:
 * it parses the block, applies the editorial decisions a person has written
 * down in docs/financing/decisions.json, checks every claim it can check
 * mechanically, refuses anything that fails, and emits SQL for what is left.
 *
 * It follows load-report-figures.js deliberately, including the part that
 * matters most: a row it cannot place REFUSES rather than guessing, and the
 * refusal is printed with a reason rather than swallowed. The output is a seed
 * file — reviewable in a diff, committed, applied by the same `db:seed`
 * everything else goes through — not rows appearing in a live table because a
 * script ran.
 *
 * EVERY JUDGEMENT LIVES IN decisions.json, NOT HERE
 *
 * Which entity a name resolves to, which `event_kind` a free-text deal type
 * maps onto, which rows are rejected and why: all of it is declared by a person
 * in a committed JSON file. This script only applies and checks. A row with no
 * declaration is REPORTED AND SKIPPED, never guessed at and never silently
 * dropped — an undeclared row is work waiting for a decision, and making that
 * visible is the script's job.
 *
 * THE FIVE THINGS IT CHECKS THAT A SCHEMA CANNOT
 *
 *   1. THE SOURCE URL RESOLVES. The schema this feeds opens with "no event
 *      exists without a source". Four of these 33 URLs were truncated mid-slug
 *      and dead. Fifteen lines of HEAD request is the highest-value check here.
 *   2. THE AMOUNT PARSES. Figures arrive as `13000000000[web:59]`. A row whose
 *      amount will not parse is REJECTED, never silently nulled — silent
 *      nulling is how a $13bn deal becomes a blank.
 *   3. DIRECTION IS NORMALISED, AND EVERY SWAP IS PRINTED. `from_entity_id`
 *      means the payer. A `b_to_a` row has its parties swapped, loudly, because
 *      a silent swap inverts the story a financing diagram tells.
 *   4. CONSORTIA RESOLVE BY RULE, AND THE RULE FIRED IS PRINTED. See
 *      migration 0020 section 1.
 *   5. NO TWO ROWS COLLIDE ON dedup_hash. The hash grain is deliberately
 *      coarse; a collision means two rows are claiming to be the same deal and
 *      a person has to say which.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';

import { buildEventDedupHash } from '../src/server/repositories/events.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const source = process.argv[2];
const write = process.argv.includes('--write');
const offline = process.argv.includes('--offline');

if (!source) {
  console.error('usage: node scripts/load-financing-deals.js <report.md> [--write] [--offline]');
  process.exit(2);
}

const DECISIONS = new URL('../docs/financing/decisions.json', import.meta.url);
const PARSED = new URL('../docs/financing/deals.json', import.meta.url);
const URL_CACHE = new URL('../docs/financing/url-status.json', import.meta.url);
const SEED = new URL('../db/seeds/027_financing_events.sql', import.meta.url);

/** Postgres literal. Doubling the quote is the whole of it — no interpolation. */
function sql(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const num = (value) => (value === null || value === undefined ? 'NULL' : String(value));

// ---------------------------------------------------------------------------
// 1. Parse the pipe-delimited block.
// ---------------------------------------------------------------------------

/**
 * The block is fenced and sits under the Layer 2 heading. Anchoring on the
 * heading rather than "the first fenced block" means an earlier code sample in
 * the document cannot silently become the dataset.
 */
function extractTable(markdown) {
  const heading = markdown.indexOf('## Layer 2');
  if (heading === -1) throw new Error('no "## Layer 2" heading — is this the right document?');

  const open = markdown.indexOf('```', heading);
  const close = markdown.indexOf('```', open + 3);
  if (open === -1 || close === -1) throw new Error('no fenced block after the Layer 2 heading');

  return markdown
    .slice(markdown.indexOf('\n', open) + 1, close)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Amounts arrive as `13000000000[web:59][web:63]`.
 *
 * The markers are provenance, so they are kept in the parsed JSON rather than
 * thrown away. What must not survive is the string reaching Number() and
 * becoming NaN, which is indistinguishable from a genuinely blank cell.
 *
 * Returns null ONLY for a genuinely empty cell. Anything that is present but
 * unparseable throws, and the row is rejected.
 */
function parseAmount(cell) {
  const markers = [...cell.matchAll(/\[web:(\d+)\]/g)].map((m) => m[1]);
  const bare = cell.replace(/\[web:\d+\]/g, '').trim();

  if (bare === '') return { amount: null, markers };
  if (!/^\d+(\.\d+)?$/.test(bare)) {
    throw new Error(`amount "${cell}" does not parse to a number`);
  }
  return { amount: Number(bare), markers };
}

const lines = extractTable(readFileSync(source, 'utf8'));
const columns = lines[0].split('|').map((c) => c.trim());

const rows = lines.slice(1).map((line, index) => {
  const cells = line.split('|').map((c) => c.trim());
  const row = { row: index + 1, raw: line };
  columns.forEach((name, i) => {
    row[name] = cells[i] ?? '';
  });
  return row;
});

console.log(`${DIM}parsed ${rows.length} rows from ${source}${RESET}\n`);

// ---------------------------------------------------------------------------
// 2. The editorial decisions.
// ---------------------------------------------------------------------------

const decisions = JSON.parse(readFileSync(DECISIONS, 'utf8'));
const { entities: entityMap, kinds: kindMap, rows: rowDecisions } = decisions;

const CONFIDENCE = { confirmed: 'official', reported: 'news_derived', rumoured: 'news_derived' };
const LOOP = { yes: 'forms_loop', alleged: 'alleged', no: 'none' };
const BASIS = { commitment: 'commitment', 'disclosed-total': 'disclosed_total' };

// ---------------------------------------------------------------------------
// 3. URL liveness.
//
// HEAD first because it is cheap, GET with a byte range where the host rejects
// HEAD. Node's fetch fails on some hosts for reasons that are about Node and
// not about the URL (Yahoo's response headers exceed undici's buffer), so a
// curl fallback decides those rather than letting a client limitation reject a
// live source.
//
// Cached to disk: the statuses are evidence, they belong in the diff, and a
// re-run should not depend on the network.
// ---------------------------------------------------------------------------

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0 Safari/537.36';

let urlCache = {};
try {
  urlCache = JSON.parse(readFileSync(URL_CACHE, 'utf8'));
} catch {
  /* first run */
}

async function probe(url) {
  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'user-agent': UA },
      signal: AbortSignal.timeout(25000),
    });
    if ([403, 405, 501].includes(response.status)) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'user-agent': UA, range: 'bytes=0-2000' },
        signal: AbortSignal.timeout(25000),
      });
    }
    return { status: response.status, final: response.url, via: 'fetch' };
  } catch (error) {
    // A Node-level failure is not evidence about the URL. Ask curl.
    try {
      const out = execFileSync(
        'curl',
        ['-sSIL', '-A', UA, '-o', '/dev/null', '-w', '%{http_code} %{url_effective}', '--max-time', '25', url],
        { encoding: 'utf8' }
      ).trim();
      const [status, ...rest] = out.split(' ');
      return { status: Number(status), final: rest.join(' '), via: 'curl' };
    } catch {
      return { status: null, final: null, via: 'unreachable', error: error.message };
    }
  }
}

const urls = [...new Set(rows.map((r) => r.source_url).filter(Boolean))];

if (!offline) {
  process.stdout.write(`${DIM}checking ${urls.length} distinct source URLs`);
  for (const url of urls) {
    const result = await probe(url);
    urlCache[url] = { ...result, checkedAt: new Date().toISOString() };
    process.stdout.write('.');
  }
  process.stdout.write(`${RESET}\n\n`);

  // Persisted here, not at the end, and on a dry run as much as a write. These
  // statuses ARE the evidence that the sources resolve; losing them because the
  // run was a dry one would mean the next `--write --offline` pass emitted
  // citations with no recorded status, silently.
  writeFileSync(URL_CACHE, `${JSON.stringify(urlCache, null, 2)}\n`, 'utf8');
}

/**
 * Is this URL evidence, or is it a broken link?
 *
 * `dead` is reserved for definitive proof the page is gone: a 404, or a
 * redirect that lands on a site root or an error page. A 401 from Reuters is a
 * paywall and a 403 from an investor-relations host is a bot block — neither is
 * proof the URL is wrong, so neither rejects the row on its own. Those come
 * back `unconfirmed`, and it is decisions.json, written by a person, that turns
 * an unconfirmed 4xx into a rejection where the slug is visibly truncated.
 */
function classifyUrl(url) {
  const seen = urlCache[url];
  if (!seen) return { state: 'unchecked' };
  if (seen.status === null) return { state: 'unreachable', ...seen };
  if (seen.status === 404) return { state: 'dead', reason: '404', ...seen };

  if (seen.final && seen.final !== url) {
    let landed;
    try {
      landed = new global.URL(seen.final);
    } catch {
      landed = null;
    }
    if (landed && (landed.pathname === '/' || /(^|\/)404(\/|$|\.)/.test(landed.pathname))) {
      return { state: 'dead', reason: `redirected to ${seen.final}`, ...seen };
    }
  }

  if (seen.status >= 200 && seen.status < 300) return { state: 'live', ...seen };
  return { state: 'unconfirmed', reason: `HTTP ${seen.status}`, ...seen };
}

function publisherOf(url) {
  try {
    return new global.URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 4. Gate every row.
// ---------------------------------------------------------------------------

const accepted = [];
const completions = [];
const rejected = [];
const undeclared = [];
const swaps = [];
const consortiumTrace = [];

function resolveEntity(name) {
  const id = entityMap[name];
  if (!id) throw new Error(`entity "${name}" has no entry in decisions.entities`);
  return id;
}

for (const row of rows) {
  const decision = rowDecisions[String(row.row)];
  const label = `row ${String(row.row).padStart(2)} · ${row.entity_a} → ${row.entity_b}`;

  if (!decision) {
    undeclared.push({ row, label });
    continue;
  }

  // A decision file that has drifted from the table is worse than none: it
  // would apply row 12's judgement to row 13's deal.
  if (decision.check?.[0] !== row.entity_a || decision.check?.[1] !== row.event_date) {
    rejected.push({
      label,
      reason: 'decisions.json drift',
      detail: `declared ${JSON.stringify(decision.check)}, table has ["${row.entity_a}", "${row.event_date}"]`,
    });
    continue;
  }

  if (decision.reject) {
    rejected.push({ label, reason: decision.reject, detail: decision.why, declared: true });
    continue;
  }

  try {
    // --- amount ------------------------------------------------------------
    const { amount, markers } = parseAmount(row.amount_usd);
    const basisCell = row.amount_type.trim();
    const basis = basisCell === '' ? null : BASIS[basisCell];
    if (basisCell !== '' && !basis) throw new Error(`amount_type "${basisCell}" is not a known basis`);
    if (amount !== null && !basis) {
      throw new Error('has an amount but no amount_type — the figure cannot be aggregated safely');
    }

    // --- kind --------------------------------------------------------------
    const kind = kindMap[row.event_type];
    if (!kind) throw new Error(`event_type "${row.event_type}" has no entry in decisions.kinds`);

    // --- confidence and loop ----------------------------------------------
    const tier = CONFIDENCE[row.confidence];
    if (!tier) throw new Error(`confidence "${row.confidence}" is not a known value`);

    const loop = LOOP[row.is_part_of_loop];
    if (!loop) throw new Error(`is_part_of_loop "${row.is_part_of_loop}" is not yes/no/alleged`);
    if (loop !== 'none' && row.loop_description.trim().length < 20) {
      throw new Error('flagged as a loop with no usable description');
    }

    // --- direction ---------------------------------------------------------
    const stated = decision.direction_override ?? row.direction;
    if (decision.direction_override) {
      swaps.push(
        `${label}\n      ${YELLOW}direction overridden${RESET} ${row.direction} → ${stated}: ${decision.why}`
      );
    }
    if (!['a_to_b', 'b_to_a', 'bidirectional'].includes(stated)) {
      throw new Error(`direction "${stated}" is not a_to_b/b_to_a/bidirectional`);
    }

    const reverse = stated === 'b_to_a';
    const payerName = reverse ? row.entity_b : row.entity_a;
    const payeeName = reverse ? row.entity_a : row.entity_b;
    if (reverse) {
      swaps.push(
        `${label}\n      ${BLUE}swapped${RESET} (b_to_a): payer is ${payerName}, not ${payeeName}`
      );
    }

    // --- consortium rules (migration 0020 §1) ------------------------------
    const groups = decision.consortium ?? {};
    const resolveSide = (name, side) => {
      const group = groups[side];
      if (!group) return { id: resolveEntity(name), members: [] };

      consortiumTrace.push(
        `${label}\n      rule (${group.rule}) on the ${side} side: "${name}" → ` +
          `${group.key} ${DIM}${group.why}${RESET}`
      );
      return {
        id: resolveEntity(group.key),
        members: (group.members ?? []).map((m) => ({
          entityId: resolveEntity(m.name),
          role: m.role,
          note: m.note ?? null,
        })),
      };
    };

    const payer = resolveSide(payerName, reverse ? 'b' : 'a');
    const payee = resolveSide(payeeName, reverse ? 'a' : 'b');

    // --- url ---------------------------------------------------------------
    const url = row.source_url;
    const publisher = publisherOf(url);
    if (!publisher) throw new Error(`source_url "${url}" is not a URL`);

    const link = classifyUrl(url);
    if (link.state === 'dead') {
      throw new Error(`source URL is dead (${link.reason})`);
    }
    // An unchecked URL is not a passed check. Refusing here is what stops
    // `--offline` on a cold cache from quietly loading 20 unverified links.
    if (link.state === 'unchecked') {
      throw new Error('source URL has never been checked — run without --offline');
    }

    // --- identity ----------------------------------------------------------
    const dedupHash = buildEventDedupHash({
      fromEntityId: payer.id,
      toEntityId: payee.id,
      kind,
      announcedDate: row.event_date,
    });

    const event = {
      row: row.row,
      dedupHash,
      kind,
      structureLabel: row.event_type,
      status: decision.status ?? 'announced',
      completedDate: decision.completed_date ?? null,
      fromEntityId: payer.id,
      toEntityId: payee.id,
      participants: [
        ...payer.members.map((m) => ({ ...m, side: 'from' })),
        ...payee.members.map((m) => ({ ...m, side: 'to' })),
      ],
      amountUsd: amount,
      amountBasis: basis,
      isBidirectional: stated === 'bidirectional',
      announcedDate: row.event_date,
      locationIso3: decision.location_iso3 ?? null,
      headline: null, // composed below, once names are known
      confidenceTier: tier,
      loopStatus: loop,
      loopDescription: loop === 'none' ? null : row.loop_description,
      citation: {
        url,
        publisher,
        isPrimary: decision.is_primary ?? false,
        httpStatus: link.status ?? null,
        fetchedAt: urlCache[url]?.checkedAt ?? null,
        note: link.state === 'live' ? null : `${link.state}: ${link.reason ?? link.error ?? ''}`.trim(),
      },
      provenance: { amountMarkers: markers, sourceDirection: row.direction, rawRow: row.raw },
      urlState: link.state,
    };

    if (decision.completes) {
      completions.push({ label, event, completes: decision.completes, why: decision.why });
    } else {
      accepted.push({ label, event });
    }
  } catch (error) {
    rejected.push({ label, reason: 'failed a check', detail: error.message });
  }
}

// --- a completion must point at a row that was itself accepted --------------
for (const completion of completions) {
  const target = accepted.find((a) => a.event.row === completion.completes);
  if (!target) {
    rejected.push({
      label: completion.label,
      reason: 'completes an unloaded row',
      detail: `row ${completion.completes} was not accepted, so there is nothing to mark complete`,
    });
    completion.target = null;
    continue;
  }
  completion.target = target.event;
}

// --- dedup collisions -------------------------------------------------------
const byHash = new Map();
for (const { label, event } of accepted) {
  if (byHash.has(event.dedupHash)) {
    rejected.push({
      label,
      reason: 'dedup_hash collision',
      detail: `same parties, kind and date as ${byHash.get(event.dedupHash)} — one of them is misdated or mistyped`,
    });
  } else {
    byHash.set(event.dedupHash, label);
  }
}

// ---------------------------------------------------------------------------
// 5. Report.
// ---------------------------------------------------------------------------

if (swaps.length) {
  console.log(`${BLUE}direction${RESET} ${DIM}— from_entity_id means the payer; every change is printed${RESET}`);
  for (const line of swaps) console.log(`  ${line}`);
  console.log();
}

if (consortiumTrace.length) {
  console.log(`${BLUE}consortia${RESET} ${DIM}— migration 0020 §1, rules (a) vehicle / (b) named lead / (c) reject${RESET}`);
  for (const line of consortiumTrace) console.log(`  ${line}`);
  console.log();
}

const unconfirmed = accepted.filter((a) => a.event.urlState !== 'live');
if (unconfirmed.length) {
  console.log(`${YELLOW}! ${unconfirmed.length} accepted row(s) whose source could not be confirmed${RESET}`);
  for (const { label, event } of unconfirmed) {
    console.log(`  ${DIM}${label} — ${event.citation.publisher}: ${event.citation.note}${RESET}`);
  }
  console.log(`  ${DIM}Loaded with the status recorded on the citation. Not verified by a person.${RESET}\n`);
}

if (rejected.length) {
  console.log(`${RED}rejected${RESET}`);
  for (const r of rejected) {
    console.log(`  ${RED}✗${RESET} ${r.label}`);
    console.log(`      ${r.reason}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log();
}

if (undeclared.length) {
  console.log(`${YELLOW}! ${undeclared.length} row(s) with no entry in decisions.json${RESET}`);
  for (const u of undeclared) console.log(`  ${DIM}${u.label}${RESET}`);
  console.log(`  ${DIM}Add each to decisions.rows before it can be loaded.${RESET}\n`);
}

const loaded = accepted.length;
const merged = completions.filter((c) => c.target).length;

console.log(
  `${GREEN}✓${RESET} ${loaded} event(s) ready, ${merged} completion(s) merged into an existing event ` +
    `${DIM}(${rows.length} rows in, ${rejected.length} rejected, ${undeclared.length} undeclared)${RESET}`
);

if (!write) {
  console.log(`${DIM}Dry run. Pass --write to update db/seeds/027_financing_events.sql${RESET}`);
  process.exit(rejected.length ? 1 : 0);
}

// ---------------------------------------------------------------------------
// 6. Emit.
// ---------------------------------------------------------------------------

mkdirSync(dirname(new global.URL(PARSED).pathname), { recursive: true });

writeFileSync(
  PARSED,
  `${JSON.stringify(
    {
      source,
      generatedAt: new Date().toISOString(),
      counts: {
        parsed: rows.length,
        accepted: loaded,
        completions: merged,
        rejected: rejected.length,
        undeclared: undeclared.length,
      },
      events: accepted.map((a) => a.event),
      completions: completions.map((c) => ({
        completes: c.completes,
        why: c.why,
        event: c.event,
      })),
      rejected,
    },
    null,
    2
  )}\n`,
  'utf8'
);

/**
 * One block per event.
 *
 * The event and its citation go in together, in one statement, on purpose: the
 * deferred trigger from migration 0020 will refuse the whole transaction if an
 * event reaches COMMIT with neither a citation nor a document, and writing them
 * as one CTE makes it impossible to emit an event without its evidence.
 *
 * ON CONFLICT (dedup_hash) DO UPDATE rather than DO NOTHING, so the seed is
 * re-runnable and an edited row updates in place. DO UPDATE also returns the
 * id, which DO NOTHING would not — the citation insert depends on it.
 */
function eventBlock({ label, event: e }) {
  const headline = e.headline;

  const participants = e.participants
    .map(
      (p) => `INSERT INTO event_participants (event_id, entity_id, side, role, note)
SELECT id, ${sql(p.entityId)}, ${sql(p.side)}, ${sql(p.role)}, ${sql(p.note)}
  FROM events WHERE dedup_hash = ${sql(e.dedupHash)}
ON CONFLICT (event_id, entity_id, side)
  DO UPDATE SET role = EXCLUDED.role, note = EXCLUDED.note;`
    )
    .join('\n\n');

  return `-- ${label}
-- ${e.structureLabel}
WITH upserted AS (
  INSERT INTO events (
    kind, status, from_entity_id, to_entity_id,
    amount_usd, amount_basis, amount_is_estimate,
    announced_date, completed_date, location_iso3,
    headline, confidence_tier, is_verified, dedup_hash,
    loop_status, loop_description, structure_label, is_bidirectional
  ) VALUES (
    ${sql(e.kind)}, ${sql(e.status)}, ${sql(e.fromEntityId)}, ${sql(e.toEntityId)},
    ${num(e.amountUsd)}, ${sql(e.amountBasis)}, FALSE,
    ${sql(e.announcedDate)}, ${sql(e.completedDate)}, ${sql(e.locationIso3)},
    ${sql(headline)}, ${sql(e.confidenceTier)}, FALSE, ${sql(e.dedupHash)},
    ${sql(e.loopStatus)}, ${sql(e.loopDescription)}, ${sql(e.structureLabel)}, ${e.isBidirectional ? 'TRUE' : 'FALSE'}
  )
  ON CONFLICT (dedup_hash) DO UPDATE SET
    kind = EXCLUDED.kind, status = EXCLUDED.status,
    from_entity_id = EXCLUDED.from_entity_id, to_entity_id = EXCLUDED.to_entity_id,
    amount_usd = EXCLUDED.amount_usd, amount_basis = EXCLUDED.amount_basis,
    announced_date = EXCLUDED.announced_date, completed_date = EXCLUDED.completed_date,
    location_iso3 = EXCLUDED.location_iso3, headline = EXCLUDED.headline,
    confidence_tier = EXCLUDED.confidence_tier,
    loop_status = EXCLUDED.loop_status, loop_description = EXCLUDED.loop_description,
    structure_label = EXCLUDED.structure_label,
    is_bidirectional = EXCLUDED.is_bidirectional,
    updated_at = now()
  RETURNING id
)
INSERT INTO event_citations (event_id, url, publisher, is_primary, http_status, fetched_at, note)
SELECT id, ${sql(e.citation.url)}, ${sql(e.citation.publisher)},
       ${e.citation.isPrimary ? 'TRUE' : 'FALSE'},
       ${num(e.citation.httpStatus)}, ${sql(e.citation.fetchedAt)}::timestamptz, ${sql(e.citation.note)}
  FROM upserted
ON CONFLICT (event_id, url) DO UPDATE SET
  publisher = EXCLUDED.publisher, is_primary = EXCLUDED.is_primary,
  http_status = EXCLUDED.http_status, fetched_at = EXCLUDED.fetched_at,
  note = EXCLUDED.note;${participants ? `\n\n${participants}` : ''}`;
}

/**
 * A completion is a status change, NOT a second event.
 *
 * "Amazon completes its $4bn Anthropic investment" and "Amazon invests $4bn in
 * Anthropic" are one $4bn. Loading both would put $8bn in the table, and
 * dedup_hash cannot catch it because the dates genuinely differ. So the second
 * row updates the first and contributes its own citation.
 *
 * Which row completes which is declared by a person in decisions.json. The
 * script never infers it.
 */
function completionBlock({ label, event: e, completes, why }) {
  return `-- ${label}
-- COMPLETION of row ${completes}, not a second deal. ${why}
UPDATE events
   SET status = 'completed',
       completed_date = ${sql(e.announcedDate)},
       updated_at = now()
 WHERE dedup_hash = ${sql(e.dedupHash)};

INSERT INTO event_citations (event_id, url, publisher, is_primary, http_status, fetched_at, note)
SELECT id, ${sql(e.citation.url)}, ${sql(e.citation.publisher)},
       ${e.citation.isPrimary ? 'TRUE' : 'FALSE'},
       ${num(e.citation.httpStatus)}, ${sql(e.citation.fetchedAt)}::timestamptz, ${sql(e.citation.note)}
  FROM events WHERE dedup_hash = ${sql(e.dedupHash)}
ON CONFLICT (event_id, url) DO UPDATE SET
  http_status = EXCLUDED.http_status, fetched_at = EXCLUDED.fetched_at, note = EXCLUDED.note;`;
}

// Headlines are composed here, not in decisions.json, because they are a
// rendering of the row rather than a judgement about it.
const NAMES = JSON.parse(readFileSync(new URL('../docs/financing/entity-names.json', import.meta.url), 'utf8'));
const nameOf = (id) => NAMES[id] ?? id;

function money(amount, basis) {
  if (amount === null) return null;
  const bn = amount / 1e9;
  const figure = bn >= 1 ? `$${Number(bn.toFixed(2))}bn` : `$${Number((amount / 1e6).toFixed(1))}m`;
  return `${figure} ${basis === 'commitment' ? 'commitment' : 'disclosed'}`;
}

for (const item of [...accepted, ...completions]) {
  const e = item.event;
  const parties = e.isBidirectional
    ? `${nameOf(e.fromEntityId)} and ${nameOf(e.toEntityId)}`
    : `${nameOf(e.fromEntityId)} → ${nameOf(e.toEntityId)}`;
  const figure = money(e.amountUsd, e.amountBasis);
  e.headline = `${parties}: ${e.structureLabel}${figure ? ` (${figure})` : ''}`;
}

// The completion's own dedup_hash must be the TARGET's, since it updates it.
for (const completion of completions) {
  if (completion.target) completion.event.dedupHash = completion.target.dedupHash;
}

writeFileSync(
  SEED,
  `-- ============================================================================
-- 027_financing_events.sql — the AI circular-financing deal graph
--
-- GENERATED by scripts/load-financing-deals.js from the research table and the
-- editorial decisions in docs/financing/decisions.json. Do not hand-edit;
-- change the decisions file and re-run the script.
--
-- WHAT THESE ARE
--
-- ${loaded} dated financing transactions between AI labs, chipmakers, hyperscalers,
-- GPU clouds, data-centre operators, private credit and sovereign funds, each
-- with a source URL that resolved when the loader last checked.
--
-- ${rows.length} rows went in. ${rejected.length} were rejected and ${merged} was merged into an
-- earlier event as a completion rather than loaded as a second deal. Every
-- rejection and its reason is in docs/financing/deals.json.
--
-- NOTHING HERE HAS BEEN VERIFIED BY A PERSON. Every row lands with
-- is_verified = FALSE and event_citations.is_checked = FALSE, regardless of what
-- the research called "confirmed" — that word described the source's own
-- confidence, not ours. \`SELECT * FROM unverified_loops\` is the worklist.
--
-- READ THE AMOUNTS WITH amount_basis. A commitment is a ceiling and a
-- disclosed_total is a transaction; summing them together produces a number
-- describing nothing. The same goes for direction: a stake in a lab and the
-- cloud order tied to it are two rows pointing opposite ways, and that is the
-- finding rather than a bug.
-- ============================================================================

${accepted.map(eventBlock).join('\n\n')}

${completions.filter((c) => c.target).map(completionBlock).join('\n\n')}
`,
  'utf8'
);

console.log(`${GREEN}✓${RESET} wrote db/seeds/027_financing_events.sql and docs/financing/deals.json`);
