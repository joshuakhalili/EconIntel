/**
 * Every number STATUS.md and README.md quote, printed from the live database.
 *
 * WHY THIS EXISTS
 *
 * STATUS.md carries a standing rule — nothing is written there as fact unless
 * something enforces it, and every count is re-run rather than carried forward.
 * The rule kept losing. Three consecutive passes of that file described an
 * earlier state as current: it said the simulation tables held 0 rows while
 * they held 1 / 2 / 52 / 248, that 11 questions were active while 23 were, and
 * that the repository had no Actions secrets a day after four were set. The
 * README was worse, because it is public: it understated its own catalogue by
 * 26 indicators and told a reader "there is no deploy yet" four days after the
 * site went live.
 *
 * None of that is carelessness. It is what happens when a dozen figures have to
 * be recalled by hand at the end of a long session. So the recall is removed:
 * this prints the figures, with the query that produced each one beside it, and
 * the next rewrite of either file is a paste.
 *
 *     npm run status:figures
 *     npm run status:figures -- --check
 *     npm run status:figures -- --write
 *
 * WHY --write EXISTS AS WELL AS --check
 *
 * --check tells you a number is wrong. It does not stop the next person typing
 * the replacement, and typing is the whole failure. README.md's headline is the
 * most-read line in the repository and the one nobody can verify by eye, so it
 * is now GENERATED: --write rewrites that line and its measurement date from
 * the database, in place, and refuses if it cannot find exactly one of each.
 * Rewriting the file becomes a command rather than a transcription.
 *
 * --write touches ONLY those two anchors. It is not a doc generator and must
 * not become one: every other sentence in these files is an argument somebody
 * made, and a script that rewrote prose would quietly delete reasoning.
 *
 * WHAT --check ACTUALLY GATES, AND WHAT IT DELIBERATELY DOES NOT
 *
 * Two kinds of number live in these files and they need opposite treatment.
 *
 * STRUCTURAL figures only move when somebody edits this repository — the number
 * of sources, of declared indicators, of active questions, of lenses, of tables
 * and views. If one of those has drifted from the docs, a person changed the
 * shape of the project and did not say so. That is a real failure and --check
 * exits 1 on it.
 *
 * VOLATILE figures move on their own, every time ingestion runs: observations,
 * documents, cached simulation runs, the review worklists. Gating those would
 * put the file in the red every single morning, and a gate that is always red
 * is a gate nobody reads — which is the exact failure this project has already
 * hit with the daily Ingest workflow. So drift is REPORTED for them and never
 * fails the run.
 *
 * A third kind arrived later and is not a figure at all: CODE CLAIMS. README.md
 * makes a handful of statements about what the shipped code does — which props
 * a component is mounted with, and therefore whether a safeguard can fire. Those
 * have no number in them, cannot be checked by re-reading the file they are
 * written in, and are the most damaging thing on the page to get wrong. They are
 * asserted in CODE_CLAIMS below and every failure exits 1.
 *
 * The test count is not here on purpose. It is not a database fact, reading it
 * means running the suite, and a figures script that runs the test suite as a
 * side effect is a trap. `npm test` prints it in one line.
 *
 * A few figures are counts of FILES ON DISK rather than rows — the migration
 * and seed files. They are here because STATUS.md quotes them, they are exactly
 * as structural as a table count, and they had drifted the same way: the file
 * said 26 migrations and 43 seeds while the tree held 27 and 45. `count()` is
 * SQL and `files()` is a directory listing; both are read-only.
 *
 * Read-only against the database: this script issues SELECTs and nothing else,
 * and it reads source files without modifying them. The one thing it writes is
 * README.md's headline, under --write.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool, closePool } from '../src/server/db/pool.js';
import { PROMPT_VERSION } from '../src/server/lib/narration.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const GREEN = '[32m';
const RED = '[31m';
const YELLOW = '[33m';
const DIM = '[2m';
const BOLD = '[1m';
const RESET = '[0m';

/**
 * The figures, in the order a person reading STATUS.md meets them.
 *
 * `docs` is what makes --check possible: a pattern per file, capturing the
 * number that file currently states. The pattern must match EXACTLY ONCE — a
 * pattern that matches twice is checking a number it cannot identify, and one
 * that matches nothing is silently checking nothing, which is how a gate ends
 * up green forever. Both cases are reported as failures of the gate itself
 * rather than of the figure.
 */
