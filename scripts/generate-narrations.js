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
import { narrate, PROMPT_VERSION } from '../src/server/lib/narration.js';

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const RESET = '[0m';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.find((a) => !a.startsWith('--')) ?? null;

/**
 * What the model is allowed to know about a lens.
 *
 * Every value here is read from the database — and NOT pre-differenced. It
 * would be easy to hand the model a `change` field and let it describe that,
 * and it would also mean the number a reader sees was produced by this script
 * rather than by SQL over stored observations. The levels and the periods are
 * the facts; if a change belongs on the page it should become an indicator.
 *
 * ROUNDED TO THE INDICATOR'S OWN `decimals`, AND THAT MATTERS
 *
 * The first run of this script produced "the price of Copper moved down from
 * $13552.04090909091" — the raw double, straight out of Postgres. Two things
 * wrong with that, and the second is the real one:
 *
 *   - It is unreadable, and a summary written in sixteen significant figures
 *     is worse than no summary.
 *   - It DISAGREES WITH THE PAGE. The ticker beside it renders 13,552.04,
 *     because `indicators.decimals` says two. A reader seeing two different
 *     numbers for one price has no way to know which is the real one, and the
 *     honest answer — they are the same number — is not available to them.
 *
 * `decimals` is stored metadata, set per indicator, and it is what every other
 * surface on the site already formats with. Using it here is not a computation
 * the model is being spared; it is the grounding speaking the same language as
 * the chart. The validator accepts a value written to fewer decimals than it
 * was given, so this narrows what the model may write rather than widening it.
 *
 * Capped at six series. The whole point is a summary, and an 8B model handed
 * fourteen rows writes a list — which the labour lens proved on the first run.
 */
function buildGrounding(lens, tickers) {
  const usable = (tickers ?? [])
    .filter((t) => Number.isFinite(t.latest_value))
    .slice(0, 6);

  /** As the site displays it. `decimals` is per-indicator and stored. */
  const asDisplayed = (value, decimals) => {
    if (!Number.isFinite(value)) return null;
    return Number(value.toFixed(decimals ?? 2));
  };

  return {
    lens: lens.name,
    series: usable.map((t) => ({
      name: t.label ?? t.name,
      unit: t.unit_symbol ?? t.unit ?? null,
      latest: asDisplayed(t.latest_value, t.decimals),
      previous: asDisplayed(t.previous_value, t.decimals),
      period: t.latest_period ?? null,
    })),
  };
}

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
  const grounding = buildGrounding(lens, tickers);

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
