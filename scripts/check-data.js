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
import { APP_ROUTES } from './vercel-config.js';

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

/**
 * What each shipped route needs to exist in the database before it is a page.
 *
 * WHY THIS IS HERE, WRITTEN DOWN WHILE IT IS STILL EMBARRASSING
 *
 * /simulate/:slug shipped to production dead. The migration ran, the engine
 * was written and tested, the repository cached runs, the route was registered
 * in App.jsx and in vercel.json, the page rendered — and not one row was ever
 * inserted into `simulation_scenarios`. `listScenarios()` returned `[]`,
 * `getScenario()` returned null, and every visit answered 404.
 *
 * Every gate this project owns passed, and they passed for the same reason:
 * A CONSTRAINT IS A STATEMENT ABOUT ROWS, SO NO CONSTRAINT CAN FAIL ON AN
 * EMPTY TABLE. `unrunnable_scenarios` unnests a column of an absent row and
 * finds nothing to complain about. The "incomplete parameter sets" check below
 * joins against scenarios that do not exist. Both report clean. So does every
 * other check in this file, and so would any check anybody adds in the same
 * shape, because they are all quantified over contents.
 *
 * The only way out of that is to assert against something that is NOT in the
 * database — a list of things the site claims to have — and the route table is
 * exactly that list. A route in APP_ROUTES is a promise made in `vercel.json`
 * and honoured by the CDN: the URL resolves, the shell loads, React mounts.
 * Whether there is anything behind it is a separate question that nothing was
 * asking.
 *
 * `null` means the route genuinely has no content behind it, and each one has
 * to say why. That is deliberately tedious: an entry added carelessly as
 * `null` is how this check gets quietly defeated, and a sentence is cheap
 * insurance against that.
 */
const ROUTE_DATA = {
  '/overview':
    'SELECT count(*) FROM lenses WHERE is_active',
  '/lens/:slug':
    'SELECT count(*) FROM lenses WHERE is_active',
  '/q/:slug':
    'SELECT count(*) FROM questions WHERE is_active',
  '/data':
    'SELECT count(*) FROM indicators WHERE is_active',
  /* Both of these render a chart, so an indicator with a definition and no
     observations is not enough — the page would load and draw nothing. */
  '/data/:id': `SELECT count(*) FROM indicators i
                 WHERE i.is_active
                   AND EXISTS (SELECT 1 FROM observations o WHERE o.indicator_id = i.id)`,
  '/explore': `SELECT count(*) FROM indicators i
                WHERE i.is_active
                  AND EXISTS (SELECT 1 FROM observations o WHERE o.indicator_id = i.id)`,
  '/news':
    'SELECT count(*) FROM documents',
  '/pipeline':
    'SELECT count(*) FROM ingestion_runs',
  /* The one this check was written for. Published, not merely present: a
     drafts-only table is the same 404 with a different cause. */
  '/simulate/:slug':
    "SELECT count(*) FROM simulation_scenarios WHERE status = 'published'",

  /* A sign-in form. It reads `readers` only after someone submits it, and an
     empty `readers` table is the correct state of a site nobody has signed
     into yet — so a row count here would fail on a healthy deployment. */
  '/login': null,
};

/*
 * Fail closed on a route nobody has classified.
 *
 * Without this the check degrades exactly the way the last one did: a new
 * route ships, nobody adds it here, and the gate keeps printing a tick while
 * covering less of the site every release. Adding a route now costs one line
 * in this file, and refusing to write that line is the decision this makes
 * visible.
 */
