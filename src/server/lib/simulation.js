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
 *   spending  →  output       the published annual fiscal-multiplier profile
 *   output    →  unemployment Okun's law
 *   unemployment → wages      a wage Phillips curve, with persistence
 *   wages     →  prices       pass-through, plus a direct Phillips term
 *
 * It is linear, it has no expectations, no monetary policy reaction, no
 * capacity constraint and no feedback from prices back to output. Each of those
 * omissions makes it wrong in a knowable direction, and `scenario.caveat` is
 * required by the schema so the page has to say so.
 *
 * A caveat is not enough on its own, though, and this was shipped before it was
 * fixed. Linear means the arithmetic never stops: drag the flagship's injection
 * slider under halfway and the equations put French unemployment at −1.6%, and
 * the chart drew it, dashed and captioned and completely impossible. So every
 * run now returns `validity` alongside its numbers, saying whether it left the
 * range where a result can exist at all, and the page refuses to draw the part
 * that could not have happened. See `checkRange`.
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
 *
 * v3 changed no arithmetic at all and still had to bump, which is the case
 * that is easy to get wrong. It added `validity` to the result, and the client
 * refuses to draw a run whose `validity.ok` is false. A cached v2 row has no
 * such key, so it would arrive at that check as `undefined`, be read as "not
 * false", and draw the impossible path — the exact chart this version exists to
 * prevent, served only to the readers whose run happened to be cached. The rule
 * is therefore the SHAPE of the result, not just its numbers.
 */
export const MODEL_VERSION = 'v3-2026-09-03';

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
    /*
     * THE MULTIPLIER IS FIVE CITED CELLS, NOT ONE CELL AND A FITTED CURVE.
     *
     * This model used to carry `fiscal_multiplier_y1` and `multiplier_decay`,
     * and compute year t as `y1 × decay^(t−1)`. That was wrong twice over.
     *
     * It could not be sourced. The research round of 31 Aug 2026 went looking
     * for a published geometric decay parameter for a fiscal multiplier and
     * found that no such number exists anywhere in the literature — every
     * survey reports CUMULATIVE multipliers, which by construction cannot give
     * a per-year decay. See `docs/research/simulation-coefficients-2026-08-31.md`
     * §2, which is titled "NOT VERIFIABLE as a published coefficient".
     *
     * And it pointed the wrong way. Both IMF sources say the investment
     * multiplier RISES over exactly the horizon this model runs — Abiad,
     * Furceri & Topalova put output 0.46% higher in the shock year and 1.54%
     * higher four years on. A decay below 1 does not merely mis-size that; it
     * inverts the shape of the thing it claims to describe.
     *
     * So the shape is looked up too, not just the numbers. Each year of the
     * horizon is its own parameter, each one a cell from IMF WP/15/95 Table 1
     * column (1) — k = 0 through k = 4 — carrying its own standard error and
     * its own citation in `simulation_parameters`. There is no fitted
     * parameter left in the multiplier at all, which is the point: the
     * project's rule is that coefficients are looked up rather than estimated,
     * and a decay rate we chose was that rule broken at the level of the
     * model's SHAPE while every individual number still looked cited.
     */
    'fiscal_multiplier_y1',    // AFT Table 1, k = 0 — the impact year
    'fiscal_multiplier_y2',    // k = 1
    'fiscal_multiplier_y3',    // k = 2
    'fiscal_multiplier_y4',    // k = 3
    'fiscal_multiplier_y5',    // k = 4 — the last horizon the paper publishes
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
 * The multiplier profile, in horizon order. Names only — the values are rows.
 *
 * Kept as its own list rather than filtered out of `REQUIRED_PARAMS` by a
 * prefix match, because the order is load-bearing: index 0 is the impact year
 * and the model indexes straight into it. A regex over parameter names would
 * make that ordering depend on how somebody spells the tenth year, and
 * `fiscal_multiplier_y10` sorts before `fiscal_multiplier_y2`.
 */
