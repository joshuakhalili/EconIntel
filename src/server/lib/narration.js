/**
 * Grounded narration — the LLM layer, and the gate that makes it safe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 *   An LLM is never asked to invent a number or a citation. It is handed
 *   SQL-computed values and stored claims, and asked to connect them in a
 *   sentence.
 *
 * That rule has been written down since `0006_analysis.sql`. Until this file
 * existed it was enforced by nothing at all — a grill session on 2026-08-28
 * found it stated in STATUS.md as governing fact with zero code behind it, and
 * STATUS has carried an explicit "this is schema, not enforcement" warning ever
 * since. This is the enforcement.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOW IT IS ENFORCED: THE OUTPUT IS CHECKED, NOT THE PROMPT
 *
 * A prompt that says "do not invent numbers" is a request. Models comply with
 * it most of the time, which is the worst possible reliability profile for a
 * site whose entire claim is that its figures are real: the failure is rare,
 * silent, and indistinguishable from success.
 *
 * So the prompt is not the control. `validate()` is. Every numeric token in the
 * model's output must appear in the grounding it was given. One that does not
 * fails the whole narration, and a failed narration is NOT STORED and NOT
 * SHOWN — the page renders without it. Fail closed, always: a missing
 * paragraph costs a reader nothing, and a fabricated figure costs this project
 * the only thing it has.
 *
 * WHY THE CHECK IS ON NUMBERS AND NOT ON MEANING
 *
 * Checking whether prose is *true* needs a judge as capable as the writer, and
 * a second model marking the first one's work is not a control, it is a second
 * opinion. Checking whether every number is one we supplied is decidable — it
 * is set membership — and it happens to catch the failure that actually
 * matters here. A model that writes "productivity rose sharply" from data
 * showing a rise is doing its job. A model that writes "rose 4.2%" when 4.2
 * was never given to it has fabricated a measurement, and that is the thing
 * this site cannot ship.
 *
 * WHAT THE CHECK CANNOT CATCH, STATED PLAINLY
 *
 *   - Numbers written as words. "rose by three percent" passes. Mitigated by
 *     instructing digits and by NUMBER_WORDS below, not eliminated.
 *   - A real number used to say something false. 74,041 is in the grounding;
 *     "74,041 countries" would pass. The numbers are guaranteed, the sentences
 *     around them are not.
 *   - Attribution. Handled separately: any URL, DOI or quotation mark in the
 *     output is rejected outright, because a citation is exactly what this
 *     model is never allowed to produce.
 *
 * These are limits, not excuses. They are why every narration renders labelled
 * as machine-written with its grounding available — see `NarrationBlock` on
 * the client.
 *
 * MEASURED, NOT ASSUMED (2026-08-30, @cf/meta/llama-3.1-8b-instruct)
 *
 * Six generations from the real prompt against real lens data: 6 accepted, 0
 * rejected. So the gate is not so strict that the feature can never render,
 * which is the failure mode a strict gate usually has.
 *
 * Four generations from a deliberately adversarial prompt — one that asked for
 * percentage changes, historical context and the name of the publishing agency,
 * i.e. for exactly the three things the rules forbid: 4 rejected, 0 accepted.
 * What it caught, verbatim from the run:
 *
 *   -3.7%          arithmetic the model performed on two supplied levels
 *   2021, 2022,    invented historical context for a series it was handed
 *   2023           two data points of
 *   0.6, 0.8, 0.9  figures with no origin at all
 *
 * One of those four also wrote that the index "has been trending upward"
 * about a series that went 30.1 to 29.0. The gate rejected it — but on the
 * numbers, not on the falsehood, and that is worth keeping in mind. It
 * guarantees arithmetic, not truth.
 */

import { createHash } from 'node:crypto';
import { query } from '../db/pool.js';
import { config } from '../config.js';

/**
 * Bump to invalidate every cached narration at once.
 *
 * The cache key is (scope, input_hash, prompt_version). Changing the prompt
 * without changing this returns prose written by the OLD prompt from the
 * cache, indefinitely, which is the kind of bug that is discovered months
 * later by reading something that sounds wrong.
 */
export const PROMPT_VERSION = 'v1-2026-08-30';