const FIGURES = [
  {
    key: 'observations',
    label: 'Observations',
    sql: 'SELECT count(*)::int AS n FROM observations',
    volatile: true,
    docs: [{ file: 'README.md', pattern: /([\d,]+) observations/g }],
  },
  {
    key: 'indicators_declared',
    label: 'Indicators declared',
    sql: 'SELECT count(*)::int AS n FROM indicators',
    docs: [{ file: 'STATUS.md', pattern: /([\d,]+) indicators declared/g }],
  },
  {
    key: 'indicators_with_data',
    label: 'Indicators holding at least one observation',
    sql: 'SELECT count(DISTINCT indicator_id)::int AS n FROM observations',
    volatile: true,
    docs: [{ file: 'README.md', pattern: /([\d,]+) indicators with data/g }],
  },
  {
    key: 'sources',
    label: 'Sources in the catalogue',
    sql: 'SELECT count(*)::int AS n FROM sources',
    docs: [{ file: 'README.md', pattern: /([\d,]+) sources/g }],
  },
  /*
   * The three-way split of the source catalogue, as three separate figures.
   *
   * These exist because the README got this exact sentence wrong in public
   * twice. It said the non-observation publishers "produce documents (7 news
   * feeds and the Federal Reserve) or nothing yet at all" — omitting OpenAlex,
   * which is the LARGEST document producer in the database at 934 rows. A
   * prose list is unfalsifiable; three counts that must sum to `sources` are
   * not, and getting one wrong now fails the gate.
   */
  {
    key: 'sources_producing',
    label: 'Sources that have ever produced an observation',
    sql: `SELECT count(DISTINCT i.source_id)::int AS n
            FROM indicators i
           WHERE EXISTS (SELECT 1 FROM observations o WHERE o.indicator_id = i.id)`,
    docs: [
      { file: 'STATUS.md', pattern: /only ([\d,]+) of them have ever produced an observation/g },
      { file: 'README.md', pattern: /\*\*([\d,]+) have ever produced an observation\*\*/g },
    ],
  },
  {
    key: 'sources_producing_documents',
    label: 'Sources that produce documents, not series',
    sql: `SELECT count(DISTINCT s.id)::int AS n
            FROM sources s
           WHERE EXISTS (SELECT 1 FROM documents d WHERE d.source_id = s.id)
             AND NOT EXISTS (
                   SELECT 1 FROM indicators i
                    WHERE i.source_id = s.id
                      AND EXISTS (SELECT 1 FROM observations o WHERE o.indicator_id = i.id))`,
    docs: [{ file: 'README.md', pattern: /([\d,]+) produce documents rather than series/g }],
  },
  {
    key: 'sources_producing_nothing',
    label: 'Sources that have produced nothing at all',
    sql: `SELECT count(*)::int AS n
            FROM sources s
           WHERE NOT EXISTS (SELECT 1 FROM documents d WHERE d.source_id = s.id)
             AND NOT EXISTS (
                   SELECT 1 FROM indicators i
                    WHERE i.source_id = s.id
                      AND EXISTS (SELECT 1 FROM observations o WHERE o.indicator_id = i.id))`,
    docs: [{ file: 'README.md', pattern: /([\d,]+) have produced nothing yet/g }],
  },
  {
    key: 'dbnomics_providers_used',
    label: 'DBnomics providers actually in use',
    sql: `SELECT count(DISTINCT split_part(source_series_code, '/', 1))::int AS n
            FROM indicators WHERE source_id = 'dbnomics'`,
    docs: [
      { file: 'README.md', pattern: /([\d,]+) of them in use here/g },
      { file: 'STATUS.md', pattern: /only ([\d,]+) of them are in use here/g },
    ],
  },
  {
    key: 'lenses',
    label: 'Lenses',
    sql: 'SELECT count(*)::int AS n FROM lenses',
  },
  {
    key: 'questions_total',
    label: 'Questions written',
    sql: 'SELECT count(*)::int AS n FROM questions',
    docs: [{ file: 'STATUS.md', pattern: /([\d,]+) questions written/g }],
  },
  {
    key: 'questions_active',
    label: 'Questions active (reach a reader)',
    sql: 'SELECT count(*)::int AS n FROM questions WHERE is_active',
    docs: [
      { file: 'README.md', pattern: /([\d,]+) active questions/g },
      { file: 'STATUS.md', pattern: /([\d,]+) of them active/g },
    ],
  },
  {
    key: 'countries_rows',
    label: 'Rows in countries (6 of them are aggregates)',
    sql: 'SELECT count(*)::int AS n FROM countries',
  },
  {
    key: 'countries_with_data',
    label: 'Countries holding any observation',
    sql: `SELECT count(DISTINCT country_iso3)::int AS n
            FROM observations WHERE country_iso3 IS NOT NULL`,
    volatile: true,
  },
  {
    key: 'countries_thin',
    label: 'Of those, carrying six indicators or fewer',
    sql: `SELECT count(*)::int AS n FROM (
            SELECT country_iso3 FROM observations
             WHERE country_iso3 IS NOT NULL
             GROUP BY 1 HAVING count(DISTINCT indicator_id) <= 6) t`,
    volatile: true,
  },
  {
    key: 'usa_indicators',
    label: 'Indicators the USA carries (the deepest country)',
    sql: `SELECT count(DISTINCT indicator_id)::int AS n
            FROM observations WHERE country_iso3 = 'USA'`,
    volatile: true,
    docs: [{ file: 'README.md', pattern: /the US, ([\d,]+) indicators/g }],
  },
  {
    key: 'documents',
    label: 'Documents (news, papers, Fed releases)',
    sql: 'SELECT count(*)::int AS n FROM documents',
    volatile: true,
    docs: [{ file: 'README.md', pattern: /([\d,]+) documents in all/g }],
  },
  {
    key: 'narrations',
    label: 'Narrations stored (machine prose that passed the gate)',
    sql: 'SELECT count(*)::int AS n FROM narrations',
    volatile: true,
    docs: [{ file: 'README.md', pattern: /([\d,]+) narrations are stored/g }],
  },
  {
    key: 'narrations_simulation',
    label: 'Of those, written for a simulation',
    sql: `SELECT count(*)::int AS n FROM narrations WHERE scope LIKE 'sim:%'`,
    volatile: true,
    docs: [{ file: 'README.md', pattern: /([\d,]+) rows with a `sim:` scope/g }],
  },
  /*
   * Lens pages whose stored prose has fallen behind the tickers beside it.
   *
   * This one is here because README.md described the mechanism wrongly twice
   * running, in opposite directions — first claiming a warning that no caller
   * could fire, then, after the prop was wired, claiming it still could not.
   * A sentence about whether a safeguard fires is not checkable by eye, so it
   * became a number.
   *
   * The query reproduces the page rather than approximating it: the same row
   * `getLens` would show (newest non-expired narration at the CURRENT prompt
   * version), the same latest period `getLensTickers` computes including its
   * default-country filter, and the same `narrationPeriod < tickerPeriod`
   * comparison `narrationStaleness` makes in lib/format.js. Verified against
   * that code path on 2026-09-04: both agree on prices and regulation.
   */
  {
    key: 'narrations_stale',
    label: 'Lens pages showing the "figures have moved on" warning',
    sql: `WITH shown AS (
            SELECT DISTINCT ON (n.scope) n.scope, n.grounding
              FROM narrations n
             WHERE n.scope LIKE 'lens:%'
               AND n.prompt_version = '${PROMPT_VERSION}'
               AND (n.expires_at IS NULL OR n.expires_at > now())
             ORDER BY n.scope, n.generated_at DESC
          ), narration_period AS (
            SELECT s.scope, max((e ->> 'period')::date) AS p
              FROM shown s, jsonb_array_elements(s.grounding -> 'series') e
             WHERE e ->> 'period' IS NOT NULL
             GROUP BY 1
          ), ticker_period AS (
            SELECT 'lens:' || l.slug AS scope, max(o.period_start) AS p
              FROM lens_tickers t
              JOIN lenses l       ON l.id = t.lens_id AND l.is_active
              JOIN indicators i   ON i.id = t.indicator_id
              JOIN observations o ON o.indicator_id = i.id
             WHERE o.value IS NOT NULL
               AND (NOT i.has_country_dim
                    OR i.default_country_iso3 IS NULL
                    OR o.country_iso3 = i.default_country_iso3)
             GROUP BY 1
          )
          SELECT count(*)::int AS n
            FROM narration_period np JOIN ticker_period tp USING (scope)
           WHERE np.p < tp.p`,
    volatile: true,
    docs: [{ file: 'README.md', pattern: /\*\*([\d,]+) of the 5 lens pages\*\*/g }],
  },
  {
    key: 'report_figures',
    label: 'Report figures read out of PDFs',
    sql: 'SELECT count(*)::int AS n FROM report_figures',
    docs: [{ file: 'README.md', pattern: /([\d,]+) charts read out of/g }],
  },
  {
    key: 'report_figure_points',
    label: 'Data points behind them',
    sql: 'SELECT count(*)::int AS n FROM report_figure_points',
    docs: [{ file: 'README.md', pattern: /([\d,]+) data points/g }],
  },
  {
    key: 'events',
    label: 'Circular-financing events',
    sql: 'SELECT count(*)::int AS n FROM events',
  },
  {
    key: 'entities',
    label: 'Entities behind them',
    sql: 'SELECT count(*)::int AS n FROM entities',
  },
  {
    key: 'sim_scenarios',
    label: 'Simulation scenarios',
    sql: 'SELECT count(*)::int AS n FROM simulation_scenarios',
    docs: [{ file: 'STATUS.md', pattern: /([\d,]+) scenario row/g }],
  },
  {
    key: 'sim_inputs',
    label: 'Simulation inputs (sliders)',
    sql: 'SELECT count(*)::int AS n FROM simulation_inputs',
  },
  {
    key: 'sim_parameters',
    label: 'Simulation parameters (every one cited)',
    sql: 'SELECT count(*)::int AS n FROM simulation_parameters',
    docs: [{ file: 'STATUS.md', pattern: /([\d,]+) cited parameter rows/g }],
  },
  {
    key: 'sim_runs',
    label: 'Simulation runs cached',
    sql: 'SELECT count(*)::int AS n FROM simulation_runs',
    volatile: true,
  },
  {
    key: 'tables',
    label: 'Tables in public',
    sql: `SELECT count(*)::int AS n FROM information_schema.tables
           WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    docs: [{ file: 'STATUS.md', pattern: /([\d,]+) tables and/g }],
  },
  {
    key: 'views',
    label: 'Views in public',
    sql: `SELECT count(*)::int AS n FROM pg_views WHERE schemaname = 'public'`,
    docs: [{ file: 'STATUS.md', pattern: /tables and ([\d,]+) views/g }],
  },
  {
    key: 'migrations_applied',
    label: 'Migrations applied',
    sql: 'SELECT count(*)::int AS n FROM schema_migrations',
    docs: [{ file: 'STATUS.md', pattern: /\*\*([\d,]+) applied\*\*/g }],
  },

  /*
   * On-disk counts, not row counts — and the gap between the two is the point.
   *
   * A migration file that exists and has not run, and a seed file that exists
   * and has not been loaded, are the two states in which the repository and the
   * database disagree about what this project is. STATUS.md quotes both numbers
   * and had both wrong (26 and 43 against a tree holding 27 and 45), which is
   * the drift these two figures now make impossible to leave standing.
   */
  {
    key: 'migration_files',
    label: 'Migration files on disk',
    files: 'db/migrations',
    docs: [{ file: 'STATUS.md', pattern: /([\d,]+) migration files on disk/g }],
  },
  {
    key: 'seed_files',
    label: 'Seed files on disk',
    files: 'db/seeds',
    docs: [{ file: 'STATUS.md', pattern: /([\d,]+) seed files/g }],
  },
];

/**
 * The tables nothing in the app reads, and the worklist views nothing queries.
 *
 * Both lists are here rather than in prose because both are questions a reader
 * of STATUS.md asks and cannot answer without a psql session: is this empty
 * table a bug or a decision, and how much of the review backlog is left. The
 * counts move, so the file quotes them with a date and this prints today's.
 */
const UNREAD_TABLES = [
  ['assets', 'phase-3 satellite work that does not exist yet'],
  ['asset_imagery', 'same'],
  ['derived_metrics', 'never used — candidate for a drop migration'],
  ['companies', 'superseded by entities'],
  ['policy_classifications', 'deliberate keep — reasoning in db/seeds/028'],
  ['entity_aliases', 'seeded twice, read by nothing — decide'],
];

const WORKLIST_VIEWS = [
  ['unreviewed_figures', 'report figures no person has checked'],
  ['unreviewed_takeaways', 'report takeaways no person has checked'],
  ['stale_questions', 'active pages whose prose has drifted from its data'],
  ['indicator_freshness', 'every series with its own refresh interval'],
  ['research_candidates', 'OpenAlex papers not yet promoted to a reading list'],
  ['financing_edges', 'capital and commercial legs between entities'],
];

/**
 * Sentences README.md makes about the CODE, each with the assertion that keeps
 * them true. Not figures — these have no number in them at all.
 *
 * WHY THIS IS HERE AND NOT LEFT TO A READER
 *
 * The single worst thing this repository has published was not a stale count.
 * It was a paragraph describing a safeguard, in a public README, that no code
 * path delivered — and then, after the prop was wired, the same paragraph
 * describing it as still dead. Both directions were written in good faith by
 * somebody who had read the component and not the caller, which is exactly the
 * mistake a person makes and a grep does not.
 *
 * A count that drifts is embarrassing. A safety claim that drifts is the whole
 * pitch of the project being false on its front page, so it gets a gate.
 *
 * `element` isolates one JSX element by name — non-greedy to the first `/>`, so
 * it takes the mount site and not the rest of the file — and `contains` /
 * `absent` say which props must and must not be on it. A claim that matches no
 * element at all is a FAILURE of the gate rather than a pass, for the same
 * reason a doc pattern matching nothing is: silence is not agreement.
 */
const CODE_CLAIMS = [
  {
    file: 'src/client/routes/LensPage.jsx',
    element: 'NarrationBlock',
    contains: 'tickers',
    says: 'README: the staleness warning fires on lens pages — it needs this prop',
  },
  {
    file: 'src/client/routes/SimulationPage.jsx',
    element: 'NarrationBlock',
    absent: 'tickers',
    says: 'README: "the simulation page mounts the same block with `narration` alone"',
  },
];

/** The one JSX element named, or an explanation of why the claim cannot be checked. */
function elementIn(file, name) {
  let text;
  try {
    text = readFileSync(join(ROOT, file), 'utf8');
  } catch {
    return { error: `${file} could not be read` };
  }
  const found = text.match(new RegExp(`<${name}\\b[\\s\\S]*?/>`));
  if (!found) return { error: `${file} mounts no <${name} … /> — the claim is checking nothing` };
  return { source: found[0] };
}

async function count(sql) {
  const { rows } = await pool.query(sql);
  return rows[0].n;
}

/** `.sql` files directly inside a repo-relative directory. */
function countFiles(dir) {
  return readdirSync(join(ROOT, dir)).filter((f) => f.endsWith('.sql')).length;
}

/** A figure's value, and the one-line command a reader can run to reproduce it. */
async function measure(figure) {
  if (figure.files) {
    return { value: countFiles(figure.files), how: `ls ${figure.files}/*.sql | wc -l` };
  }
  return { value: await count(figure.sql), how: figure.sql.replace(/\s+/g, ' ') };
}

/**
 * Read a stated figure out of a doc. Exactly one match, or it is a gate bug.
 *
 * Whitespace is collapsed before matching, because these files are hard-wrapped
 * at 80 columns and a phrase that happens to straddle a line break would
 * otherwise silently match nothing — a gate quietly checking nothing is worse
 * than no gate, so that case is reported rather than passed over.
 */
function statedIn(file, pattern) {
  let text;
  try {
    text = readFileSync(join(ROOT, file), 'utf8').replace(/\s+/g, ' ');
  } catch {
    return { error: `${file} could not be read` };
  }
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) {
    return { error: `${file} has no text matching ${pattern} — the gate is checking nothing` };
  }
  if (matches.length > 1) {
    return { error: `${file} matches ${pattern} ${matches.length} times — the gate cannot tell which figure it is checking` };
  }
  return { value: Number(matches[0][1].replace(/,/g, '')) };
}

const check = process.argv.includes('--check');
const write = process.argv.includes('--write');

const measured = [];
for (const figure of FIGURES) {
  measured.push({ ...figure, ...(await measure(figure)) });
}

const unread = [];
for (const [table, note] of UNREAD_TABLES) {
  unread.push({ table, note, value: await count(`SELECT count(*)::int AS n FROM ${table}`) });
}

const worklists = [];
for (const [view, note] of WORKLIST_VIEWS) {
  worklists.push({ view, note, value: await count(`SELECT count(*)::int AS n FROM ${view}`) });
}

await closePool();

const today = new Date().toISOString().slice(0, 10);
const n = (v) => v.toLocaleString('en-GB');
const widest = Math.max(...measured.map((f) => f.label.length));
const by = Object.fromEntries(measured.map((f) => [f.key, f.value]));

/** The one line README.md leads with, exactly as this script would write it. */
const headline =
  `**${n(by.observations)} observations · ${n(by.indicators_with_data)} ` +
  `indicators with data · ${n(by.sources)} sources**`;

/*
 * --write: regenerate README.md's headline and its measurement date.
 *
 * Two anchors, each of which must match EXACTLY ONCE. A rewriter that silently
 * matched nothing would report success having changed nothing — the same
 * always-green failure the --check gate is built to avoid — and one that
 * matched twice would not know which line it was rewriting. Both are refused
 * rather than guessed at, and the file is written only when something changed,
 * so re-running is a no-op rather than a fresh timestamp on unchanged numbers.
 */
if (write) {
  const path = join(ROOT, 'README.md');
  const before = readFileSync(path, 'utf8');

  const anchors = [
    {
      what: 'the headline figures',
      pattern: /^\*\*[\d,]+ observations · [\d,]+ indicators with data · [\d,]+ sources\*\*$/gm,
      replacement: headline,
    },
    {
      what: 'the measurement date',
      pattern: /Measured against the live database on \d{4}-\d{2}-\d{2}/g,
      replacement: `Measured against the live database on ${today}`,
    },
  ];

  let after = before;
  const changes = [];
  for (const anchor of anchors) {
    const found = [...before.matchAll(anchor.pattern)];
    if (found.length !== 1) {
      console.error(
        `\n${RED}✗ README.md holds ${found.length} lines matching ${anchor.what}${RESET}` +
          `\n  ${anchor.pattern}` +
          `\n${DIM}  --write rewrites exactly one of each and refuses to guess. Fix the file, or the pattern.${RESET}\n`
      );
      process.exit(1);
    }
    if (found[0][0] !== anchor.replacement) changes.push(`${found[0][0]}  →  ${anchor.replacement}`);
    after = after.replace(anchor.pattern, anchor.replacement);
  }

  if (changes.length === 0) {
    console.log(`${GREEN}✓${RESET} README.md headline already matches the database ${DIM}(${today})${RESET}`);
    process.exit(0);
  }

  writeFileSync(path, after);
  console.log(`${GREEN}✓${RESET} README.md rewritten from the database`);
  for (const c of changes) console.log(`  ${c}`);
  process.exit(0);
}

if (!check) {
  console.log(`\n${BOLD}Diffusion — the figures the docs quote${RESET}  ${DIM}${today}${RESET}\n`);
  for (const f of measured) {
    const kind = f.volatile ? `${DIM}moves on its own${RESET}` : `${DIM}structural${RESET}`;
    console.log(`  ${f.label.padEnd(widest)}  ${BOLD}${n(f.value).padStart(7)}${RESET}  ${kind}`);
    console.log(`  ${DIM}${' '.repeat(widest)}  ${f.how}${RESET}`);
  }

  console.log(`\n${BOLD}Tables no JavaScript reads${RESET}`);
  for (const t of unread) {
    console.log(`  ${t.table.padEnd(24)} ${n(t.value).padStart(5)} rows   ${DIM}${t.note}${RESET}`);
  }

  console.log(`\n${BOLD}Worklist views — nothing in the app queries these; they are for a person${RESET}`);
  for (const w of worklists) {
    console.log(`  ${w.view.padEnd(24)} ${n(w.value).padStart(5)} rows   ${DIM}${w.note}${RESET}`);
  }
  console.log(`  ${DIM}SELECT * FROM <view>;${RESET}`);

  console.log(`\n${BOLD}Paste-ready${RESET}`);
  console.log(`  README:  ${headline}   ${DIM}(or run --write and stop pasting)${RESET}`);
  console.log(
    `  STATUS:  ${n(by.tables)} tables and ${n(by.views)} views · ` +
      `${n(by.migration_files)} migration files on disk, **${n(by.migrations_applied)} applied** · ` +
      `${n(by.seed_files)} seed files · ` +
      `${n(by.indicators_declared)} indicators declared · ` +
      `${n(by.questions_total)} questions written, ${n(by.questions_active)} of them active`
  );
  console.log(
    `\n  ${DIM}Test count is not a database fact — run npm test.${RESET}\n`
  );
  process.exit(0);
}

// --check
const problems = [];
const drifted = [];
let attempted = 0;

for (const f of measured) {
  for (const doc of f.docs ?? []) {
    attempted += 1;
    const stated = statedIn(doc.file, doc.pattern);
    if (stated.error) {
      problems.push({ figure: f, doc, message: stated.error });
      continue;
    }
    if (stated.value !== f.value) {
      const row = { figure: f, doc, stated: stated.value };
      if (f.volatile) drifted.push(row);
      else
        problems.push({
          ...row,
          message:
            `${doc.file} says ${n(stated.value)}, ` +
            `${f.files ? `${f.files}/ holds` : 'the database holds'} ${n(f.value)}`,
        });
    }
  }
}

/*
 * The code claims. Structural by definition — a prop only appears or disappears
 * because somebody edited the file — so every failure here exits 1.
 */
let claimsChecked = 0;
for (const claim of CODE_CLAIMS) {
  claimsChecked += 1;
  const { error, source } = elementIn(claim.file, claim.element);
  if (error) {
    problems.push({ figure: { label: claim.says }, message: error });
    continue;
  }
  if (claim.contains && !source.includes(claim.contains)) {
    problems.push({
      figure: { label: claim.says },
      message:
        `${claim.file} mounts <${claim.element}> WITHOUT \`${claim.contains}\` — ` +
        `the README says it passes it:\n    ${source.replace(/\s+/g, ' ')}`,
    });
  }
  if (claim.absent && source.includes(claim.absent)) {
    problems.push({
      figure: { label: claim.says },
      message:
        `${claim.file} now mounts <${claim.element}> WITH \`${claim.absent}\` — ` +
        `the README says it does not:\n    ${source.replace(/\s+/g, ' ')}`,
    });
  }
}

for (const d of drifted) {
  console.log(
    `${YELLOW}·${RESET} ${d.doc.file} says ${n(d.stated)} ${d.figure.label.toLowerCase()}, ` +
      `now ${n(d.figure.value)} ${DIM}— moves on its own, not a failure${RESET}`
  );
}

if (problems.length === 0) {
  console.log(
    `${GREEN}✓${RESET} docs agree with the database ` +
      `${DIM}(${attempted} figures checked, ${drifted.length} moved since they were written; ` +
      `${claimsChecked} code claims hold)${RESET}`
  );
  process.exit(0);
}

for (const p of problems) {
  console.error(`\n${RED}✗ ${p.figure.label}${RESET}`);
  console.error(`  ${p.message}`);
}
console.error(
  `\n${RED}✗ ${problems.length} of ${attempted + claimsChecked} checks failed${RESET}` +
    `\n${DIM}Run npm run status:figures for today's numbers and the query behind each.${RESET}`
);
process.exit(1);
