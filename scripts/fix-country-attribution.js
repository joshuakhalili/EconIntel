/**
 * One-off repair: remove observations filed under the wrong country.
 *
 * WHY THIS EXISTS
 *
 * Seven OECD youth-unemployment series carried a complete duplicate set of
 * rows tagged 'USA'. `fred.LRHU24TTGBM156S` is FRED's series for the *UK*
 * youth unemployment rate, and it held 436 rows as GBR and 436 identical rows
 * as USA — so the database asserted a US youth unemployment rate of 16.4% for
 * April 2026, which is the UK's figure against a real US rate near 10%. Those
 * seven series are the hero charts on the `entry-level` question.
 *
 * The cause is already fixed. `ingestFredIndicator` once let the FRED adapter
 * default every series to USA; it now passes `indicator.default_country_iso3`,
 * and the comment above that line explains why. But repairing a writer does not
 * unwrite what it wrote: `upsertObservations` keys on
 * (indicator, period, country, industry, company), so rows under the wrong
 * country are a different grain and no later run ever touches them.
 *
 * This is a script rather than a seed because seeds are idempotent upserts of
 * reference data — they add and update, never delete, and adding a DELETE to
 * one would make re-running a seed a destructive act.
 *
 * It is kept rather than thrown away so the repair is auditable next to the
 * guard that now prevents it (`scripts/check-data.js`). Re-running it after the
 * fix is a no-op.
 *
 *     node scripts/fix-country-attribution.js            # report only
 *     node scripts/fix-country-attribution.js --apply    # delete
 */

import { writeFileSync } from 'node:fs';
import { pool, closePool, withTransaction } from '../src/server/db/pool.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const apply = process.argv.includes('--apply');

/**
 * The rows to remove: an observation whose country contradicts the country its
 * own indicator declares.
 *
 * Indicators that leave `default_country_iso3` NULL are untouched. World Bank
 * series legitimately hold fifty countries under one id, and this must never
 * mistake breadth for corruption.
 */
const WHERE = `
  o.id IN (
    SELECT o2.id
      FROM observations o2
      JOIN indicators i ON i.id = o2.indicator_id
     WHERE i.default_country_iso3 IS NOT NULL
       AND o2.country_iso3 IS DISTINCT FROM i.default_country_iso3
  )`;

const { rows: summary } = await pool.query(
  `SELECT i.id,
          i.name,
          i.default_country_iso3 AS declared,
          o.country_iso3         AS found,
          count(*)::int          AS doomed,
          (SELECT count(*)::int
             FROM observations k
            WHERE k.indicator_id = i.id
              AND k.country_iso3 = i.default_country_iso3) AS kept
     FROM indicators i
     JOIN observations o ON o.indicator_id = i.id
    WHERE i.default_country_iso3 IS NOT NULL
      AND o.country_iso3 IS DISTINCT FROM i.default_country_iso3
    GROUP BY 1, 2, 3, 4
    ORDER BY doomed DESC`
);

if (summary.length === 0) {
  console.log(`${GREEN}✓${RESET} nothing to repair — every observation matches its indicator's country`);
  await closePool();
  process.exit(0);
}

const total = summary.reduce((n, r) => n + r.doomed, 0);

console.log(`${YELLOW}${total} observation(s) contradict their indicator's declared country${RESET}\n`);
for (const row of summary) {
  console.log(`  ${row.id}`);
  console.log(`    ${DIM}${row.name}${RESET}`);
  console.log(
    `    declares ${row.declared} · ${RED}${row.doomed} rows as ${row.found ?? 'NULL'} to delete${RESET}` +
      ` · ${GREEN}${row.kept} correct rows kept${RESET}`
  );
}

/*
 * Refuse to delete a series' only data. If `kept` were zero the wrong-country
 * rows would be the entire series, which would mean the diagnosis is wrong —
 * more likely a mislabelled indicator than mislabelled observations — and
 * deleting would destroy the series rather than repair it.
 */
const wouldEmpty = summary.filter((r) => r.kept === 0);
if (wouldEmpty.length > 0) {
  console.error(
    `\n${RED}✗ refusing to run${RESET} — ${wouldEmpty.map((r) => r.id).join(', ')} ` +
      `would be left with no observations at all.\n` +
      `${DIM}That points at a wrong indicator declaration, not wrong observations. Fix by hand.${RESET}`
  );
  await closePool();
  process.exit(1);
}

if (!apply) {
  console.log(`\n${DIM}Dry run. Re-run with --apply to delete.${RESET}`);
  await closePool();
  process.exit(0);
}

// Dump what is about to go, so the deletion is reversible from a file even
// though it is not reversible in the database.
const { rows: doomed } = await pool.query(
  `SELECT o.* FROM observations o WHERE ${WHERE} ORDER BY o.indicator_id, o.period_start`
);
const backup = new URL('../.backup-country-attribution.json', import.meta.url);
writeFileSync(backup, JSON.stringify(doomed, null, 2));
console.log(`\n${DIM}backed up ${doomed.length} rows to ${backup.pathname}${RESET}`);

const deleted = await withTransaction(async (client) => {
  const result = await client.query(`DELETE FROM observations o WHERE ${WHERE}`);
  return result.rowCount;
});

console.log(`${GREEN}✓${RESET} deleted ${deleted} mislabelled observation(s)`);

await closePool();
