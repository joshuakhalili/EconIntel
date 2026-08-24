/**
 * Source verification.
 *
 * WHY THIS EXISTS
 *
 * A wrong series code does not throw. FRED and the World Bank both answer a
 * request for a non-existent series with a valid, empty response — which
 * travels all the way through ingestion and renders as an empty chart. The
 * reader sees "no data" and reasonably concludes the data does not exist, when
 * in fact we simply asked the wrong question.
 *
 * That is the most dangerous class of bug in a data dashboard, because nothing
 * looks broken. This script closes the gap: it probes every series code in the
 * indicator catalog against the live API and reports which resolve.
 *
 * Run it on a machine with network access to the data providers:
 *
 *     npm run verify:sources
 *
 * Exit code is non-zero if any code fails, so it can gate a deploy.
 */

import { query, closePool } from '../src/server/db/pool.js';
import { config, describeIntegrations } from '../src/server/config.js';
import * as fred from '../src/server/ingestion/sources/fred.js';
import * as worldbank from '../src/server/ingestion/sources/worldbank.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

async function verifyOne(indicator) {
  const { id, source_id: sourceId, source_series_code: code } = indicator;

  // Derived indicators are computed by us from other data; they have no
  // upstream code to verify.
  if (!code) {
    return { id, status: 'skipped', detail: 'derived — no upstream series code' };
  }

  try {
    if (sourceId === 'fred') {
      const meta = await fred.fetchSeriesMetadata(code);
      return {
        id,
        status: 'ok',
        detail: `${meta.title} · ${meta.units} · ${meta.observationStart}→${meta.observationEnd}`,
      };
    }

    if (sourceId === 'worldbank') {
      const meta = await worldbank.fetchIndicatorMetadata(code);
      return { id, status: 'ok', detail: meta.name };
    }

    return {
      id,
      status: 'skipped',
      detail: `no verifier implemented for source "${sourceId}"`,
    };
  } catch (error) {
    return { id, status: 'failed', detail: error.message.split('\n')[0] };
  }
}

async function main() {
  if (config.useFixtures) {
    console.log(
      `${YELLOW}USE_FIXTURES is true — this script needs live network access.${RESET}\n` +
      `Set USE_FIXTURES=false in .env and run on a machine that can reach the providers.\n`
    );
    process.exitCode = 1;
    return;
  }

  console.log('Integration readiness:');
  for (const { name, ready, note } of describeIntegrations()) {
    const mark = ready ? `${GREEN}ready${RESET}` : `${YELLOW}not configured${RESET}`;
    console.log(`  ${name.padEnd(12)} ${mark}  ${DIM}${note}${RESET}`);
  }
  console.log();

  const { rows: indicators } = await query(`
    SELECT id, source_id, source_series_code
    FROM indicators
    WHERE is_active
    ORDER BY source_id, id
  `);

  console.log(`Verifying ${indicators.length} indicator(s) against live APIs…\n`);

  const results = [];
  // Sequential rather than parallel: the shared rate limiter already paces us,
  // and sequential output is readable as it streams rather than interleaving.
  for (const indicator of indicators) {
    const result = await verifyOne(indicator);
    results.push(result);

    const mark =
      result.status === 'ok'      ? `${GREEN}  ok   ${RESET}` :
      result.status === 'failed'  ? `${RED}  FAIL ${RESET}` :
                                    `${DIM}  skip ${RESET}`;

    console.log(`${mark} ${result.id.padEnd(34)} ${DIM}${result.detail}${RESET}`);
  }

  const failed = results.filter((r) => r.status === 'failed');
  const ok = results.filter((r) => r.status === 'ok');
  const skipped = results.filter((r) => r.status === 'skipped');

  console.log(
    `\n${ok.length} verified · ${failed.length} failed · ${skipped.length} skipped`
  );

  if (failed.length > 0) {
    console.log(
      `\n${RED}Fix these before trusting any chart.${RESET} An unverified series ` +
      `renders as an empty panel, which reads as "no data" rather than "wrong code":\n`
    );
    for (const f of failed) console.log(`  ${f.id}\n    ${f.detail}`);
    console.log(
      `\nCorrect the code in db/seeds/004_indicators.sql, then:\n` +
      `  npm run db:seed && npm run verify:sources\n`
    );
    process.exitCode = 1;
  }
}

try {
  await main();
} finally {
  await closePool();
}
