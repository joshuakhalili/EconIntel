/**
 * Observation persistence.
 *
 * Every ingestion adapter funnels through `upsertObservations`, which means the
 * batching, conflict handling and validation live in exactly one place rather
 * than being re-derived (and re-broken) per source.
 */

import { withTransaction } from '../db/pool.js';

/**
 * How many rows to send per INSERT.
 *
 * Postgres caps a statement at 65535 bound parameters. At 10 parameters per
 * row that is ~6500 rows, so 1000 leaves generous headroom while still cutting
 * round-trips by three orders of magnitude versus row-at-a-time inserts.
 */
const BATCH_SIZE = 1000;

/**
 * @typedef {object} ObservationInput
 * @property {string}  indicatorId
 * @property {string}  periodStart      ISO date, 'YYYY-MM-DD'
 * @property {string}  periodEnd        ISO date, 'YYYY-MM-DD'
 * @property {number|null} value
 * @property {string} [countryIso3]
 * @property {string} [industryCode]
 * @property {number} [companyId]
 * @property {string} [valueStatus]
 * @property {string} [sourceRef]
 * @property {string} [confidenceTier]  omit to inherit from the indicator
 */

/**
 * Insert or update observations.
 *
 * Upsert rather than insert because ingestion is expected to re-run: statistical
 * agencies revise published figures, sometimes years later. A pure insert would
 * either duplicate or fail; overwriting on the dimensional grain means the
 * database always holds the source's current view.
 *
 * @param {ObservationInput[]} observations
 * @returns {Promise<{written: number, skipped: number}>}
 */
export async function upsertObservations(observations) {
  if (observations.length === 0) return { written: 0, skipped: 0 };

  // Reject malformed rows here rather than letting a constraint violation abort
  // an entire batch. One bad row from an upstream API should cost us that row,
  // not the other 999.
  const valid = [];
  let skipped = 0;

  for (const obs of observations) {
    if (!obs.indicatorId || !obs.periodStart || !obs.periodEnd) {
      skipped += 1;
      continue;
    }
    if (obs.value !== null && !Number.isFinite(obs.value)) {
      skipped += 1;
      continue;
    }
    valid.push(obs);
  }

  let written = 0;

  await withTransaction(async (client) => {
    for (let offset = 0; offset < valid.length; offset += BATCH_SIZE) {
      const batch = valid.slice(offset, offset + BATCH_SIZE);

      const params = [];
      const tuples = batch.map((obs, index) => {
        const base = index * 10;
        params.push(
          obs.indicatorId,
          obs.countryIso3 ?? null,
          obs.industryCode ?? null,
          obs.companyId ?? null,
          obs.periodStart,
          obs.periodEnd,
          obs.value ?? null,
          obs.valueStatus ?? null,
          obs.confidenceTier ?? null,
          obs.sourceRef ?? null
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, ` +
               `$${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, ` +
               `$${base + 9}::confidence_tier, $${base + 10})`;
      });

      // ON CONFLICT targets the same COALESCE expression as the unique index.
      // It must match the index definition exactly or Postgres cannot use it
      // and the statement fails at plan time.
      const { rowCount } = await client.query(
        `INSERT INTO observations (
           indicator_id, country_iso3, industry_code, company_id,
           period_start, period_end, value, value_status,
           confidence_tier, source_ref
         )
         VALUES ${tuples.join(', ')}
         ON CONFLICT (
           indicator_id, period_start,
           COALESCE(country_iso3, '~~~'),
           COALESCE(industry_code, '~~~'),
           COALESCE(company_id, -1)
         )
         DO UPDATE SET
           value           = EXCLUDED.value,
           value_status    = EXCLUDED.value_status,
           confidence_tier = EXCLUDED.confidence_tier,
           source_ref      = EXCLUDED.source_ref,
           ingested_at     = now()
         -- Skip the write entirely when nothing changed. Most re-runs touch
         -- mostly-unchanged history; this keeps ingested_at meaningful as
         -- "when the value last actually moved" and avoids pointless WAL churn.
         WHERE observations.value IS DISTINCT FROM EXCLUDED.value`,
        params
      );

      written += rowCount;
    }
  });

  return { written, skipped };
}

/**
 * Mark an indicator as freshly ingested. Read by the freshness view that backs
 * the "last updated" badge on every panel.
 *
 * THIS RECORDS THAT THE JOB RAN, NOT THAT THE DATA MOVED.
 *
 * It is called on any successful fetch, including one that returned nothing
 * new, so `last_ingested_at` says only "we asked and nobody errored". Treating
 * it as a freshness signal is what let /pipeline report "Nothing is late" while
 * 73 of 125 active series had no observation newer than a year, every one of
 * them touched the night before. Anything asking how current the DATA is must
 * read `max(period_start) FILTER (WHERE value IS NOT NULL)` instead — which is
 * what the staleness query in app.js now does.
 *
 * @param {string} indicatorId
 */
export async function touchIndicator(indicatorId) {
  const { query } = await import('../db/pool.js');
  await query('UPDATE indicators SET last_ingested_at = now() WHERE id = $1', [
    indicatorId,
  ]);
}
