/** Preview the World Bank backfill; writing requires --execute and exact ids.
 * Use a staging DATABASE_URL first. This never changes country dimensions.
 * node scripts/backfill-country-coverage.js
 * node scripts/backfill-country-coverage.js --execute wb.IT.NET.USER.ZS
 */
import { pathToFileURL } from 'node:url';
import { query, closePool } from '../src/server/db/pool.js';
import { ingestWorldBankIndicator } from '../src/server/ingestion/runner.js';

export function parseBackfillArgs(args) {
  const execute = args.includes('--execute');
  const ids = args.filter((arg) => arg !== '--execute');
  if (ids.some((id) => !/^wb\.[A-Z0-9.]+$/.test(id))) throw new Error('Only exact wb.* indicator ids are accepted');
  if (execute && ids.length === 0) throw new Error('--execute requires explicit indicator ids from the preview');
  return { execute, ids: [...new Set(ids)] };
}

export async function main(args = process.argv.slice(2)) {
  const { execute, ids } = parseBackfillArgs(args);
  const { rows } = await query(`
    SELECT i.id, i.source_id, i.source_series_code, i.last_ingested_at,
      count(DISTINCT o.country_iso3) FILTER (WHERE o.value IS NOT NULL AND NOT c.is_aggregate)::int AS economies_with_data,
      (SELECT count(*)::int FROM countries WHERE NOT is_aggregate) AS registered_economies
    FROM indicators i LEFT JOIN observations o ON o.indicator_id = i.id
    LEFT JOIN countries c ON c.iso3 = o.country_iso3
    WHERE i.source_id = 'worldbank' AND i.is_active
      AND i.source_series_code IS NOT NULL
      AND (cardinality($1::text[]) = 0 OR i.id = ANY($1::text[]))
    GROUP BY i.id ORDER BY i.id`, [ids]);
  for (const id of ids) if (!rows.some((row) => row.id === id)) throw new Error(`Active World Bank indicator not found: ${id}`);
  console.log(JSON.stringify({ mode: execute ? 'execute' : 'preview', indicators: rows }, null, 2));
  if (!execute) return;
  for (const indicator of rows) {
    const result = await ingestWorldBankIndicator(indicator);
    console.log(JSON.stringify({ id: indicator.id, ...result }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await closePool(); }
}