/** Never invent, never cite, never round. Short because the model is 8B. */
const SYSTEM_PROMPT = [
  'You describe economic data for a public dashboard.',
  '',
  'ABSOLUTE RULES:',
  '1. Use ONLY the numbers given to you in the DATA block. Never calculate a',
  '   new number, never estimate, never round, never convert units.',
  '2. Write every number exactly as it appears in the DATA block, digits and all.',
  '3. Never name a source, never give a URL, never quote anything.',
  '4. If the data does not support a claim, do not make it.',
  '5. Two sentences maximum. Plain English. No adjectives like "dramatic",',
  '   "explosive", "staggering".',
  '',
  'You are describing what the numbers show. You are not interpreting what it',
  'means for the future, and you never speculate about causes.',
].join('\n');

/**
 * Numbers a model may legitimately write without being handed them.
 *
 * Deliberately tiny. These are the counting words that appear in ordinary
 * English prose ("both of these", "the three series") rather than measurements.
 * Anything above ten is a figure and must come from the data.
 */
const NUMBER_WORDS = new Set([
  'zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
]);

/* ── The grounding ───────────────────────────────────────────────────────── */

/**
 * Every form of a number a model might reasonably write it in.
 *
 * The grounding holds 13.48; the model may write 13.48, 13.5, 13 or 13.480.
 * All four are the same measurement and rejecting the last three would make
 * the gate unusable while catching nothing — a fabricated figure is a
 * DIFFERENT number, not the same number with fewer decimals.
 *
 * What it must never do is admit a number that rounds to something in the
 * grounding but was not derived from it. That is why only the value itself is
 * expanded, never a range around it.
 */
function numericForms(value) {
  const forms = new Set();
  const n = Number(value);
  if (!Number.isFinite(n)) return forms;

  const add = (s) => {
    if (s === undefined || s === null) return;
    forms.add(String(s));
    // Thousands separators, both directions.
    forms.add(String(s).replace(/\B(?=(\d{3})+(?!\d))/g, ','));
  };

  add(n);
  for (const dp of [0, 1, 2, 3]) add(n.toFixed(dp));
  // Trailing-zero variants: 13.50 and 13.5 are one number.
  for (const form of [...forms]) {
    if (form.includes('.')) add(form.replace(/\.?0+$/, ''));
  }
  add(Math.round(n));
  add(Math.abs(n));
  return forms;
}

/**
 * Pull every number out of a grounding payload, whatever its shape.
 *
 * Walks the whole structure rather than reading known keys, because the
 * grounding is built per scope and a key added later must be covered
 * automatically. A number the model was shown but that this misses would be
 * rejected as a fabrication — annoying but safe; the reverse would not be.
 */
