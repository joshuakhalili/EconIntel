/**
 * The simulation engine — and the reason it is allowed to exist.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS FILE EXISTS TO ENFORCE
 *
 *   Every coefficient comes from `simulation_parameters`, where every row
 *   carries a citation. This module never contains a number of its own.
 *
 * Search this file for a numeric literal in an equation and you should find
 * none. That is not stylistic. A hardcoded 0.8 is an uncited claim about the
 * world wearing the costume of an implementation detail, and it would be
 * invisible to every gate this project has — the schema cannot check a number
 * that never reaches it. So the parameters arrive as an argument, they arrive
 * from a table that refuses uncited rows, and this file does arithmetic.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS IS EQUATIONS AND NOT A SIMULATION IN THE USUAL SENSE
 *
 * The obvious build for "simulate the economy" is an agent-based model:
 * thousands of synthetic households and firms, each following rules, run
 * forward until aggregate behaviour emerges. That was considered and rejected
 * twice over.
 *
 * Practically: it cannot run here. The web tier is a serverless function with
 * a 15-second ceiling and an 8-second statement timeout behind it. An ABM is an
 * offline batch job by nature, which would mean precomputing a grid of results
 * and interpolating between them — a worse product (no live sliders) built on a
 * heavier engine.
 *
 * Honestly: it would not be more true. An ABM's outputs are only as good as its
 * behavioural rules, and we would be choosing those rules ourselves. A
 * four-equation chain whose every coefficient traces to a published estimate is
 * a weaker model that is far easier to check, and being checkable is the only
 * property this project has ever traded on.
 *
 * WHAT THE MODEL IS
 *
 * The standard undergraduate transmission chain, which is standard precisely
 * because each link is separately estimated in the literature:
 *
 *   spending  →  output       a fiscal multiplier, decaying over the horizon
 *   output    →  unemployment Okun's law
 *   unemployment → wages      a wage Phillips curve, with persistence
 *   wages     →  prices       pass-through, plus a direct Phillips term
 *
 * It is linear, it has no expectations, no monetary policy reaction, no
 * capacity constraint and no feedback from prices back to output. Each of those
 * omissions makes it wrong in a knowable direction, and `scenario.caveat` is
 * required by the schema so the page has to say so.
 *
 * WHAT THIS MEANS FOR A READER, STATED PLAINLY
 *
 * The output is `modelled` tier. It is arithmetic on assumptions, not a
 * measurement, and it is not a forecast: it answers "what does this published
 * literature imply, if it holds and nothing else moves", which is a narrower
 * and more defensible question than "what will happen".
 */

import { createHash } from 'node:crypto';

/**
 * Bump to invalidate every cached run at once.
 *
 * The cache key is (scenario, country, input_hash, model_version). Changing an
 * equation without changing this serves numbers computed by the OLD equations
 * from `simulation_runs`, indefinitely — and worse, serves them next to
 * narration written about them, so the prose and the chart would agree with
 * each other and both be stale.
 */
export const MODEL_VERSION = 'v1-2026-08-31';

/* ── Parameter contracts ─────────────────────────────────────────────────── */

/**
 * What each model requires before it will run.
 *
 * Declared as data rather than discovered by destructuring so that a missing
 * parameter fails with a list of names at the door, not as a NaN that
 * propagates silently through four equations and renders as a flat line. A
 * flat line looks like a result.
 */
const REQUIRED_PARAMS = {
  investment_shock_v1: [
    'gdp_usd_bn',              // denominator: converts an absolute shock to a share of output
    'fiscal_multiplier_y1',    // impact multiplier, year one
    'multiplier_decay',        // geometric decay of the multiplier per subsequent year
    'okun_coefficient',        // pp of unemployment per pp of output gap
    'unemployment_baseline',   // where unemployment sits absent the shock
    /*
     * There is deliberately NO `wage_growth_baseline`.
     *
     * Unemployment has a measured baseline (a statistical agency publishes the
     * rate) and inflation has a published one (a central bank states its
     * target). Trend nominal wage growth has neither: it would have to be
     * derived — target inflation plus trend productivity, say — and that
     * derivation would be this project's own assumption wearing a citation's
     * clothes.
     *
     * So wage growth is reported as a DEVIATION and never as a level, which is
     * exactly what the published wage coefficients license. "Wage growth runs
     * 2.1 points above trend" is what the literature supports. "Wage growth is
     * 5.1%" is a claim about where trend sits, and nobody here can source it.
     */
    'wage_phillips_slope',     // wage response to a tighter labour market
    'wage_persistence',        // how much of last year's wage deviation carries forward
    'price_phillips_slope',    // direct price response to slack
    'wage_price_passthrough',  // share of excess wage growth reaching prices
    'inflation_anchor',        // trend inflation absent the shock
  ],
};

