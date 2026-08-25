/**
 * Ingestion runner.
 *
 * Wraps every job in an audit record, so a silently-failing feed is visible
 * rather than merely producing stale charts. Silent staleness is the normal
 * way a dashboard like this rots: the page still renders, the numbers are just
 * quietly months old, and nobody notices for a quarter.
 *
 * Usage:
 *   node src/server/ingestion/runner.js            run all due jobs
 *   node src/server/ingestion/runner.js fred        run one job group
 *   node src/server/ingestion/runner.js --force     ignore refresh intervals
 */

import { fileURLToPath } from 'node:url';

import { query, closePool } from '../db/pool.js';
import { config } from '../config.js';
import { upsertObservations, touchIndicator } from '../repositories/observations.js';
import * as fred from './sources/fred.js';
import * as worldbank from './sources/worldbank.js';
import * as epoch from './sources/epoch.js';
import * as federalRegister from './sources/federal-register.js';
import * as dbnomics from './sources/dbnomics.js';
import * as gdelt from './sources/gdelt.js';
import * as sec from './sources/sec.js';

/**
 * Open a run record. Every job gets one whether it succeeds or fails — a run
 * that vanishes on failure is exactly the run you needed to see.
 */
async function startRun(jobName, sourceId) {
  const { rows } = await query(
    `INSERT INTO ingestion_runs (job_name, source_id, status)
     VALUES ($1, $2, 'running') RETURNING id`,
    [jobName, sourceId]
  );
  return rows[0].id;
}

async function finishRun(runId, { status, written = 0, skipped = 0, error = null, details = null }) {
  await query(
    `UPDATE ingestion_runs
        SET status = $2, finished_at = now(), rows_written = $3,
            rows_skipped = $4, error_message = $5, details = $6
      WHERE id = $1`,
    [runId, status, written, skipped, error, details ? JSON.stringify(details) : null]
  );
}

/**
 * Which indicators are due for a refresh.
 *
 * Comparing `last_ingested_at + refresh_interval` against now() in SQL keeps
 * the scheduling decision next to the data it concerns, and means a restarted
 * process picks up exactly where it left off with no in-memory state to lose.
 */
async function dueIndicators({ sourceId = null, force = false } = {}) {
  const { rows } = await query(
    `SELECT id, source_id, source_series_code, cadence, default_country_iso3
       FROM indicators
      WHERE is_active
        AND source_series_code IS NOT NULL
        AND ($1::text IS NULL OR source_id = $1)
        AND ($2::boolean
             OR last_ingested_at IS NULL
             OR last_ingested_at + COALESCE(refresh_interval, INTERVAL '1 day') < now())
      ORDER BY source_id, id`,
    [sourceId, force]
  );
  return rows;
}

