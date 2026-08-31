/**
 * Data integrity verification.
 *
 * WHY THIS EXISTS
 *
 * The design guards next door (`check-tokens.js`, `check-contrast.js`) catch
 * mistakes that make the site look wrong. This one catches the mistakes that
 * make it *say* something wrong, which is worse: a chart with a confident line
 * and the wrong country label does not look broken to anybody.
 *
 * It was written after finding exactly that. Seven OECD youth-unemployment
 * series each held a complete duplicate set of rows tagged 'USA' — so the
 * database asserted US youth unemployment was 16.4% in April 2026, against a
 * real figure near 10%, because those were the UK's numbers. The ingestion code
 * had already been fixed (`runner.js` reads `default_country_iso3` rather than
 * defaulting to USA), but a fix to the writer does not remove what the writer
 * wrote, and `upsertObservations` has no reason to delete a row nobody is
 * overwriting. Nothing anywhere reported a problem, and those seven series are
 * the hero charts on a live page.
 *
 * So the invariant is asserted here rather than assumed: a series that declares
 * which country it describes may not hold observations for a different one.
 *
 * Deliberately NOT wired into `npm run build`. The other two checks read files;
 * this one needs a reachable database, and making a front-end build fail when
 * Postgres is asleep would train people to skip it. It belongs where the data
 * actually changes — after ingestion — and in front of a human before a seed.
 *
 *     npm run check:data
 *
 * Exit code is non-zero if any check fails.
 */

import { pool, closePool } from '../src/server/db/pool.js';
import { __testing as simulationInternals } from '../src/server/lib/simulation.js';

/**
 * Every (model, parameter) pair the engine demands, as SQL rows.
 *
 * Built from the engine's own REQUIRED_PARAMS rather than restated here, so
 * the gate cannot drift from the thing it is guarding. Adding a parameter to a
 * model automatically starts failing every scenario that has not been updated,
 * which is the behaviour you want from a list like this.
 */
const REQUIRED_PARAM_ROWS = Object.entries(simulationInternals.REQUIRED_PARAMS)
  .flatMap(([modelKey, keys]) =>
    keys.map((paramKey) => `('${modelKey}', '${paramKey}')`)
  )
  .join(', ');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Each check returns the rows that VIOLATE it, so an empty result is a pass.
 *
 * Writing them this way — rather than as counts or booleans — means a failure
 * prints what is actually wrong and can be pasted into a fix, instead of
 * sending someone back to the database to ask the same question again.
 */