const MULTIPLIER_PROFILE = [
  'fiscal_multiplier_y1',
  'fiscal_multiplier_y2',
  'fiscal_multiplier_y3',
  'fiscal_multiplier_y4',
  'fiscal_multiplier_y5',
];

/**
 * How far each model may be run, and why this one stops at five.
 *
 * AFT publish k = 0 to k = 4 and nothing beyond, so year six is a number this
 * project would have to make up. Two ways to make one up were available and
 * both are refused here:
 *
 *   Extrapolate the trend. The profile is still climbing at k = 4 (1.389 →
 *   1.539), so continuing it puts the multiplier through 1.7 and beyond on no
 *   evidence at all. Rejected outright — it is the most confident possible
 *   version of inventing a number.
 *
 *   Hold flat at 1.539. This is the tempting one, because it LOOKS like
 *   modesty. It is not: the published profile is rising when it stops, so
 *   flattening it asserts that the peak falls exactly at year five, which the
 *   paper does not say and no other source says either. It would also be
 *   invisible — a flat tail on a chart reads as a result, and this engine's
 *   whole design premise is that a plausible line is the dangerous failure.
 *
 * So the horizon is capped instead, and asking for more is an error rather
 * than an extrapolation. A reader who wants year eight is asking a question
 * the literature has not answered, and the honest response is to say so.
 */