/**
 * Sign contracts. Which way a coefficient must point to mean what it says.
 *
 * THIS EXISTS BECAUSE A DROPPED MINUS SIGN IS INVISIBLE.
 *
 * Okun's coefficient is published negative: output above trend puts
 * unemployment below it. Transcribe −0.563 as 0.563 into the seed and the model
 * does not crash, does not warn, and draws a chart in which an investment boom
 * raises unemployment and lowers wages. Every number on it is finite, the
 * citation panel beside it is correct, and the whole thing is backwards.
 *
 * A hand-copied coefficient is exactly where that error happens, so the
 * contract is declared here and checked at the door. `null` means the sign is
 * genuinely free and must not be constrained.
 */
const PARAM_SIGNS = {
  okun_coefficient: 'negative',        // U − U* = β(Y − Y*), β < 0
  multiplier_decay: 'positive',        // a decay rate; negative would oscillate
  wage_persistence: 'positive',        // carry-forward, not reversal
  wage_phillips_slope: 'positive',     // tighter labour market, faster wages
  price_phillips_slope: 'positive',    // applied to negated slack — see the model
  wage_price_passthrough: 'positive',  // a share of wages reaching prices
  gdp_usd_bn: 'positive',              // a denominator; zero would be division by zero
};

/**
 * Inputs each model reads, and how they are interpreted.
 *
 * `sustained` is a boolean-ish flag (0 or 1) rather than a second scenario,
 * because "is this a one-off cheque or an annual commitment" changes the
 * arithmetic profoundly and is exactly the question a reader wants to poke at.
 */
const REQUIRED_INPUTS = {
  investment_shock_v1: ['shock_usd_bn'],
};

/* ── The models ──────────────────────────────────────────────────────────── */

/**
 * An investment or spending shock, propagated for `horizonYears`.
 *
 * Returns one row per year. Every row carries both the level (what
 * unemployment IS in that year, under the model) and the deviation (how far the
 * shock moved it), because a chart of levels is what a reader understands and a
 * table of deviations is what the model actually claims. Showing only levels
 * would imply the baseline is a forecast too, which it is not — it is a
 * published trend held flat on purpose.
 */