export function allowedNumbers(grounding) {
  const allowed = new Set();

  const walk = (node) => {
    if (node === null || node === undefined) return;
    if (typeof node === 'number') {
      for (const form of numericForms(node)) allowed.add(form);
      return;
    }
    if (typeof node === 'string') {
      // Dates and numeric strings. '2026-08-30' licenses 2026, 08, 30 and the
      // whole string: a model writing "in 2026" from a date it was given has
      // invented nothing.
      for (const token of node.match(/\d[\d,.]*/g) ?? []) {
        allowed.add(token);
        allowed.add(token.replace(/,/g, ''));
        for (const form of numericForms(Number(token.replace(/,/g, '')))) {
          allowed.add(form);
        }
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === 'object') {
      Object.values(node).forEach(walk);
    }
  };

  walk(grounding);
  return allowed;
}

/* ── The gate ────────────────────────────────────────────────────────────── */

/**
 * Check a narration against the data it was given.
 *
 * @returns {{ok: true} | {ok: false, reason: string, offending: string[]}}
 */
export function validate(body, grounding) {
  if (typeof body !== 'string' || body.trim().length === 0) {
    return { ok: false, reason: 'empty', offending: [] };
  }

  /*
   * A citation is the one thing this model may never produce, and it is
   * cheap to detect. Rejected outright rather than stripped: a model that
   * reached for a source has misunderstood the task, and the rest of what it
   * wrote is not more trustworthy for having had the URL removed.
   */
  if (/https?:\/\/|www\.|doi\.org|\b10\.\d{4}\//i.test(body)) {
    return { ok: false, reason: 'contains a URL or DOI', offending: [] };
  }
  if (/["“”]/.test(body)) {
    return { ok: false, reason: 'contains a quotation', offending: [] };
  }
  /*
   * "according to", "sources say", "reported by" — attribution without a URL
   * is still attribution, and this model has no sources to attribute to.
   */
  const attribution = body.match(
    /\b(according to|as reported|sources? (say|suggest|indicate)|cited by|per the)\b/i
  );
  if (attribution) {
    return { ok: false, reason: `attributes a source ("${attribution[0]}")`, offending: [] };
  }

  const allowed = allowedNumbers(grounding);
  const offending = [];

  for (const token of body.match(/\d[\d,]*(?:\.\d+)?/g) ?? []) {
    const bare = token.replace(/,/g, '');
    if (allowed.has(token) || allowed.has(bare)) continue;
    // A percentage the model wrote as 13.5 from a grounding value of 0.135 is
    // still a calculation it was told not to do — so no unit conversion is
    // admitted here on purpose.
    offending.push(token);
  }

  if (offending.length > 0) {
    return {
      ok: false,
      reason: `${offending.length} number(s) not in the grounding`,
      offending,
    };
  }

  const backwards = wrongDirection(body, grounding);
  if (backwards) {
    return { ok: false, reason: `states the wrong direction (${backwards})`, offending: [] };
  }

  return { ok: true };
}

const FALLING = /\b(decreas\w*|fell|fall\w*|drop\w*|declin\w*|down|lower|shrank|slid)\b/i;
const RISING = /\b(increas\w*|rose|rise|rising|grew|grow\w*|climb\w*|up|higher|gain\w*|jump\w*)\b/i;

/**
 * Catch a narration that describes a real movement backwards.
 *
 * THIS EXISTS BECAUSE THE NUMBER CHECK IS NOT ENOUGH, AND THAT WAS MEASURED.
 *
 * The first working run of the generator produced, on the labour lens:
 *
 *   "US graduate unemployment decreased slightly from 3.7% to 3.8%"
 *
 * Both figures are real and both are in the grounding, so the number gate
 * passed it. It is also plainly wrong — 3.7 to 3.8 is a rise — and it is the
 * kind of wrong a reader notices immediately and cannot un-notice, because it
 * says the site cannot read its own data.
 *
 * Direction is decidable in the same way membership is: the grounding holds
 * `previous` and `latest` for each series, so the true sign is known. This
 * looks for the shape the model actually writes — a direction word followed by
 * "from A to B", or by "to B from A" — checks whether A and B are a real pair
 * from the grounding, and rejects when the sign disagrees.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * It does not parse the sentence. It splits the text into CLAUSES — on full
 * stops, semicolons and commas — and asks of each clause independently: does
 * this clause contain a from/to pair I recognise, and does it contain a
 * direction word that disagrees with it?
 *
 * Splitting on commas is what makes "chip prices fell, while gold rose from
 * 4190.2 to 4218.55" safe. Taking the nearest direction word instead attaches
 * "fell" to gold's rise and rejects a perfectly correct sentence; taking the
 * nearest WORD, which an earlier version of this did, captures "slightly" and
 * silently checks nothing at all.
 *
 * A clause with two direction words, or none, is left alone. This is a check
 * for the unambiguous case, which is the case the model actually gets wrong.
 */
export function wrongDirection(body, grounding) {
  /** Every (previous, latest) pair in the grounding, at any depth. */
  const pairs = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(walk);
    const { previous, latest } = node;
    if (Number.isFinite(previous) && Number.isFinite(latest) && previous !== latest) {
      pairs.push({ previous: Number(previous), latest: Number(latest), name: node.name });
    }
    Object.values(node).forEach(walk);
  };
  walk(grounding);
  if (pairs.length === 0) return null;

  /*
   * Take the first well-formed number out of the capture.
   *
   * Stripping non-digits and calling Number() is not enough: a sentence ending
   * "…to 4218.55." hands over "4218.55." — two decimal points — which is NaN,
   * and a NaN silently matches no pair, so the check passes anything that
   * happens to end in a figure. It did exactly that until this was found.
   */
  const numeric = (raw) => {
    const match = String(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : Number.NaN;
  };
  const sameNumber = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;

  const NUM = String.raw`[$£€]?[\d,.]+%?`;
  const patterns = [
    { re: new RegExp(String.raw`\bfrom\s+(${NUM})\s+to\s+(${NUM})`, 'gi'), order: 'from-to' },
    { re: new RegExp(String.raw`\bto\s+(${NUM})\s+from\s+(${NUM})`, 'gi'), order: 'to-from' },
  ];

  /*
   * One clause per direction claim. Commas included: "fell, while gold rose
   * from A to B" must not let gold borrow the first clause's verb.
   *
   * The lookarounds are load-bearing, and getting them slightly wrong fails
   * in both directions.
   *
   * Splitting on a bare `[.;,]` splits inside every number — "3.7%" becomes
   * "3" and "7%" — so no from/to pair survives and the check silently matches
   * nothing. It passed every test that way, because every test was asking
   * whether correct sentences are accepted.
   *
   * Refusing to split on any comma between digits then over-corrects:
   * "…from 29.75, and gold declined…" stays as one clause, both direction
   * words appear in it, and the check gives up as undecidable. A thousands
   * separator is distinguishable — it is always followed by EXACTLY three
   * digits — so that is what the lookahead tests, rather than "a digit".
   */
  for (const clause of body.split(/(?<!\d)\.(?!\d)|,(?!\d{3}(?!\d))|;/)) {
    if (!clause) continue;
    const claimsFall = FALLING.test(clause);
    const claimsRise = RISING.test(clause);
    if (claimsFall === claimsRise) continue; // none, or both — not decidable

    for (const { re, order } of patterns) {
      for (const match of clause.matchAll(re)) {
        const first = numeric(match[1]);
        const second = numeric(match[2]);
        const [from, to] = order === 'from-to' ? [first, second] : [second, first];

        const pair = pairs.find(
          (p) => sameNumber(p.previous, from) && sameNumber(p.latest, to)
        );
        if (!pair) continue;

        const actuallyRose = pair.latest > pair.previous;
        if ((claimsRise && !actuallyRose) || (claimsFall && actuallyRose)) {
          const said = (claimsRise ? RISING : FALLING).exec(clause)[0];
          return `${pair.name ?? 'a series'} went ${pair.previous} to ${pair.latest}, text says "${said}"`;
        }
      }
    }
  }

  return null;
}

/** sha256 of the grounding, key-sorted so key order cannot change the hash. */
export function groundingHash(grounding) {
  const canonical = JSON.stringify(grounding, Object.keys(flatten(grounding)).sort());
  return createHash('sha256').update(canonical).digest('hex');
}

/** Flatten to collect every key name, for a stable JSON.stringify replacer. */
function flatten(node, out = {}, prefix = '') {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node)) {
      out[k] = true;
      flatten(v, out, `${prefix}${k}.`);
    }
  } else if (Array.isArray(node)) {
    node.forEach((v) => flatten(v, out, prefix));
  }
  return out;
}