const MAX_HORIZON_YEARS = {
  investment_shock_v1: MULTIPLIER_PROFILE.length,
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
  /*
   * The five multiplier years are deliberately absent from this list.
   *
   * `multiplier_decay` was here and had to be, because a negative decay rate
   * is not a claim anybody makes — it would oscillate the sign of the shock
   * year by year and mean nothing. The published profile is different: a
   * negative multiplier at some horizon is a real position in the literature
   * (crowding out, expansionary austerity), so constraining these to positive
   * would refuse a coefficient a future source might genuinely publish. AFT's
   * five cells are all positive; that is a fact about the source, not a
   * contract the engine should enforce.
   */
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
     injects in year one only and the published profile carries the rest. */
  const sustained = toNumber(inputs.sustained) >= 1;

  /* The impulse response, year by year, straight out of the parameter table.
     `runScenario` has already refused a horizon longer than this array, so
     `profile[t - 1]` below is always a real number rather than an undefined
     that would arrive downstream as NaN. */
  const profile = MULTIPLIER_PROFILE.map((key) => p[key]);

  /* The shock as a percentage of baseline output. Everything downstream is in
     percentage points, so this conversion happens once, here, and no other
     equation has to know what a dollar is. */
  const shockShare = (shockUsdBn / p.gdp_usd_bn) * 100;

  const years = [];
  let previousWageDeviation = 0;

  for (let t = 1; t <= horizonYears; t += 1) {
    /*
     * The multiplier is read off the published profile, not computed.
     *
     * A one-off injection keeps moving output in later years — the money is
     * spent onward — and in AFT's estimates it moves it by MORE each year for
     * four years, not less. `profile[t − 1]` is that path, cell for cell.
     *
     * A sustained injection lays a fresh impulse on top of every previous
     * year's, so year t carries the year-t response of the first vintage, the
     * year-(t−1) response of the second, and so on down to the impulse just
     * made. That sum is superposition, which is exactly what a linear model
     * licenses and nothing more — and it is also where this model gets least
     * trustworthy fastest, because reality has a capacity constraint and this
     * arithmetic does not. `scenario.caveat` has to say so.
     */
    let multiplier;
    if (sustained) {
      multiplier = 0;
      for (let vintage = 0; vintage < t; vintage += 1) {
        multiplier += profile[vintage];
      }
    } else {
      multiplier = profile[t - 1];
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

/* ── Where the arithmetic leaves the world ───────────────────────────────── */

/**
 * The bounds of the unit itself, and why two numbers are allowed to be here.
 *
 * This file's rule is that it contains no numbers, because a number in an
 * equation is an uncited claim about the world. These two are not that, and the
 * distinction is worth being exact about rather than waving at: a coefficient is
 * a claim that could have come out another way — Okun's β is −0.56 and might
 * have been −0.4, so somebody has to have measured it and be named. Zero and one
 * hundred could not have come out another way. Unemployment is the share of the
 * labour force without work; a share of a population is bounded by nought and by
 * all of it, by construction, in every country, for every year, under every
 * school of economics. Nobody publishes it because there is nothing to publish.
 *
 * That is also precisely why THESE are the bounds this file checks and no
 * others. The tempting additions all fail the same test:
 *
 *   "unemployment below about 2% is implausible" — true, probably, and a
 *   number this project would be choosing. Frictional unemployment is a real
 *   floor but its level is contested and country-specific, and 2 would sit in
 *   the code looking exactly as sourced as −0.563.
 *
 *   "inflation above 10% is outside the Phillips curve's estimation sample" —
 *   the direction is right and the threshold is invented. The papers behind
 *   `price_phillips_slope` do not publish the range over which their slope
 *   stops holding, so any figure written here would be this project's own
 *   opinion wearing a citation's clothes, which is the one thing the whole
 *   module is built to refuse. It would also be the worse kind of invention:
 *   invisible, because it would only ever surface as a warning that looked
 *   authoritative.
 *
 * So the engine reports the structurally impossible and stays quiet about the
 * merely improbable. The page carries `scenario.caveat` for the rest, which is
 * where a judgement belongs — written by a person, in prose, over a signature.
 *
 * AND THE ZONE IN BETWEEN IS NOT LEFT SILENT, IT IS LEFT TO ARITHMETIC.
 *
 * Refusing a floor left a cliff: every path down to 0.00% drew as an ordinary
 * projection with nothing said about it, and one hundredth of a point further
 * the chart truncated with four paragraphs of explanation. Six drawn years
 * across the slider's own $10bn steps sit at exactly 0.00% — USA sustained
 * $930bn year three, ITA one-off $690bn year three, and JPN one-off at $450bn
 * year five, $500bn year four, $670bn year three and $920bn year two — and none
 * of them trips this check, because 0 is a rate that exists.
 *
 * The answer is not a threshold here. It is two facts stated on the chart, both
 * subtraction over figures already on the page, neither of them an opinion:
 * how far the model moved the rate from its own baseline, and the largest move
 * of that many years the MEASURED series has ever made. France at the default
 * with the injection repeated reads "moves at most 6.06 percentage points below
 * its measured baseline of 7.4%" beside "the largest 5-year move in the
 * measured record — 2000 to 2025 — is 2.53 points, between 2008 and 2013. This
 * run moves unemployment further than that." Absurdity becomes legible without
 * anybody here having to say where it begins. See `deviationText`, `largestMove`
 * and `recordText` in `routes/SimulationPage.jsx`.
 *
 * That is also why nothing below should be "improved" into a soft floor. The
 * only version that would not be an invention is a looked-up one — OECD and IMF
 * both publish structural-unemployment estimates per country — and that is an
 * ingestion task with a citation, not a constant.
 */
const UNEMPLOYMENT_MIN_PCT = 0;
const UNEMPLOYMENT_MAX_PCT = 100;

/**
 * Did this run produce something that cannot exist?
 *
 * A separate question from every other check in this file, and it has to be
 * answered differently. A missing coefficient, a flipped sign, a horizon past
 * the last published cell: all of those are the CALLER wrong, so they throw at
 * the door and nothing is computed. This one is nobody wrong. The parameters are
 * all cited, the inputs are all inside the bounds the page published, the
 * arithmetic is exactly what the literature implies — and the answer is still
 * that 4.5% of the French labour force minus 5.2 points of it is a negative
 * number of people.
 *
 * That is the model's linearity failing, which `scenario.caveat` already says
 * will happen and cannot say where. Throwing would be wrong twice: it would turn
 * a legitimate reader question into a 500, and it would destroy the one thing
 * worth showing, which is the part of the horizon that IS still inside the
 * range. So this returns a verdict and the caller decides.
 *
 * Checked against the ROUNDED, published figures rather than the raw ones, so
 * that the verdict and the chart can never disagree. A year that renders as
 * "0.00%" is on the boundary, not past it, and refusing to draw a value the
 * reader would see as zero would be a refusal they could not check.
 *
 * Applied to every model's output rather than written inside one, because a
 * model added later must not be able to forget it. Rows without an
 * `unemployment_pct` simply pass — a future model that projects something else
 * needs its own structural bound, and inheriting silence is better than
 * inheriting a check on a field it does not have.
 */
function checkRange(years) {
  const reasons = [];

  for (const year of years) {
    const u = year.unemployment_pct;
    if (typeof u !== 'number') continue;

    if (u < UNEMPLOYMENT_MIN_PCT) {
      reasons.push({
        year: year.year,
        kind: 'unemployment_below_zero',
        metric: 'unemployment_pct',
        value: u,
        /* The sentence lives here, not in the component, because it has two
           readers: the page renders it, and anyone reading this endpoint's JSON
           gets the same explanation rather than a bare enum they would have to
           look up in this file. */
        message:
          `Unemployment reaches ${u}% in year ${year.year}, which cannot happen: ` +
          'a rate below zero does not exist.',
      });
    } else if (u > UNEMPLOYMENT_MAX_PCT) {
      reasons.push({
        year: year.year,
        kind: 'unemployment_above_labour_force',
        metric: 'unemployment_pct',
        value: u,
        message:
          `Unemployment reaches ${u}% in year ${year.year}, which cannot happen: ` +
          'no more people can be unemployed than are in the labour force.',
      });
    }
  }

  return {
    ok: reasons.length === 0,
    /*
     * The first breach, not the list, is what a caller should draw up to — and
     * the difference matters when the breaches are not contiguous.
     *
     * Once a year is impossible, the years after it are not innocent. Wage
     * persistence carries that year's deviation forward by construction, so
     * year four is computed FROM the negative unemployment of year three; it
     * inherits the failure whether or not its own unemployment reads positive.
     * A caller that drew every individually-valid year would draw a line with a
     * hole in it, which is a chart claiming the model recovered.
     */
    first_invalid_year: reasons.length > 0 ? reasons[0].year : null,
    reasons,
  };
}

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

  /*
   * And no further than the model's own evidence reaches — see MAX_HORIZON_YEARS.
   *
   * The schema's `horizon_years` allows up to 20 because that is a sensible
   * bound for a column, not because this model can honour it. A scenario row
   * asking for eight years is a seed mistake, and this is where it surfaces:
   * loudly, at the door, naming the number of years that actually exist,
   * rather than as three undefined multipliers arriving downstream as NaN.
   */
  const maxHorizon = MAX_HORIZON_YEARS[modelKey];
  if (maxHorizon !== undefined && horizonYears > maxHorizon) {
    throw new Error(
      `Model "${modelKey}" is published only to year ${maxHorizon}, but the ` +
        `scenario asks for ${horizonYears}. The horizon is capped rather than ` +
        'extrapolated — beyond the last published cell there is no coefficient ' +
        'to cite, and a line drawn there would be this project inventing one.'
    );
  }

  /* Coerce once, so a model body never has to wonder whether it holds a string.
     Postgres NUMERIC arrives over the wire as a string, so this is not
     defensive — it is the normal path. */
  const numericParams = Object.fromEntries(
    Object.entries(parameters).map(([k, v]) => [k, toNumber(v)])
  );

  const result = model({ inputs, parameters: numericParams, horizonYears });

  /*
   * Every year is still returned, including the impossible ones.
   *
   * Truncating here was the first instinct and it is wrong. The caller cannot
   * explain what it is not showing if it never receives it, and "the projection
   * stops at year three" is a much weaker thing to tell a reader than "at this
   * size the model puts unemployment at −0.7% in year four". The engine's job is
   * to say what the equations produced and whether it can exist; hiding the
   * evidence for its own verdict would make that verdict unauditable.
   */
  return { ...result, validity: checkRange(result.years) };
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
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A RUN'S IDENTITY IS ITS INPUTS *AND* ITS COEFFICIENTS. IT USED NOT TO BE.
 *
 * This took `{scenarioId, countryIso3, inputs}` and nothing else, so the cache
 * key fingerprinted the slider and not one of the thirteen numbers the model
 * actually multiplies by. Correct a coefficient in `db/seeds/034`, re-seed, and
 * every slider position a reader had already visited went on returning the
 * stored PRE-CORRECTION numbers indefinitely — while the "Every coefficient,
 * and its source" panel directly beneath the chart showed the new value. The
 * chart would have disagreed with the citation printed under it, silently and
 * permanently, on the one page whose argument is that its numbers are
 * checkable. This project's answer to an error is a documented correction, and
 * a correction that cannot reach the reader is not one.
 *
 * The whole parameter set is hashed, not the subset the model reads, and that
 * is deliberate. Hashing only `REQUIRED_PARAMS` would mean a corrected row that
 * this model happens not to use leaves the cache untouched — right today, wrong
 * the moment a model starts reading it, and wrong in the invisible direction. A
 * spurious cache miss costs microseconds of arithmetic; a spurious cache HIT
 * costs a reader the corrected number.
 *
 * `MODEL_VERSION` is in the digest too, which is what makes a version bump
 * reach the NARRATION as well as the run. `simulation_runs` already keys on
 * `model_version` directly, but `narrations` has no such column — it keys on
 * (scope, input_hash, prompt_version) — so bumping the version invalidated the
 * runs and kept the prose written about the old ones. That is precisely the
 * failure MODEL_VERSION's own docblock says it exists to prevent. Folding it in
 * here fixes both with one key and no migration. (A `model_version` column on
 * `narrations` would be the tidier expression of the same rule; it needs a
 * migration, so it is the owner's call.)
 *
 * `parameters` is REQUIRED rather than optional. An optional argument that
 * silently reverts to the old behaviour when a caller forgets it is this bug
 * with a longer fuse.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * @param {object} options
 * @param {string} options.scenarioId
 * @param {string} options.countryIso3
 * @param {object} options.inputs      slider values
 * @param {object} options.parameters  flat {param_key: value}, as `getParameters` returns
 * @param {string} [options.modelVersion] defaults to MODEL_VERSION; an argument
 *   only so a test can prove a bump changes the hash without editing the constant
 */
export function runHash({ scenarioId, countryIso3, inputs, parameters, modelVersion = MODEL_VERSION }) {
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new Error(
      'runHash requires the parameter set. A run cached without it survives a ' +
        'corrected coefficient, and the reader keeps the old number.'
    );
  }

  const canonical = Object.keys(inputs)
    .sort()
    .map((key) => `${key}=${Number(inputs[key])}`)
    .join('&');

  /* `toNumber`, not `Number`: `Number(null)` is 0, so a NULL coefficient and a
     coefficient of nought would hash identically — the same collision the
     engine's own coercion note is about. NaN is fine as a digest token; a run
     with one never gets past `runScenario`. */
  const coefficients = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${toNumber(parameters[key])}`)
    .join('&');

  return createHash('sha256')
    .update(`${scenarioId}|${countryIso3}|${modelVersion}|${canonical}|${coefficients}`)
    .digest('hex');
}

export const __testing = {
  MODELS,
  REQUIRED_PARAMS,
  MULTIPLIER_PROFILE,
  MAX_HORIZON_YEARS,
  UNEMPLOYMENT_MIN_PCT,
  UNEMPLOYMENT_MAX_PCT,
  checkRange,
  round,
};