function investmentShockModel({ inputs, parameters, horizonYears }) {
  const p = parameters;

  const shockUsdBn = toNumber(inputs.shock_usd_bn);
  /* 0 or 1. A sustained shock re-injects the same amount every year; a one-off
     injects in year one only and the multiplier's decay carries the rest. */
  const sustained = toNumber(inputs.sustained) >= 1;

  /* The shock as a percentage of baseline output. Everything downstream is in
     percentage points, so this conversion happens once, here, and no other
     equation has to know what a dollar is. */
  const shockShare = (shockUsdBn / p.gdp_usd_bn) * 100;

  const years = [];
  let previousWageDeviation = 0;

  for (let t = 1; t <= horizonYears; t += 1) {
    /*
     * The multiplier decays geometrically from its year-one value.
     *
     * A one-off injection still moves output in later years — the money is
     * spent onward, and the literature's multipliers are cumulative for exactly
     * this reason. A sustained injection adds a fresh year-one impulse on top
     * of the decaying tail of every previous year's, which is why it is a sum
     * rather than a single term.
     */
    let multiplier;
    if (sustained) {
      multiplier = 0;
      for (let vintage = 0; vintage < t; vintage += 1) {
        multiplier += p.fiscal_multiplier_y1 * p.multiplier_decay ** vintage;
      }
    } else {
      multiplier = p.fiscal_multiplier_y1 * p.multiplier_decay ** (t - 1);
    }

    /* spending → output */
    const outputGap = multiplier * shockShare;

    /*
     * output → unemployment (Okun's law)
     *
     * The coefficient is stored NEGATIVE, exactly as published — Ball, Leigh &
     * Loungani estimate U − U* = β(Y − Y*) with β around −0.56 for the US. No
     * sign is flipped here, so the number in the citation panel is the number
     * in the source's table and a reader can check one against the other
     * without knowing this file's conventions. `PARAM_SIGNS` below refuses a
     * positive value, because a dropped minus would invert the entire labour
     * channel and still draw a confident chart.
     */
    const unemploymentGap = p.okun_coefficient * outputGap;

    /*
     * unemployment → wages
     *
     * Persistence is on the DEVIATION, not the level: wage growth that ran hot
     * last year keeps some of that heat this year. Applying it to the level
     * instead would make the baseline itself compound, which would drift the
     * no-shock case away from its own trend and show movement where the model
     * claims none.
     */
    const wageDeviation =
      p.wage_phillips_slope * -unemploymentGap +
      p.wage_persistence * previousWageDeviation;
    previousWageDeviation = wageDeviation;

    /*
     * wages → prices, plus the direct slack term.
     *
     * Two channels rather than one because they are separately estimated and
     * separately arguable: prices respond to a tight labour market directly,
     * and again indirectly as the wage bill feeds through. Collapsing them into
     * a single coefficient would make the model impossible to cite.
     */
    const inflationDeviation =
      p.price_phillips_slope * -unemploymentGap +
      p.wage_price_passthrough * wageDeviation;

    years.push({
      year: t,
      output_gap_pp: round(outputGap),
      unemployment_pct: round(p.unemployment_baseline + unemploymentGap),
      unemployment_gap_pp: round(unemploymentGap),
      /* Deviation only — no level. See the note in REQUIRED_PARAMS. */
      wage_growth_gap_pp: round(wageDeviation),
      inflation_pct: round(p.inflation_anchor + inflationDeviation),
      inflation_gap_pp: round(inflationDeviation),
    });
  }

  return {
    years,
    baseline: {
      unemployment_pct: round(p.unemployment_baseline),
      inflation_pct: round(p.inflation_anchor),
      /* Wage growth's baseline is deliberately absent, not missing. */
      wage_growth_gap_pp: 0,
    },
    /* Restated for the narration layer, which may only speak numbers it was
       given — including the ones it needs to describe the shock itself. */
    shock: {
      usd_bn: round(shockUsdBn),
      share_of_gdp_pct: round(shockShare),
      sustained,
    },
  };
}

const MODELS = {
  investment_shock_v1: investmentShockModel,
};

/**
 * Two decimal places, everywhere, once.
 *
 * Rounding at the edge rather than per-equation keeps the arithmetic exact
 * through the chain — rounding `outputGap` before it reaches Okun's law would
 * compound a rounding error across four steps and a five-year horizon. It also
 * gives narration a stable set of tokens to match: a value that renders as
 * 4.21 must be 4.21 in the grounding, or the gate rejects prose for quoting a
 * number the chart is showing.
 */
function round(value) {
  const rounded = Math.round(value * 100) / 100;
  /* Normalise negative zero. `Math.round(-0.001 * 100) / 100` is -0, which
     survives into the grounding and can render as "-0.00" — a minus sign in
     front of nothing, on a page whose entire argument is that its figures are
     handled carefully. Adding 0 collapses -0 to 0 and leaves every other value
     untouched. */
  return rounded === 0 ? 0 : rounded;
}

/**
 * A parameter's numeric value, or NaN if it is not really a number.
 *
 * `Number()` alone is not enough and the gap is dangerous rather than
 * cosmetic: `Number(null)` is 0, so a NULL coefficient arriving from Postgres
 * would pass a `Number.isFinite` check and then behave as a silent zero — an
 * Okun coefficient of nought would flatten the entire labour-market channel and
 * still draw a confident chart. `Number('')` and `Number(false)` are 0 too.
 * Only a number, or a string that parses as one, counts.
 */
function toNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

/* ── The public entry point ──────────────────────────────────────────────── */

