/**
 * Write the lens narrations, offline.
 *
 * WHY THIS IS A SCRIPT AND NOT A REQUEST HANDLER
 *
 * Three reasons, and the first alone settles it.
 *
 * 1. A reader must never wait on a model. A Workers AI call is ~400 ms on a
 *    good day and this project is heading for Vercel functions with a hard
 *    ceiling; putting a model call in a page load means a page that sometimes
 *    takes a second longer and sometimes times out, for a paragraph of summary.
 *
 * 2. A failed narration must be invisible, not an error. `narrate()` returns
 *    null when nothing passed the gate. In a request handler that becomes a
 *    branch every caller has to remember; generated ahead of time it is simply
 *    a row that does not exist, and the page renders without it.
 *
 * 3. The gate has a rejection rate. It should be paid in a cron job that can
 *    retry tomorrow, not by whoever happened to load the page.
 *
 * So the web tier only ever reads `narrations`. Nothing in `src/server/app.js`
 * calls a model, and that is a property worth keeping.
 *
 *     node scripts/generate-narrations.js            all lenses, cache-aware
 *     node scripts/generate-narrations.js --force    regenerate regardless
 *     node scripts/generate-narrations.js prices     one lens
 */

import { query, closePool } from '../src/server/db/pool.js';
import { getLensTickers } from '../src/server/repositories/lenses.js';
import {
  narrate,
  buildLensGrounding,
  PROMPT_VERSION,
} from '../src/server/lib/narration.js';

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const RESET = '[0m';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.find((a) => !a.startsWith('--')) ?? null;

const INSTRUCTION =
  'Write two sentences describing what these figures show. Say which moved up ' +
  'and which moved down. Do not explain why, and do not say what it means.';

const { rows: lenses } = await query(
  `SELECT id, slug, name FROM lenses WHERE is_active ${only ? 'AND slug = $1' : ''} ORDER BY sort_order`,
  only ? [only] : []
);

if (lenses.length === 0) {
  console.error(`${RED}✗${RESET} no active lens matched${only ? ` "${only}"` : ''}`);
  await closePool();
  process.exit(1);
}

console.log(`${DIM}prompt ${PROMPT_VERSION} · ${lenses.length} lens(es)${RESET}\n`);

let written = 0;
let cached = 0;
let rejected = 0;

for (const lens of lenses) {
  const tickers = await getLensTickers(lens.slug);
  /* Built by `lib/narration.js`, not here: the same shape has to be
     reconstructible by the repository that serves the page, so a stored
     narration can be checked against today's figures. See the note above the
     builders. */
  const grounding = buildLensGrounding(lens, tickers);

  if (grounding.series.length < 2) {
    console.log(`  ${DIM}skip  ${lens.slug.padEnd(12)} fewer than two series with a value${RESET}`);
    continue;
  }

  const result = await narrate({
    scope: `lens:${lens.slug}`,
    grounding,
    instruction: INSTRUCTION,
    indicatorIds: (tickers ?? []).map((t) => t.indicator_id).filter(Boolean),
    force,
  });

  if (!result) {
    rejected += 1;
    console.log(`  ${RED}gate  ${lens.slug.padEnd(12)} nothing passed — no narration stored${RESET}`);
    continue;
  }

  if (result.cached) cached += 1;
  else written += 1;

  console.log(
    `  ${GREEN}ok${RESET}    ${lens.slug.padEnd(12)} ${result.cached ? `${DIM}(cached)${RESET}` : ''}`
  );
  console.log(`        ${DIM}${result.body.replace(/\s+/g, ' ')}${RESET}`);
}

console.log(
  `\n${written} written · ${cached} already cached · ${rejected} rejected by the gate`
);

/*
 * A rejection is not a failure of the run. It is the gate doing its job, and
 * the page renders without a paragraph. Exit 0 so a scheduled run does not go
 * red for working correctly — the count above is the signal, and a persistent
 * rejection shows up as a lens that never has a narration.
 */
await closePool();
