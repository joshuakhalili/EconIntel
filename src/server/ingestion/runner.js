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
    `SELECT id, source_id, source_series_code, cadence
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

const HANDLERS = {
  fred: ingestFredIndicator,
  worldbank: ingestWorldBankIndicator,
};

/**
 * Run all due ingestion jobs.
 *
 * One failing indicator must not abort the rest: sources fail independently,
 * and a FRED outage should not cost us the World Bank refresh. Failures are
 * recorded and reported at the end.
 */
export async function runIngestion({ sourceId = null, force = false } = {}) {
  const indicators = await dueIndicators({ sourceId, force });

  if (indicators.length === 0) {
    console.log('Nothing due. Use --force to ingest regardless of refresh interval.');
    return { succeeded: 0, failed: 0, written: 0 };
  }

  console.log(`Ingesting ${indicators.length} indicator(s)…\n`);

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

  console.log(`\n${succeeded} succeeded · ${failed} failed · ${totalWritten} rows written`);

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