/**
 * Run a scenario's equations.
 *
 * Pure: no database, no fetch, no clock. Everything it needs arrives as an
 * argument, which is what makes a stored run reproducible from its stored
 * inputs and what lets the tests assert against hand-computed values.
 *
 * @param {object} options
 * @param {string} options.modelKey      which equation set, e.g. 'investment_shock_v1'
 * @param {object} options.inputs        slider values, already range-checked by the caller
 * @param {object} options.parameters    flat {param_key: number}, from simulation_parameters
 * @param {number} options.horizonYears  how many years to project
 * @returns {{years: object[], baseline: object, shock: object}}
 * @throws  when the model is unknown, or a required parameter or input is absent
 */
export function runScenario({ modelKey, inputs, parameters, horizonYears }) {
  const model = MODELS[modelKey];
  if (!model) {
    throw new Error(
      `Unknown model "${modelKey}". Known models: ${Object.keys(MODELS).join(', ')}`
    );
  }

  /*
   * Fail loudly on a missing parameter. Never default one.
   *
   * A default is a number this file invented, which is the one thing it may not
   * do — and it would be the most dangerous kind, because it would render as a
   * plausible line on a chart under a citation panel that says the model is
   * sourced. A country whose parameter set is incomplete is a country that is
   * not ready, and `simulation_scenarios.countries` is where that is declared.
   */
  const required = REQUIRED_PARAMS[modelKey] ?? [];
  const missing = required.filter((key) => !Number.isFinite(toNumber(parameters?.[key])));
  if (missing.length > 0) {
    throw new Error(
      `Model "${modelKey}" is missing parameters: ${missing.join(', ')}. ` +
        'Every coefficient must come from simulation_parameters — no defaults.'
    );
  }

  /* Sign contracts, checked before the arithmetic — see PARAM_SIGNS. */
  const wrongSign = [];
  for (const [key, expected] of Object.entries(PARAM_SIGNS)) {
    if (!required.includes(key)) continue;
    const value = toNumber(parameters[key]);
    if (expected === 'negative' && value > 0) wrongSign.push(`${key} must be negative, got ${value}`);
    if (expected === 'positive' && value < 0) wrongSign.push(`${key} must be positive, got ${value}`);
  }
  if (wrongSign.length > 0) {
    throw new Error(
      `Model "${modelKey}" has parameters with the wrong sign: ${wrongSign.join('; ')}. ` +
        'A flipped sign inverts the model silently — check the seed against the cited table.'
    );
  }

  const requiredInputs = REQUIRED_INPUTS[modelKey] ?? [];
  const missingInputs = requiredInputs.filter(
    (key) => !Number.isFinite(toNumber(inputs?.[key]))
  );
  if (missingInputs.length > 0) {
    throw new Error(
      `Model "${modelKey}" is missing inputs: ${missingInputs.join(', ')}`
    );
  }

  if (!Number.isInteger(horizonYears) || horizonYears < 1 || horizonYears > 20) {
    throw new Error(`horizonYears must be an integer between 1 and 20, got ${horizonYears}`);
  }

  /* Coerce once, so a model body never has to wonder whether it holds a string.
     Postgres NUMERIC arrives over the wire as a string, so this is not
     defensive — it is the normal path. */
  const numericParams = Object.fromEntries(
    Object.entries(parameters).map(([k, v]) => [k, toNumber(v)])
  );

  return model({ inputs, parameters: numericParams, horizonYears });
}

/** Which parameters a model needs — used by the seed checker and the tests. */
export function requiredParameters(modelKey) {
  return [...(REQUIRED_PARAMS[modelKey] ?? [])];
}

/**
 * Stable hash of a run's identity, for the cache and for narration's grounding.
 *
 * Keys are sorted and values are coerced through Number before stringifying, so
 * `?shock_usd_bn=50` and `?shock_usd_bn=50.0` — the same run, arriving as
 * different strings from a URL — do not become two cache entries carrying two
 * separately generated narrations of identical numbers.
 */
export function runHash({ scenarioId, countryIso3, inputs }) {
  const canonical = Object.keys(inputs)
    .sort()
    .map((key) => `${key}=${Number(inputs[key])}`)
    .join('&');
  return createHash('sha256')
    .update(`${scenarioId}|${countryIso3}|${canonical}`)
    .digest('hex');
}

export const __testing = { MODELS, REQUIRED_PARAMS, round };