/* ── The call ────────────────────────────────────────────────────────────── */

/**
 * Ask Workers AI for prose. Returns the raw string; validation is the caller's.
 *
 * Chosen over OpenAI and Anthropic for one reason: 10,000 neurons a day on the
 * free tier with no card on file. That is enough for this, and this project
 * does not need a better writer — the gate below is what determines whether
 * the output is usable, and a more capable model would fail it in subtler ways
 * rather than fewer.
 */
async function callModel(prompt, { signal } = {}) {
  const { accountId, model } = config.cloudflare;
  const token = config.keys.cloudflare;

  if (!accountId || !token) {
    throw new Error(
      'Workers AI is not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN.'
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        // Two sentences. A larger budget produces a third that wanders.
        max_tokens: 160,
        // Low but not zero: at 0 this model repeats stock phrasings across
        // every lens, which reads worse than variation.
        temperature: 0.3,
      }),
      signal: signal ?? AbortSignal.timeout(30_000),
    }
  );

  if (!response.ok) {
    // The token is in the header, not the URL, so the message is safe to store.
    throw new Error(`Workers AI returned ${response.status}`);
  }

  const payload = await response.json();
  const content =
    payload?.result?.choices?.[0]?.message?.content ??
    payload?.result?.response ??
    null;

  if (typeof content !== 'string') {
    throw new Error('Workers AI returned no content');
  }
  return content.trim();
}

/**
 * Render a grounding payload as the DATA block the model sees.
 *
 * Deliberately flat and dull. Prose in the prompt invites prose back that
 * paraphrases the prompt rather than the data, and every line here is a
 * `label: value` the validator can find again.
 */
