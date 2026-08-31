/**
 * Write the scenario narrations, offline.
 *
 * The reasoning in `generate-narrations.js` applies unchanged — a reader must
 * never wait on a model, a rejected narration must be an absent row rather than
 * a branch, and the gate's rejection rate should be paid by a cron job. Read
 * that file's header first; this one only covers what is different.
 *
 * WHAT IS DIFFERENT: THE INPUT SPACE IS CONTINUOUS
 *
 * A lens has one state, so one narration covers it. A scenario has as many
 * states as its sliders have positions, which is effectively infinite — and a
 * narration is keyed on a hash of the exact numbers it describes, so a slider
 * moved one step is a cache miss forever.
 *
 * Generating for every position is impossible, and generating on demand is the
 * thing the whole design refuses. So this writes narrations for the DEFAULT
 * position only — the state a reader arrives in, from a link or from the nav —
 * and every other position renders without prose.
 *
 * That is a real limitation and it is the right trade. The alternative reads
 * well and is worse: prose generated live, unreviewed, on numbers no gate has
 * seen, in the request path of a slider drag. A reader who moves a slider is
 * reading the chart, which is directly in front of them.
 *
 * (The obvious refinement — narrate a coarse BUCKET of the input space rather
 * than an exact position, so more of it is covered — changes what `input_hash`
 * means and is deliberately not done here.)
 *
 * WHY THE GROUNDING IS THE RUN, VERBATIM
 *
 * `runSimulation()` already returns the numbers the page will draw. Handing the
 * model anything else — a re-derived summary, a pre-computed change — would
 * mean the prose describes figures that no chart shows, which is the exact
 * failure the lens generator's `decimals` note was written about. So the run's
 * own output is the grounding, unmodified.
 *
 *     node scripts/generate-simulation-narrations.js                 all published
 *     node scripts/generate-simulation-narrations.js --force         regenerate
 *     node scripts/generate-simulation-narrations.js ai-capex-dotcom one scenario
 */

import { closePool } from '../src/server/db/pool.js';
import {
  listScenarios,
  getScenario,
  runSimulation,
  narrationScope,
} from '../src/server/repositories/simulations.js';
import { narrate, PROMPT_VERSION } from '../src/server/lib/narration.js';
import { runHash } from '../src/server/lib/simulation.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.find((a) => !a.startsWith('--')) ?? null;

/**
 * What the model may say.
 *
 * "Modelled" and "projected" are in the instruction rather than left to the
 * model's judgement, because a paragraph that reads as a forecast is the one
 * output this feature cannot ship. The gate cannot catch that — it checks
 * numbers, not framing — so it has to be asked for here and reviewed by whoever
 * runs this script.
 *
 * The horizon is described as "year one" and "year five" rather than as
 * calendar years on purpose: the model has no start date, and inventing one
 * would be the kind of plausible detail that survives every check.
 */
const INSTRUCTION = [
  'Describe what this economic model projects, in two sentences.',
  'These are MODELLED projections, not measurements and not a forecast of what',
  'will happen. Say so. Refer to periods as "year one", "year five" and so on —',
  'never as calendar years. Compare the projected path against the baseline',
  'given below, which is where the model says things sit with no injection.',
].join(' ');

const scenarios = only
  ? [{ slug: only }]
  : await listScenarios();

if (scenarios.length === 0) {
  console.log(`${DIM}No published scenarios. Nothing to narrate.${RESET}`);
  await closePool();
  process.exit(0);
}

console.log(`${DIM}prompt ${PROMPT_VERSION} · ${scenarios.length} scenario(s)${RESET}\n`);

let written = 0;
let cached = 0;
let rejected = 0;
let skipped = 0;

for (const { slug } of scenarios) {
  const scenario = await getScenario(slug);
  if (!scenario) {
    console.log(`  ${RED}?${RESET}     ${slug.padEnd(24)} not found or not published`);
    skipped += 1;
    continue;
  }

  /* Defaults only — the state a reader arrives in. See the header. */
  const defaults = Object.fromEntries(
    scenario.inputs.map((i) => [i.key, Number(i.default_value)])
  );

  for (const country of scenario.countries) {
    const label = `${slug}:${country}`;

    let run;
    try {
      run = await runSimulation(slug, country, defaults);
    } catch (error) {
      /* A missing coefficient. Loud, because it means a country was listed in
         `countries` before its research was finished. */
      console.log(`  ${RED}fail${RESET}  ${label.padEnd(24)} ${error.message}`);
      skipped += 1;
      continue;
    }

    if (!run || run.error) {
      console.log(`  ${RED}fail${RESET}  ${label.padEnd(24)} ${run?.error ?? 'no run'}`);
      skipped += 1;
      continue;
    }

    /*
     * The grounding is the run's own numbers, and NOTHING ELSE.
     *
     * `years`, `baseline` and `shock` are exactly what the page draws. The
     * narration cache is keyed on the same hash the run cache uses, so the
     * page can find this row again from the inputs alone.
     */
    const grounding = {
      scenario: scenario.name,
      country,
      shock: run.shock,
      baseline: run.baseline,
      years: run.years,
    };

    const result = await narrate({
      scope: narrationScope(slug, country),
      grounding,
      instruction: INSTRUCTION,
      force,
      /* The hash must match what `runSimulation()` looks up, or the page will
         never find what this script writes. Same function, same inputs. */
      inputHash: runHash({ scenarioId: scenario.id, countryIso3: country, inputs: defaults }),
    });

    if (!result) {
      rejected += 1;
      console.log(`  ${RED}gate${RESET}  ${label.padEnd(24)} nothing passed — no narration stored`);
      continue;
    }

    if (result.cached) cached += 1;
    else written += 1;

    console.log(
      `  ${GREEN}ok${RESET}    ${label.padEnd(24)} ${result.cached ? `${DIM}(cached)${RESET}` : ''}`
    );
    console.log(`        ${DIM}${result.body.replace(/\s+/g, ' ')}${RESET}`);
  }
}

console.log(
  `\n${written} written · ${cached} already cached · ${rejected} rejected by the gate` +
    (skipped ? ` · ${skipped} skipped` : '')
);

/* Exit 0 on a rejection — the gate working is not the run failing. See the
   note at the bottom of generate-narrations.js. */
await closePool();
