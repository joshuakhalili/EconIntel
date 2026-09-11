/** Read-only database/provider audit, writes only a public metadata artifact. */
import { writeFile } from 'node:fs/promises';
import { query, closePool } from '../src/server/db/pool.js';
import { config } from '../src/server/config.js';
import { fetchJson, redactUrl } from '../src/server/lib/http.js';
import { measurementDefinition } from '../src/server/lib/measurement-definitions.js';
import { dbnomicsDefinition, fredDefinition } from '../src/server/lib/provider-measurement.js';
const output = process.argv[2];
const refresh = process.argv.includes('--refresh');
if (!output) throw new Error('Supply an output JSON path');
try {
  const { rows } = await query(`SELECT DISTINCT i.id, i.source_id, i.source_series_code, i.source_url, i.description
    FROM indicators i JOIN question_indicators qi ON qi.indicator_id=i.id
    JOIN questions q ON q.id=qi.question_id AND q.is_active WHERE i.is_active ORDER BY i.id`);
  const results = {};
  let next = 0;
  const checked = new Date().toISOString().slice(0, 10);
  async function worker() {
    while (next < rows.length) {
      const row = rows[next++];
      let result = measurementDefinition(row);
      if (!['source_definition_verified', 'adapter_recipe_verified'].includes(result.definition_status)
          && (refresh || result.definition_status === 'not_verified')) {
        try {
          if (row.source_id === 'dbnomics' && row.source_series_code) {
            const url = `https://api.db.nomics.world/v22/series/${row.source_series_code.split('/').map(encodeURIComponent).join('/')}?observations=0`;
            result = dbnomicsDefinition(await fetchJson(url, { timeoutMs: 20_000, totalBudgetMs: 45_000, retries: 1 }), row.source_series_code);
          } else if (row.source_id === 'fred' && row.source_series_code) {
            if (!config.keys.fred) throw new Error('FRED metadata probe requires the configured server-side key');
            const params = new URLSearchParams({ series_id: row.source_series_code, api_key: config.keys.fred, file_type: 'json' });
            result = fredDefinition(await fetchJson(`https://api.stlouisfed.org/fred/series?${params}`, { timeoutMs: 20_000, totalBudgetMs: 45_000, retries: 1 }), row.source_series_code);
          } else {
            result = { ...result, definition_status: 'adapter_definition_only',
              catalogue_definition: row.description,
              attempted: `Inspected existing ${row.source_id} adapter/catalogue contract. It has no separate structured population/estimand metadata route; source URL retained for review.`,
              limitations: 'Catalogue text is retained as provenance, not promoted to an independently verified provider definition. Global/reference series must not be credited as country observations.',
            };
          }
        } catch (error) {
          result = { ...result, definition_status: 'metadata_access_failed', attempted: `Live ${row.source_id} series metadata probe`,
            definition_source: row.source_url, limitations: redactUrl(error.message).slice(0, 600) };
        }
      }
      results[row.id] = { ...result, definition_checked: result.definition_checked ?? checked };
      console.log(`${row.id}: ${result.definition_status}`);
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker));
  await writeFile(output, JSON.stringify(Object.fromEntries(Object.entries(results).sort(([a], [b]) => a.localeCompare(b))), null, 2) + '\n');
  console.log(JSON.stringify({ indicators: rows.length, output }));
} finally { await closePool(); }
