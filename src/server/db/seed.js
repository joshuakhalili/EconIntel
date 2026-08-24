/**
 * Seed runner — loads reference data (sources, countries, industries, indicator
 * definitions) into the database.
 *
 * Distinct from migrations in one important way: seeds are IDEMPOTENT and
 * re-runnable. Every seed file uses ON CONFLICT DO UPDATE, so editing a seed
 * and re-running it updates rows in place rather than erroring or duplicating.
 * That makes the reference data editable as ordinary source-controlled files.
 *
 * Seeds contain no observations. Every number in this dashboard arrives through
 * ingestion from a cited source — there is no fabricated data anywhere in the
 * repository, which is what lets any chart be traced back to its origin.
 *
 * Usage:  node src/server/db/seed.js
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { withTransaction, query, closePool } from './pool.js';

const SEEDS_DIR = fileURLToPath(new URL('../../../db/seeds', import.meta.url));

export async function seed() {
  const entries = await readdir(SEEDS_DIR);
  const files = entries.filter((f) => f.endsWith('.sql')).sort();

  if (files.length === 0) {
    console.log('No seed files found.');
    return;
  }

  // All seeds in ONE transaction. They reference each other by foreign key
  // (indicators -> sources), so a partial application would leave the reference
  // data inconsistent. All or nothing is the only safe granularity here.
  await withTransaction(async (client) => {
    for (const filename of files) {
      const sql = await readFile(path.join(SEEDS_DIR, filename), 'utf8');
      const startedAt = performance.now();
      await client.query(sql);
      console.log(
        `  seeded   ${filename}  (${(performance.now() - startedAt).toFixed(0)}ms)`
      );
    }
  });

  const { rows } = await query(`
    SELECT 'sources'    AS table_name, count(*) AS rows FROM sources
    UNION ALL SELECT 'countries',  count(*) FROM countries
    UNION ALL SELECT 'industries', count(*) FROM industries
    UNION ALL SELECT 'indicators', count(*) FROM indicators
    UNION ALL SELECT 'observations (expected 0)', count(*) FROM observations
    ORDER BY 1
  `);

  console.log('\nReference data loaded:');
  for (const row of rows) {
    console.log(`  ${String(row.rows).padStart(5)}  ${row.table_name}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await seed();
  } catch (error) {
    console.error(`\nSeed failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await closePool();
  }
}