/** Ingest one FRED-backed indicator. */
async function ingestFredIndicator(indicator) {
  const runId = await startRun(`fred:${indicator.id}`, 'fred');
  try {
    const observations = await fred.fetchSeries(indicator.source_series_code, {
      indicatorId: indicator.id,
    });
    const { written, skipped } = await upsertObservations(observations);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped,
      details: { fetched: observations.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/** Ingest one World Bank-backed indicator across all seeded countries. */
async function ingestWorldBankIndicator(indicator) {
  const runId = await startRun(`worldbank:${indicator.id}`, 'worldbank');
  try {
    // Request only countries we actually have rows for. Asking for 'all' would
    // return ~260 entities, most of which would fail the foreign key and be
    // discarded — wasted bandwidth on someone else's free service.
    const { rows: countries } = await query(
      'SELECT iso3 FROM countries ORDER BY iso3'
    );
    const codes = countries.map((c) => c.iso3);

    const observations = await worldbank.fetchIndicator(
      indicator.source_series_code,
      { countries: codes, indicatorId: indicator.id }
    );

    // Drop observations for countries not in our dimension table. The API
    // occasionally returns entities we did not ask for; inserting them would
    // violate the foreign key and abort the whole batch.
    const known = new Set(codes);
    const filtered = observations.filter((o) => known.has(o.countryIso3));

    const { written, skipped } = await upsertObservations(filtered);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped: skipped + (observations.length - filtered.length),
      details: { fetched: observations.length, unknownCountries: observations.length - filtered.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/**
 * Ingest one Epoch AI indicator.
 *
 * Dispatches on indicator id rather than source id because this one source
 * backs two structurally different series — a running maximum over model
 * training runs, and a count of known clusters per country per year. They share
 * a provider and nothing else.
 */
async function ingestEpochIndicator(indicator) {
  const runId = await startRun(`epoch:${indicator.id}`, 'epoch_ai');
  try {
    let observations;
    switch (indicator.id) {
      case 'epoch.training_compute_frontier':
        observations = await epoch.ingestFrontierCompute();
        break;
      case 'epoch.gpu_cluster_count':
        observations = await epoch.ingestGpuClusters();
        break;
      default:
        throw new Error(`No Epoch job defined for indicator "${indicator.id}"`);
    }

    const { written, skipped } = await upsertObservations(observations);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped,
      details: { fetched: observations.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/**
 * Ingest one DBnomics-backed indicator.
 *
 * DBnomics mirrors 93 statistical agencies behind one API, which is what makes
 * genuinely global coverage a configuration problem rather than 93 adapters.
 * One series here can come from ONS, Eurostat, China's NBS or the Bank of
 * Japan; the provider is the first segment of the series path.
 *
 * The country is carried on the indicator rather than parsed out of the series
 * code. Provider code layouts differ wildly and share no convention, so
 * inferring geography from the string would be guesswork — and a series
 * attributed to the wrong country is worse on a map than one that is absent.
 */
async function ingestDbnomicsIndicator(indicator) {
  const runId = await startRun(`dbnomics:${indicator.id}`, 'dbnomics');
  try {
    const observations = await dbnomics.fetchSeries(indicator.source_series_code, {
      indicatorId: indicator.id,
      countryIso3: indicator.default_country_iso3 ?? null,
    });

    const { written, skipped } = await upsertObservations(observations);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped,
      details: { fetched: observations.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

const HANDLERS = {
  fred: ingestFredIndicator,
  worldbank: ingestWorldBankIndicator,
  epoch_ai: ingestEpochIndicator,
  dbnomics: ingestDbnomicsIndicator,
};

/**
 * DERIVED JOBS — the second kind of ingestion.
 *
 * `dueIndicators` requires `source_series_code IS NOT NULL`, because a fetch
 * job needs something to fetch. Nine indicators in the catalogue are
 * `derived.*`: they have no upstream code because they are COMPUTED rather than
 * retrieved. You cannot ask an API for "AI regulation volume" — you fetch
 * several hundred documents, deduplicate them and count them by month.
 *
 * Those indicators were therefore invisible to the runner entirely. They did
 * not even appear as skips, because the WHERE clause excluded them before the
 * loop saw them — the worst kind of gap, since nothing reports it.
 *
 * Keyed by indicator id rather than source id: a derived indicator's identity
 * IS its computation, and two derived indicators from the same source are
 * usually unrelated calculations.
 *
 * Each function returns ObservationInput[] and is responsible for its own
 * fetching. Absent entries are reported as unimplemented rather than skipped
 * silently, so an empty chart always has a stated reason.
 */
const DERIVED_JOBS = {
  'derived.ai_regulation_volume': async () => {
    // fetchAiDocuments returns { documents, truncated } — the wrapper exists so
    // a capped result cannot be mistaken for a complete one.
    const { documents, truncated } = await federalRegister.fetchAiDocuments();
    if (truncated) {
      console.warn(
        '  note  federal register results were truncated by the per-term page cap; ' +
          'regulatory volume is a lower bound for the affected months'
      );
    }
    return federalRegister.toMonthlyCounts(documents);
  },

  /**
   * Installed data-centre power capacity, from Epoch's cluster register.
   *
   * This indicator was previously recorded as having no free source anywhere.
   * That was wrong: the same CSV backing gpu_cluster_count carries a
   * 'Power Capacity (MW)' column, populated for 418 of 482 clusters. Nobody
   * had read past the columns already in use.
   */
  'derived.datacentre_capacity_mw': async () => epoch.ingestDatacentreCapacity(),

  /**
   * AI-economics news as a share of all global news coverage, monthly to 2017.
   *
   * A share rather than a count: GDELT's crawler has grown over the period, so
   * raw matches would rise even if the world's attention had not moved. The
   * denominator is what makes the series about AI rather than about GDELT.
   */
  'derived.ai_news_volume': async () => gdelt.ingestNewsVolume(),

  /**
   * Share of US annual reports mentioning AI.
   *
   * A 10-K is a legal filing: overstating AI involvement in one carries
   * liability that a press release does not, so this measures corporate
   * commitment under a far higher standard of truth than any survey.
   */
  'derived.sec_ai_mention_rate': async () => sec.computeAiMentionRate(),

  /**
   * Federal Register counts split by document type.
   *
   * All three share one fetch of several hundred documents, so they are cheap
   * to compute together, but they answer different questions: a Rule is law, a
   * Proposed Rule is an intention, an executive order is a gesture that can be
   * undone by the next administration.
   */
  'derived.ai_binding_rules': async () => {
    const { documents } = await federalRegister.fetchAiDocuments();
    return federalRegister.toMonthlyCountsByType(documents, 'Rule', 'derived.ai_binding_rules');
  },

  'derived.ai_proposed_rules': async () => {
    const { documents } = await federalRegister.fetchAiDocuments();
    return federalRegister.toMonthlyCountsByType(documents, 'Proposed Rule', 'derived.ai_proposed_rules');
  },

  'derived.ai_presidential_documents': async () => {
    const { documents } = await federalRegister.fetchAiDocuments();
    return federalRegister.toMonthlyCountsByType(documents, 'Presidential Document', 'derived.ai_presidential_documents');
  },

  /**
   * Ratios computed in SQL from observations already held.
   *
   * Done in SQL rather than JavaScript because the join on period is exactly
   * what a database is for, and because the definition of the ratio then lives
   * in one place instead of being re-derived by whatever reads it.
   */
  'derived.information_employment_share': async () => {
    const { rows } = await query(
      `SELECT info.period_start::text AS period_start,
              info.period_end::text   AS period_end,
              (info.value / total.value) * 100 AS value
         FROM observations info
         JOIN observations total
           ON total.indicator_id = 'fred.PAYEMS'
          AND total.period_start = info.period_start
        WHERE info.indicator_id = 'fred.USINFO'
          AND info.value IS NOT NULL
          AND total.value IS NOT NULL
          AND total.value > 0
        ORDER BY info.period_start`
    );
    return rows.map((r) => ({
      indicatorId: 'derived.information_employment_share',
      countryIso3: 'USA',
      periodStart: r.period_start,
      periodEnd: r.period_end,
      value: Number(r.value),
      sourceRef: 'computed: fred.USINFO / fred.PAYEMS',
    }));
  },

  'derived.productivity_gap_mfg_vs_total': async () => {
    const { rows } = await query(
      `WITH paired AS (
         SELECT m.period_start, m.period_end, m.value AS mfg, t.value AS total
           FROM observations m
           JOIN observations t
             ON t.indicator_id = 'fred.OPHNFB'
            AND t.period_start = m.period_start
          WHERE m.indicator_id = 'fred.OPHMFG'
            AND m.value IS NOT NULL AND t.value IS NOT NULL AND t.value > 0
       ),
       base AS (SELECT (mfg / total) AS r FROM paired ORDER BY period_start LIMIT 1)
       SELECT p.period_start::text AS period_start,
              p.period_end::text   AS period_end,
              ((p.mfg / p.total) / b.r) * 100 AS value
         FROM paired p CROSS JOIN base b
        ORDER BY p.period_start`
    );
    return rows.map((r) => ({
      indicatorId: 'derived.productivity_gap_mfg_vs_total',
      countryIso3: 'USA',
      periodStart: r.period_start,
      periodEnd: r.period_end,
      value: Number(r.value),
      sourceRef: 'computed: fred.OPHMFG / fred.OPHNFB, indexed to first shared period',
    }));
  },
};

/** Derived indicators that are due, i.e. the ones `dueIndicators` cannot see. */
async function dueDerivedIndicators({ force = false } = {}) {
  const { rows } = await query(
    `SELECT id, source_id, cadence
       FROM indicators
      WHERE is_active
        AND source_series_code IS NULL
        AND ($1::boolean
             OR last_ingested_at IS NULL
             OR last_ingested_at + COALESCE(refresh_interval, INTERVAL '1 day') < now())
      ORDER BY id`,
    [force]
  );
  return rows;
}

/** Run one derived job inside the same audit wrapper as a fetch job. */
async function runDerivedJob(indicator) {
  const runId = await startRun(`derived:${indicator.id}`, indicator.source_id);
  try {
    const observations = await DERIVED_JOBS[indicator.id]();
    const { written, skipped } = await upsertObservations(observations);
    await touchIndicator(indicator.id);
    await finishRun(runId, {
      status: 'succeeded',
      written,
      skipped,
      details: { computed: observations.length },
    });
    return { written, skipped, fetched: observations.length };
  } catch (error) {
    await finishRun(runId, { status: 'failed', error: error.message });
    throw error;
  }
}

/**
 * Run all due ingestion jobs.
 *
 * One failing indicator must not abort the rest: sources fail independently,
 * and a FRED outage should not cost us the World Bank refresh. Failures are
 * recorded and reported at the end.
 */
export async function runIngestion({ sourceId = null, force = false } = {}) {
  const indicators = await dueIndicators({ sourceId, force });

  /**
   * No early return when the fetch list is empty.
   *
   * This used to return here, which made the derived pass below reachable only
   * when at least one FETCH job happened to be due. Derived indicators refresh
   * on their own schedule and frequently have none — so a newly added
   * computation would print "Nothing due", never run, and leave an empty chart
   * with nothing in the audit log to explain it.
   */
  if (indicators.length > 0) {
    console.log(`Ingesting ${indicators.length} indicator(s)…\n`);
  }

  let succeeded = 0;
  let failed = 0;
  let totalWritten = 0;
  const failures = [];

  for (const indicator of indicators) {
    const handler = HANDLERS[indicator.source_id];

    if (!handler) {
      console.log(`  skip  ${indicator.id}  (no handler for source "${indicator.source_id}")`);
      continue;
    }

    try {
      const { written, fetched } = await handler(indicator);
      totalWritten += written;
      succeeded += 1;
      console.log(`  ok    ${indicator.id.padEnd(32)} ${written} written / ${fetched} fetched`);
    } catch (error) {
      failed += 1;
      failures.push({ id: indicator.id, message: error.message.split('\n')[0] });
      console.log(`  FAIL  ${indicator.id.padEnd(32)} ${error.message.split('\n')[0]}`);
    }
  }

  // ── Pass two: derived indicators ──────────────────────────────────────────
  // Run after fetch jobs, not alongside them: a derived metric computed from
  // observations must see this run's fresh data, not the previous run's.
  const derived = await dueDerivedIndicators({ force });
  const unimplemented = [];

  if (derived.length > 0) {
    console.log(`\nComputing ${derived.length} derived indicator(s)…\n`);

    for (const indicator of derived) {
      if (!DERIVED_JOBS[indicator.id]) {
        unimplemented.push(indicator.id);
        console.log(`  todo  ${indicator.id.padEnd(32)} (no computation defined yet)`);
        continue;
      }

      try {
        const { written, fetched } = await runDerivedJob(indicator);
        totalWritten += written;
        succeeded += 1;
        console.log(`  ok    ${indicator.id.padEnd(32)} ${written} written / ${fetched} computed`);
      } catch (error) {
        failed += 1;
        failures.push({ id: indicator.id, message: error.message.split('\n')[0] });
        console.log(`  FAIL  ${indicator.id.padEnd(32)} ${error.message.split('\n')[0]}`);
      }
    }
  }

  console.log(`\n${succeeded} succeeded · ${failed} failed · ${totalWritten} rows written`);

  // Report these explicitly rather than leaving them to be discovered as blank
  // panels. An indicator with no computation is a product decision outstanding,
  // not a bug, but it must be visible either way.
  if (unimplemented.length > 0) {
    console.log(
      `\n${unimplemented.length} derived indicator(s) have no computation defined:\n` +
        unimplemented.map((id) => `  ${id}`).join('\n')
    );
  }

  if (failures.length > 0) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ${f.id}\n    ${f.message}`);
    console.log(
      '\nIf these are "no fixture recorded" errors, this environment has no ' +
      'network access to data providers — run locally or widen the allowlist.'
    );
  }

  return { succeeded, failed, written: totalWritten };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const sourceId = args.find((a) => !a.startsWith('--')) ?? null;

  if (config.useFixtures) {
    console.log(
      'Running in FIXTURE mode (USE_FIXTURES=true). No network calls will be made.\n'
    );
  }

  try {
    const result = await runIngestion({ sourceId, force });
    if (result.failed > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`\nIngestion aborted: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