function renderGrounding(grounding) {
  const lines = [];
  const walk = (node, prefix = '') => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${prefix}[${i + 1}]`));
      return;
    }
    if (typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        walk(value, prefix ? `${prefix}.${key}` : key);
      }
      return;
    }
    lines.push(`${prefix}: ${node}`);
  };
  walk(grounding);
  return lines.join('\n');
}

/* ── The public entry point ──────────────────────────────────────────────── */

/**
 * Get a narration for `scope`, from cache or by generating one.
 *
 * @param {object} options
 * @param {string} options.scope        e.g. 'lens:prices'
 * @param {object} options.grounding    SQL-computed facts, the only numbers allowed
 * @param {string} options.instruction  what to write, one line
 * @param {string[]} [options.indicatorIds] what it was allowed to discuss
 * @param {boolean} [options.force]     bypass the cache
 * @param {string} [options.inputHash]  cache key, when the caller addresses this
 *   row by something other than the grounding's own hash. Simulations need it:
 *   a scenario page finds its narration from the run's inputs, before it has
 *   built a grounding to hash — see `runSimulation()`. Defaults to
 *   `groundingHash(grounding)`, which is what every other caller wants.
 * @returns {Promise<{body: string, cached: boolean} | null>} null when it could
 *   not produce something that passes the gate. Callers MUST handle null by
 *   rendering nothing.
 */
export async function narrate({
  scope,
  grounding,
  instruction,
  indicatorIds = [],
  force = false,
  attempts = 2,
  inputHash: inputHashOverride,
}) {
  /*
   * The cache key. Normally the grounding's own hash — same numbers, same
   * prose, and a changed figure is automatically a new row.
   *
   * A caller may override it when it needs to FIND this row from something it
   * has before it has a grounding. Scenario pages do: a reader arrives with
   * slider values, and the run they identify has to resolve to a narration
   * without the page reconstructing the exact grounding object this script
   * built. Overriding the key is safe because the guarantee that matters is
   * unchanged — the stored `grounding` column still holds the numbers the prose
   * was checked against, and `validate()` still ran against them.
   */
  const inputHash = inputHashOverride ?? groundingHash(grounding);

  if (!force) {
    const { rows } = await query(
      `SELECT body FROM narrations
        WHERE scope = $1 AND input_hash = $2 AND prompt_version = $3
          AND (expires_at IS NULL OR expires_at > now())
        LIMIT 1`,
      [scope, inputHash, PROMPT_VERSION]
    );
    if (rows.length > 0) return { body: rows[0].body, cached: true };
  }

  const prompt = [
    instruction,
    '',
    'DATA (these are the only numbers you may write):',
    renderGrounding(grounding),
  ].join('\n');

  /*
   * Retried, but never repaired. A failed narration is regenerated from the
   * same prompt — it is not handed its own mistake and asked to fix it, which
   * turns the gate into a negotiation and tends to produce output that games
   * the check rather than obeying the rule.
   */
  const failures = [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    let body;
    try {
      body = await callModel(prompt);
    } catch (error) {
      failures.push(`call failed: ${error.message}`);
      continue;
    }

    const verdict = validate(body, grounding);
    if (!verdict.ok) {
      failures.push(
        `${verdict.reason}${verdict.offending.length ? `: ${verdict.offending.join(', ')}` : ''}`
      );
      continue;
    }

    await query(
      `INSERT INTO narrations
         (scope, input_hash, body, grounding, indicator_ids, model, prompt_version)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (scope, input_hash, prompt_version) DO UPDATE
         SET body = EXCLUDED.body, generated_at = now()`,
      [
        scope,
        inputHash,
        body,
        JSON.stringify(grounding),
        indicatorIds,
        config.cloudflare.model,
        PROMPT_VERSION,
      ]
    );

    return { body, cached: false };
  }

  /*
   * Nothing is stored and nothing is returned. The page renders without a
   * narration, which is the correct outcome: the reader loses a paragraph of
   * summary and keeps every guarantee the site makes about its numbers.
   */
  console.warn(`[narration] ${scope} produced nothing usable — ${failures.join(' | ')}`);
  return null;
}

export const __testing = { numericForms, renderGrounding, SYSTEM_PROMPT };
