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
 * WHY THE GROUNDING IS SERIES ROWS AND NOT THE RUN VERBATIM
 *
 * It used to be the run object, unmodified — `{scenario, country, shock,
 * baseline, years}` — on the reasoning that anything else would be a re-derived
 * summary describing figures no chart shows. The reasoning is right; the shape
 * was wrong, in two ways that were only visible from the reader's side.
 *
 * `NarrationBlock` on the client reads `grounding.series`. That object has no
 * `series` key, so the disclosure button rendered "Show the 0 figures it was
 * given" and expanding it printed "This is the whole of what the model
 * received. It was permitted to write these numbers and no others…" above an
 * EMPTY LIST. That paragraph is the component's entire reason for existing, and
 * a page claiming a complete audit trail while showing nothing is worse than a
 * page that claims nothing.
 *
 * The gate could not read it either. `wrongDirection()` finds the movements a
 * grounding asserts, and a run object states them structurally rather than as
 * `previous`/`latest` — so it found none, gave up, and every simulation
 * narration went out with the direction check inert. It has since been taught
 * the projection shape as well (see `lib/narration.js`), so the check now works
 * on both; this end is fixed too because one shape serving both readers is
 * better than two ends that have to be kept agreeing.
 *
 * So: SERIES ROWS, exactly the shape a lens builds, and nothing else in the
 * grounding but the scenario's name and the country's code. Every number the
 * model may write is a row the reader can see, and every row is a figure the
 * page itself draws. That last clause is the constraint that decides what goes
 * in — see `SERIES` below.
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
  pruneStaleRuns,
} from '../src/server/repositories/simulations.js';
import {
  narrate,
  buildSimulationGrounding,
  PROMPT_VERSION,
} from '../src/server/lib/narration.js';

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
  'never as calendar years. Each figure below is given as its no-injection',
  'baseline followed by its projected value at the end of the horizon; say which',
  'way each one moved.',
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
     * A run the page refuses to draw must not be narrated.
     *
     * `validity.ok` is false when the equations left the range where a result
     * can exist — negative unemployment, most often — and `SimulationChart`
     * then draws only up to the first impossible year, or nothing. Prose written
     * about numbers the reader is not being shown is unauditable by
     * construction, and prose written about an impossible number is worse than
     * that. The default position of the shipped scenario is well inside the
     * range; this is here so that a default moved later cannot quietly start
     * narrating a refusal.
     */
    if (run.validity && run.validity.ok === false) {
      console.log(
        `  ${RED}range${RESET} ${label.padEnd(24)} the model leaves the possible range at year ` +
          `${run.validity.first_invalid_year} — the page refuses to draw it, so nothing is narrated`
      );
      skipped += 1;
      continue;
    }

    const grounding = buildSimulationGrounding(scenario.name, country, run);

    const result = await narrate({
      scope: narrationScope(slug, country),
      grounding,
      instruction: INSTRUCTION,
      force,
      /*
       * The hash `runSimulation()` itself used, handed back by it.
       *
       * This used to recompute it here — "same function, same inputs" — which
       * was true until `runHash` started keying on the coefficients as well, at
       * which point a recomputation from `defaults` alone would have written
       * every narration under a hash the page never looks up. One computation,
       * no second place to keep in step.
       */
      inputHash: run.input_hash,
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

/*
 * Housekeeping, here because here is where it is always due.
 *
 * A MODEL_VERSION bump invalidates every cached run, and the prose describing
 * those runs has to be rewritten against the new numbers — so this script is
 * what runs after a bump, every time. The rows it removes were already
 * unreachable before it started (`model_version` is in the cache key), and the
 * ones the v2 → v3 bump left behind are the pre-fix numbers that drew negative
 * unemployment. Reported rather than silent: a delete nobody sees is how a
 * table quietly loses something it needed.
 */
const pruned = await pruneStaleRuns();
if (pruned > 0) {
  console.log(
    `${DIM}${pruned} cached run(s) from a superseded model version removed.${RESET}`
  );
}

/* Exit 0 on a rejection — the gate working is not the run failing. See the
   note at the bottom of generate-narrations.js. */
await closePool();