const CHECKS = [
  {
    name: 'country attribution',
    why: 'A series that declares its country may not hold another country’s rows.',
    /*
     * Only indicators that name a country are checked. World Bank series
     * legitimately carry many countries under one id and leave
     * `default_country_iso3` NULL, so they are exempt by construction rather
     * than by an exception list that would drift.
     */
    sql: `SELECT i.id,
                 i.default_country_iso3 AS declared,
                 o.country_iso3         AS found,
                 count(*)::int          AS rows
            FROM indicators i
            JOIN observations o ON o.indicator_id = i.id
           WHERE i.default_country_iso3 IS NOT NULL
             AND o.country_iso3 IS DISTINCT FROM i.default_country_iso3
           GROUP BY 1, 2, 3
           ORDER BY rows DESC`,
    format: (r) => `${r.id} declares ${r.declared} but holds ${r.rows} rows as ${r.found ?? 'NULL'}`,
  },
  {
    name: 'country dimension flag',
    why: 'The observation-grain trigger aborts the whole ingest batch on this mismatch.',
    sql: `SELECT id, default_country_iso3
            FROM indicators
           WHERE default_country_iso3 IS NOT NULL
             AND NOT has_country_dim
           ORDER BY id`,
    format: (r) => `${r.id} declares country ${r.default_country_iso3} but has_country_dim is false`,
  },
  {
    name: 'unit strings',
    why: 'Units render next to numbers; an ingestion note in one prints as though it were the unit.',
    /*
     * `displayUnit()` in the client truncates these at render, so a violation
     * here is not visible on the site. It is still a failure: the mitigation
     * lives in one formatting helper, and every other consumer of `unit` —
     * the API, a CSV export, anyone reading the database directly — gets the
     * raw string.
     */
    sql: `SELECT id, unit
            FROM indicators
           WHERE unit ~ '\\(' OR length(unit) > 60
           ORDER BY id`,
    format: (r) => `${r.id} — ${JSON.stringify(r.unit)}`,
  },
  {
    name: 'orphaned indicators',
    why: 'An indicator with data that no page shows is data nobody can reach.',
    sql: 'SELECT id FROM orphaned_indicators ORDER BY id',
    format: (r) => `${r.id} has observations but appears on no question`,
  },
  {
    name: 'empty lenses',
    why: 'A lens with no questions renders as a heading over nothing.',
    sql: 'SELECT id FROM empty_lenses ORDER BY id',
    format: (r) => `${r.id} has no active questions`,
  },
  {
    name: 'observation grain',
    why: 'A country on an indicator that has no country dimension cannot be filtered or compared.',
    sql: `SELECT DISTINCT o.indicator_id AS id
            FROM observations o
            JOIN indicators i ON i.id = o.indicator_id
           WHERE o.country_iso3 IS NOT NULL
             AND NOT i.has_country_dim
           ORDER BY 1`,
    format: (r) => `${r.id} stores a country but is not declared country-dimensioned`,
  },
  {
    /*
     * INCOMPLETE parameter sets, which `unrunnable_scenarios` does not catch.
     *
     * That view is `HAVING count(param_key) = 0` — it finds a country with NO
     * coefficients. A country with nine of the ten a model requires passes it
     * cleanly and then throws at request time, because the engine refuses to
     * default a missing parameter. The brief that specified this feature said
     * `check:data` would catch that case. It would not have.
     *
     * The missing keys are aggregated per country so a country with nothing at
     * all reports one line rather than ten.
     */
    name: 'incomplete parameter sets',
    why:
      'A scenario offering a country it has only SOME coefficients for throws at ' +
      'request time, exactly like one with none. The engine will not default a ' +
      'missing parameter, so this is a broken page rather than a wrong number.',
    sql: `WITH required(model_key, param_key) AS (VALUES ${REQUIRED_PARAM_ROWS}),
               offered AS (
                 SELECT s.id, s.model_key, c.iso3
                   FROM simulation_scenarios s
                   CROSS JOIN LATERAL unnest(s.countries) AS c(iso3)
               )
          SELECT o.id,
                 o.iso3                                   AS country_iso3,
                 string_agg(r.param_key, ', ' ORDER BY r.param_key) AS missing
            FROM offered o
            JOIN required r ON r.model_key = o.model_key
            LEFT JOIN simulation_parameters p
                   ON p.scenario_id = o.id
                  AND p.country_iso3 = o.iso3
                  AND p.param_key = r.param_key
           WHERE p.param_key IS NULL
           GROUP BY o.id, o.iso3
           ORDER BY 1, 2`,
    format: (r) => `${r.id} offers ${r.country_iso3} but is missing: ${r.missing}`,
  },
  {
    name: 'unrunnable scenarios',
    why:
      'A scenario offering a country it has no coefficients for throws at request ' +
      'time. The engine refuses to default a missing parameter, so this is a broken ' +
      'page rather than a wrong number — and nobody sees it until a reader does.',
    sql: 'SELECT id, country_iso3 FROM unrunnable_scenarios ORDER BY id, country_iso3',
    format: (r) => `${r.id} offers ${r.country_iso3} but has no parameters for it`,
  },
  {
    name: 'uncited coefficients',
    why:
      'The simulation feature rests entirely on every coefficient tracing to published ' +
      'research. The schema requires a citation; this catches one that is technically ' +
      'present but says nothing a reader could follow.',
    sql: `SELECT scenario_id AS id, country_iso3, param_key
            FROM simulation_parameters
           WHERE citation_url IS NULL
             AND citation_text !~ '[0-9]'
           ORDER BY 1, 2, 3`,
    format: (r) =>
      `${r.id}/${r.country_iso3}/${r.param_key} has no URL and a citation with no year, ` +
      'table or page number in it',
  },
];

/** Rows printed per failing check before the rest are summarised. */
const SHOWN = 8;

const results = [];

for (const check of CHECKS) {
  const { rows } = await pool.query(check.sql);
  results.push({ check, rows });
}

await closePool();

const failed = results.filter((r) => r.rows.length > 0);

for (const { check, rows } of failed) {
  console.error(`\n${RED}✗ ${check.name}${RESET} — ${rows.length} violation(s)`);
  console.error(`  ${DIM}${check.why}${RESET}`);
  for (const row of rows.slice(0, SHOWN)) {
    console.error(`  ${YELLOW}·${RESET} ${check.format(row)}`);
  }
  if (rows.length > SHOWN) {
    console.error(`  ${DIM}… and ${rows.length - SHOWN} more${RESET}`);
  }
}

if (failed.length === 0) {
  console.log(
    `${GREEN}✓${RESET} data integrity clean ` +
      `${DIM}(${CHECKS.length} checks)${RESET}`
  );
  process.exit(0);
}

console.error(
  `\n${RED}✗ ${failed.length} of ${CHECKS.length} checks failed${RESET}` +
    `\n${DIM}A wrong label does not look broken. See the note at the top of this file.${RESET}`
);
process.exit(1);