const unclassified = APP_ROUTES.filter((route) => !(route in ROUTE_DATA));
if (unclassified.length > 0) {
  console.error(
    `\n\x1b[31m✗ routes with no data classification\x1b[0m\n` +
      `  These are in APP_ROUTES but not in ROUTE_DATA in this file, so nothing\n` +
      `  checks whether they have anything behind them:\n    ${unclassified.join('\n    ')}\n\n` +
      `  Add each one: either a "SELECT count(*) …" for the table it needs, or\n` +
      `  null with a comment saying why the route has no content behind it.`
  );
  await closePool();
  process.exit(1);
}

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
    name: 'routes with nothing behind them',
    why:
      'A route that resolves over an empty table is a 404 with a green build. No ' +
      'constraint can catch it, because a constraint is a statement about rows — ' +
      'see ROUTE_DATA above for the one this already cost.',
    /*
     * One query rather than one per route so a failure lists every dead page
     * at once. Each subquery is a scalar count and the wrapper keeps only the
     * zeroes, which is the same "rows returned means broken" contract every
     * other check here honours.
     */
    sql: `SELECT * FROM (
            ${Object.entries(ROUTE_DATA)
              .filter(([, counter]) => counter !== null)
              .map(([route, counter]) => `SELECT '${route}' AS route, (${counter})::int AS rows`)
              .join('\n            UNION ALL ')}
          ) t WHERE rows = 0 ORDER BY route`,
    format: (r) =>
      `${r.route} is a live route in vercel.json with an empty table behind it — ` +
      'it will resolve, load the app shell, and then 404',
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
  {
    /*
     * THE BASE YEAR AN INDEX CLAIMS, AGAINST THE ONE IT HAS.
     *
     * `unit` reaches the axis label verbatim — `displayUnit()` only truncates
     * at a parenthesis or thirty characters — so "index_2017=1" is a sentence
     * the chart says to the reader. It was also wrong. FRED serves the Penn
     * World Table US total factor productivity series rebased to 2021 = 1
     * (2021 reads exactly 1.000000, 2017 reads 0.953378) and this database
     * carried the 2017 label from the day the series was added. Told the wrong
     * base, a reader takes 0.993 in 2023 for a fall below 2017 when it is 4.2%
     * above it — on the one page whose entire argument is whether the residual
     * has moved.
     *
     * An index without its base is not a number, so the claim is checkable and
     * is checked here: whatever period the unit names, the series has to take
     * the value it names in that period. Annual, quarterly and monthly bases
     * are all parsed, because the units in use include "index_2017=100",
     * "Index Dec 1998=100" and "Index, observed base 2025 Q4 = 100".
     *
     * TOLERANCE, AND WHY IT IS NOT ZERO. The base period is compared as a mean
     * over its months, and a seasonally adjusted or chain-linked series does
     * not average to exactly 100 over its own base year: across the 24 indexed
     * series currently active the largest legitimate deviation is
     * derived.productivity_gap_mfg_vs_total at 100.3627 against a claimed 100,
     * 0.363% off. 0.5% is the smallest round tolerance that admits every
     * correct series, and the defect it was written for is 4.7% off, so there
     * is a factor of nine between the two.
     *
     * WHAT IT CANNOT SEE, STATED SO NOBODY TRUSTS IT FURTHER THAN IT GOES. It
     * asserts the VALUE, not the year: relabelling a slow-moving index by one
     * year passes when the neighbouring period happens to sit within 0.5% —
     * moving fred.PCU333242333242 from "Dec 2003" to "Dec 2004" (99.7) is not
     * caught, moving it to "Dec 2010" (90.4) is. And a base period outside the
     * loaded history cannot be checked at all, so those are skipped rather
     * than failed; there are none today.
     */
    name: 'index base years',
    why:
      'An index is meaningless without its base, and the unit string goes straight ' +
      'onto the axis. If the series does not take the value its unit claims in the ' +
      'period its unit names, every level a reader computes from the chart is wrong.',
    sql: `WITH parsed AS (
            SELECT i.id,
                   i.unit,
                   regexp_match(
                     i.unit,
                     '(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[[:space:]]+)?([0-9]{4})([[:space:]]*q([1-4]))?[[:space:]]*=[[:space:]]*([0-9]+(?:\\.[0-9]+)?)',
                     'i') AS m
              FROM indicators i
             WHERE i.is_active
          ),
          claimed AS (
            SELECT id, unit,
                   m[2]::int     AS base_year,
                   lower(m[1])   AS base_month,
                   m[4]::int     AS base_quarter,
                   m[5]::numeric AS base_value
              FROM parsed
             WHERE m IS NOT NULL
          ),
          base_window AS (
            SELECT c.*,
                   CASE
                     WHEN base_month IS NOT NULL
                       THEN make_date(base_year,
                                      position(base_month in 'janfebmaraprmayjunjulaugsepoctnovdec') / 3 + 1,
                                      1)
                     WHEN base_quarter IS NOT NULL
                       THEN make_date(base_year, (base_quarter - 1) * 3 + 1, 1)
                     ELSE make_date(base_year, 1, 1)
                   END AS lo,
                   CASE
                     WHEN base_month   IS NOT NULL THEN interval '1 month'
                     WHEN base_quarter IS NOT NULL THEN interval '3 months'
                     ELSE interval '1 year'
                   END AS span
              FROM claimed c
          )
          SELECT w.id,
                 w.unit,
                 w.base_value,
                 round(avg(o.value), 4) AS actual,
                 count(o.*)::int        AS obs,
                 coalesce(upper(w.base_month) || ' ', '')
                   || w.base_year
                   || coalesce(' Q' || w.base_quarter, '') AS base_period
            FROM base_window w
            JOIN observations o
              ON o.indicator_id = w.id
             AND o.value IS NOT NULL
             AND o.period_start >= w.lo
             AND o.period_start <  w.lo + w.span
           GROUP BY 1, 2, 3, 6
          HAVING abs(avg(o.value) - w.base_value) > 0.005 * abs(w.base_value)
           ORDER BY 1`,
    format: (r) =>
      `${r.id} — unit ${JSON.stringify(r.unit)} claims ${r.base_period} = ${r.base_value}, ` +
      `but the series reads ${r.actual} there (${r.obs} observation(s))`,
  },
  {
    /*
     * DECLARED CADENCE AGAINST THE CADENCE THE DATA ACTUALLY HAS.
     *
     * `SeriesChart` infers cadence per series from the points it is given, so
     * a wrong `cadence` does not break a chart. It breaks everything else:
     * `cadence` is what the catalogue lists, what the indicator page prints
     * and what /api/indicators serves. Four active series disagreed with their
     * own data, two of them against their page's own prose — a reader told the
     * SEC filing rate was quarterly expected four points a year on a chart
     * that has one, and derived.ai_news_volume was declared daily while every
     * row spans a month.
     *
     * THE STATISTIC IS THE MODE, AND THAT CHOICE IS THE WHOLE CHECK.
     * A missing period only ever adds a LARGER gap, never a smaller one, so
     * the mean and the median both drift upward on any series with holes in
     * it. derived.ai_presidential_documents is the case that settles it: its
     * median gap is 60 days and its modal gap is 31, and it is a correctly
     * declared monthly series with empty months. The mode is the publication
     * interval; the long tail is the holes. Partitioned by country, industry
     * and company so a panel is not read as one interleaved series.
     *
     * WHAT IT DELIBERATELY DOES NOT FAULT.
     *   - `irregular` declares no interval, so there is nothing to contradict.
     *     Epoch's record-holder series are irregular by nature.
     *   - Fewer than three gaps: a mode over one or two intervals is noise.
     *   - A modal gap no enum value describes. `cadence` is
     *     (daily, weekly, monthly, quarterly, annual, irregular) — there is no
     *     'semiannual' and no 'biennial'. Both Eurostat electricity price
     *     bands publish every 184 days and the OECD ai_any survey series every
     *     730, and no declaration available to them is true. Faulting a row
     *     for failing to say something the schema cannot hold would make this
     *     gate un-greenable rather than useful. Seed 036 records the migration
     *     that would fix it; until then those series are visible here as
     *     unclassifiable rather than as violations.
     */
    name: 'declared cadence',
    why:
      'cadence is what the catalogue, the indicator page and the API report. A series ' +
      'declared quarterly that publishes once a year promises a reader four points ' +
      'where the chart has one.',
    sql: `WITH gaps AS (
            SELECT o.indicator_id,
                   (o.period_start - lag(o.period_start) OVER (
                      PARTITION BY o.indicator_id, o.country_iso3,
                                   o.industry_code, o.company_id
                      ORDER BY o.period_start))::int AS gap
              FROM observations o
             WHERE o.value IS NOT NULL
          ),
          modal AS (
            SELECT indicator_id,
                   mode() WITHIN GROUP (ORDER BY gap) AS gap_days,
                   count(*)::int                      AS gaps
              FROM gaps
             WHERE gap IS NOT NULL AND gap > 0
             GROUP BY 1
          )
          SELECT i.id,
                 i.cadence::text AS declared,
                 m.gap_days,
                 m.gaps,
                 CASE
                   WHEN m.gap_days BETWEEN   1 AND   3 THEN 'daily'
                   WHEN m.gap_days BETWEEN   6 AND   8 THEN 'weekly'
                   WHEN m.gap_days BETWEEN  27 AND  32 THEN 'monthly'
                   WHEN m.gap_days BETWEEN  88 AND  95 THEN 'quarterly'
                   WHEN m.gap_days BETWEEN 360 AND 371 THEN 'annual'
                 END AS measured
            FROM indicators i
            JOIN modal m ON m.indicator_id = i.id
           WHERE i.is_active
             AND i.cadence <> 'irregular'
             AND m.gaps >= 3
             AND CASE
                   WHEN m.gap_days BETWEEN   1 AND   3 THEN 'daily'
                   WHEN m.gap_days BETWEEN   6 AND   8 THEN 'weekly'
                   WHEN m.gap_days BETWEEN  27 AND  32 THEN 'monthly'
                   WHEN m.gap_days BETWEEN  88 AND  95 THEN 'quarterly'
                   WHEN m.gap_days BETWEEN 360 AND 371 THEN 'annual'
                 END IS DISTINCT FROM i.cadence::text
             AND CASE
                   WHEN m.gap_days BETWEEN   1 AND   3 THEN 'daily'
                   WHEN m.gap_days BETWEEN   6 AND   8 THEN 'weekly'
                   WHEN m.gap_days BETWEEN  27 AND  32 THEN 'monthly'
                   WHEN m.gap_days BETWEEN  88 AND  95 THEN 'quarterly'
                   WHEN m.gap_days BETWEEN 360 AND 371 THEN 'annual'
                 END IS NOT NULL
           ORDER BY i.id`,
    format: (r) =>
      `${r.id} is declared ${r.declared} but publishes every ${r.gap_days} days ` +
      `(modal gap over ${r.gaps} gaps), which is ${r.measured}`,
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
