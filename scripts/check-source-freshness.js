import { query, closePool } from '../src/server/db/pool.js';
import { gdeltFreshness } from '../src/server/lib/source-freshness.js';
try {
  const { rows } = await query(`SELECT max(period_end)::text AS last_period FROM observations WHERE indicator_id='derived.ai_news_volume' AND value IS NOT NULL`);
  const result = gdeltFreshness(rows[0]?.last_period);
  console.log(JSON.stringify({ source: 'gdelt', last_period: rows[0]?.last_period, ...result }));
  if (result.stale) { console.error('::error title=GDELT freshness::No valid completed news-volume period within the 75-day operational threshold; recovery needs attention.'); process.exitCode = 1; }
} finally { await closePool(); }
