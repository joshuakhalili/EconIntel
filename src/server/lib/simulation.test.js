/**
 * Tests for the simulation engine.
 *
 * The refusals are tested first and hardest. Correctness of the arithmetic
 * matters, but a wrong number in a chart is at least visible — whereas the
 * failure this module is actually built to prevent is a DEFAULTED coefficient,
 * which renders as a perfectly plausible line under a citation panel claiming
 * the model is sourced. That failure has no visual signature at all, so it has
 * to be caught here or not at all.
 *
 * The arithmetic tests use round parameters chosen so the expected values can
 * be computed by hand and written down in the assertion. Fixtures that need a
 * calculator to verify test that the code still does what it did, not that it
 * does what it should.
 *
 * Run with: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { runScenario, runHash, requiredParameters, MODEL_VERSION } from './simulation.js';

/**
 * Deliberately round numbers, not realistic ones.
 *
 * GDP of 1,000 (bn) and a shock of 100 makes the shock exactly 10% of output,
 * so every downstream figure is hand-checkable. Real parameters live in the
 * seed with citations attached; a test that imported them would break every
 * time the research was refined, which is the wrong thing to be brittle about.
 *
 * The multiplier profile rises across the horizon, because the published one
 * does — IMF WP/15/95 runs 0.457 to 1.539 over five years. A fixture that
 * decayed would let the old geometric model pass these tests unchanged.
 *
 * Note the fixture is deliberately violent: a shock worth 10% of GDP against
 * an Okun coefficient of −0.5 puts unemployment through zero and out the other
 * side by year two. That is not a bug in the assertions below, it is the
 * linearity failure this model is required to declare on the page — the
 * equations have no floor under unemployment and will happily print one.
 */
const PARAMS = {
  gdp_usd_bn: 1000,
  fiscal_multiplier_y1: 1,
  fiscal_multiplier_y2: 1.5,
  fiscal_multiplier_y3: 2,
  fiscal_multiplier_y4: 2.5,
  fiscal_multiplier_y5: 3,
  /* Negative, as published — Okun's law is estimated as U − U* = β(Y − Y*). */
  okun_coefficient: -0.5,
  unemployment_baseline: 5,
  wage_phillips_slope: 0.4,
  wage_persistence: 0.5,
  price_phillips_slope: 0.2,
  wage_price_passthrough: 0.5,
  inflation_anchor: 2,
};

const run = (inputs, overrides = {}, horizonYears = 3) =>
  runScenario({
    modelKey: 'investment_shock_v1',
    inputs,
    parameters: { ...PARAMS, ...overrides },
    horizonYears,
  });

describe('runScenario — refusals', () => {
  test('throws, naming every missing parameter, rather than defaulting one', () => {
    const { okun_coefficient, inflation_anchor, ...incomplete } = PARAMS;

    assert.throws(
      () =>
        runScenario({
          modelKey: 'investment_shock_v1',
          inputs: { shock_usd_bn: 100 },
          parameters: incomplete,
          horizonYears: 3,
        }),
      (error) => {
        assert.match(error.message, /okun_coefficient/);
        assert.match(error.message, /inflation_anchor/);
        return true;
      },
      'a missing coefficient must be an error, never a default'
    );
  });

  test('rejects a parameter that is present but not a number', () => {
    assert.throws(
      () => run({ shock_usd_bn: 100 }, { okun_coefficient: null }),
      /okun_coefficient/
    );
    assert.throws(
      () => run({ shock_usd_bn: 100 }, { okun_coefficient: 'unknown' }),
      /okun_coefficient/
    );
  });

  test('rejects a missing input rather than treating it as zero', () => {
    assert.throws(() => run({}), /shock_usd_bn/);
  });

  /*
   * The transcription error this whole feature is most exposed to: a
   * coefficient hand-copied out of a PDF table with its minus sign lost. It
   * cannot crash, so it has to be refused.
   */
  test('rejects a positive Okun coefficient — a dropped minus inverts the model', () => {
    assert.throws(
      () => run({ shock_usd_bn: 100 }, { okun_coefficient: 0.5 }),
      /okun_coefficient must be negative/
    );
  });

  test('rejects a negative persistence', () => {
    assert.throws(() => run({ shock_usd_bn: 100 }, { wage_persistence: -0.5 }), /wage_persistence/);
  });

  /*
   * Every year of the multiplier is a separately cited cell, so every year of
   * it is separately refusable. Losing one in the middle of the profile is the
   * realistic seed mistake — nine rows inserted where ten were meant — and it
   * must not become an undefined that arrives at the arithmetic as NaN.
   */
  test('names a missing year of the multiplier profile rather than skipping it', () => {
    const { fiscal_multiplier_y3, ...incomplete } = PARAMS;

    assert.throws(
      () =>
        runScenario({
          modelKey: 'investment_shock_v1',
          inputs: { shock_usd_bn: 100 },
          parameters: incomplete,
          horizonYears: 5,
        }),
      /fiscal_multiplier_y3/
    );
  });

  /*
   * The decay parameter is gone and must stay gone. It could not be sourced —
   * no paper publishes one — and it pointed the wrong way against both IMF
   * sources. Reintroducing it would be silent: the engine would still run, the
   * chart would still draw, and the only visible difference would be a shape
   * nobody could cite.
   */
  test('does not accept a fitted decay parameter any more', () => {
    assert.ok(
      !requiredParameters('investment_shock_v1').includes('multiplier_decay'),
      'multiplier_decay was replaced by the published annual profile — see REQUIRED_PARAMS'
    );

    /* Supplying one changes nothing, rather than quietly re-entering the model. */
    const withDecay = run({ shock_usd_bn: 100 }, { multiplier_decay: 0.5 });
    assert.deepEqual(withDecay.years, run({ shock_usd_bn: 100 }).years);
  });

  test('rejects an unknown model, listing what exists', () => {
    assert.throws(
      () =>
        runScenario({
          modelKey: 'no_such_model',
          inputs: { shock_usd_bn: 1 },
          parameters: PARAMS,
          horizonYears: 3,
        }),
      /investment_shock_v1/
    );
  });

  test('rejects an out-of-range horizon', () => {
    for (const horizon of [0, -1, 21, 2.5]) {
      assert.throws(() => run({ shock_usd_bn: 100 }, {}, horizon), /horizonYears/);
    }
  });

  /*
   * The cap, which is the whole of the "we do not extrapolate" decision made
   * executable. AFT publish five years; year six is not a smaller number or a
   * flat number, it is an absent number, and the engine says so rather than
   * drawing the tail a reader would take at face value.
   */
  test('refuses a horizon longer than the published profile', () => {
    assert.throws(
      () => run({ shock_usd_bn: 100 }, {}, 6),
      /published only to year 5/
    );
    /* Exactly five is the last year that exists, and it must still run. */
    assert.equal(run({ shock_usd_bn: 100 }, {}, 5).years.length, 5);
  });

  test('accepts numeric strings, because Postgres NUMERIC arrives as one', () => {
    const fromStrings = runScenario({
      modelKey: 'investment_shock_v1',
      inputs: { shock_usd_bn: '100' },
      parameters: Object.fromEntries(
        Object.entries(PARAMS).map(([k, v]) => [k, String(v)])
      ),
      horizonYears: 3,
    });
    assert.deepEqual(fromStrings.years, run({ shock_usd_bn: 100 }).years);
  });
});

describe('runScenario — the null case', () => {
  /*
   * A zero shock must produce a dead-flat series sitting exactly on the
   * baseline. This is the single most important arithmetic test in the file:
   * if the no-shock case drifts, then every scenario shows movement that the
   * model does not actually claim, and the whole feature is reporting its own
   * rounding as an economic effect.
   */
  test('a zero shock moves nothing, in any year', () => {
    const result = run({ shock_usd_bn: 0 }, {}, 5);

    for (const year of result.years) {
      assert.equal(year.output_gap_pp, 0, `year ${year.year} output gap`);
      assert.equal(year.unemployment_gap_pp, 0, `year ${year.year} unemployment gap`);
      assert.equal(year.wage_growth_gap_pp, 0, `year ${year.year} wage gap`);
      assert.equal(year.inflation_gap_pp, 0, `year ${year.year} inflation gap`);

      assert.equal(year.unemployment_pct, PARAMS.unemployment_baseline);
      assert.equal(year.inflation_pct, PARAMS.inflation_anchor);
    }
  });
});

describe('runScenario — hand-computed arithmetic', () => {
  /*
   * Year one, worked by hand with the fixture above:
   *
   *   shock share    = 100 / 1000            = 10 pp of GDP
   *   multiplier(1)  = fiscal_multiplier_y1  = 1     (read, not computed)
   *   output gap     = 1 * 10                = 10.00 pp
   *   unemp gap      = -0.5 * 10             = -5.00 pp   -> 5 - 5   = 0.00%
   *                    (β is negative, so no sign is flipped in the equation)
   *   wage deviation = 0.4 * 5 + 0.5 * 0     =  2.00 pp  (deviation only)
   *   inflation dev  = 0.2 * 5 + 0.5 * 2     =  2.00 pp   -> 2 + 2   = 4.00%
   */
  test('year one matches the chain computed by hand', () => {
    const [y1] = run({ shock_usd_bn: 100 }).years;

    assert.equal(y1.output_gap_pp, 10);
    assert.equal(y1.unemployment_gap_pp, -5);
    assert.equal(y1.unemployment_pct, 0);
    assert.equal(y1.wage_growth_gap_pp, 2);
    assert.equal(y1.wage_growth_pct, undefined,
      'wage growth has no sourced baseline, so no level may be emitted');
    assert.equal(y1.inflation_gap_pp, 2);
    assert.equal(y1.inflation_pct, 4);
  });

  /*
   * Year two, one-off shock — the second published cell, and wage persistence
   * carrying half of year one's deviation forward:
   *
   *   multiplier(2)  = fiscal_multiplier_y2  = 1.5
   *   output gap     = 1.5 * 10              = 15.00 pp
   *   unemp gap      = -0.5 * 15             = -7.50 pp   -> 5 - 7.5 = -2.50%
   *   wage deviation = 0.4 * 7.5 + 0.5 * 2   =  4.00 pp  (deviation only)
   *   inflation dev  = 0.2 * 7.5 + 0.5 * 4   =  3.50 pp   -> 2 + 3.5 =  5.50%
   *
   * The −2.50% is the fixture being extreme, and it is left visible on
   * purpose. See the note on PARAMS.
   */
  test('year two reads the next published cell and carries wage persistence forward', () => {
    const [, y2] = run({ shock_usd_bn: 100 }).years;

    assert.equal(y2.output_gap_pp, 15);
    assert.equal(y2.unemployment_gap_pp, -7.5);
    assert.equal(y2.unemployment_pct, -2.5);
    assert.equal(y2.wage_growth_gap_pp, 4);
    assert.equal(y2.inflation_gap_pp, 3.5);
    assert.equal(y2.inflation_pct, 5.5);
  });

  /*
   * A one-off shock BUILDS across the horizon. This is the assertion the old
   * geometric model would fail, and it is the finding it was replaced over:
   * AFT put output 0.46% higher in the shock year and 1.54% higher four years
   * on, so the money keeps working rather than wearing off.
   */
  test('a one-off shock builds across the published horizon', () => {
    const gaps = run({ shock_usd_bn: 100 }, {}, 5).years.map((y) => y.output_gap_pp);

    for (let i = 1; i < gaps.length; i += 1) {
      assert.ok(gaps[i] > gaps[i - 1], `output gap must grow each year (year ${i + 1})`);
    }
    assert.equal(gaps.at(-1), 30, 'year five is fiscal_multiplier_y5 * the shock share');
  });

  /*
   * Sustained: year two lays a fresh impulse on top of the first vintage's
   * year-two response, so the multiplier is 1 + 1.5 = 2.5 and the output gap
   * is 25 pp against the one-off case's 15.
   */
  test('a sustained shock accumulates on top of the one-off path', () => {
    const sustained = run({ shock_usd_bn: 100, sustained: 1 }, {}, 4);
    const oneOff = run({ shock_usd_bn: 100, sustained: 0 }, {}, 4);

    assert.equal(sustained.years[0].output_gap_pp, oneOff.years[0].output_gap_pp,
      'year one is identical — the difference only begins in year two');
    assert.equal(sustained.years[1].output_gap_pp, 25);
    assert.ok(sustained.years[3].output_gap_pp > oneOff.years[3].output_gap_pp);
  });

  test('the effect scales with the size of the shock', () => {
    const small = run({ shock_usd_bn: 50 }).years[0];
    const large = run({ shock_usd_bn: 100 }).years[0];
    assert.equal(large.output_gap_pp, small.output_gap_pp * 2);
  });

  test('a negative shock reverses every sign', () => {
    const [y1] = run({ shock_usd_bn: -100 }).years;
    assert.equal(y1.output_gap_pp, -10);
    assert.equal(y1.unemployment_gap_pp, 5);
    assert.ok(y1.inflation_pct < PARAMS.inflation_anchor, 'a contraction must disinflate');
  });
});

describe('runScenario — country differentiation', () => {
  /*
   * The feature's central claim is that the UK and the US differ because their
   * published coefficients differ, with no branch anywhere in the engine. This
   * asserts the mechanism actually works: same model, same inputs, one
   * parameter changed, different answer.
   */
  test('the same shock gives a different answer under a different parameter set', () => {
    const asUs = run({ shock_usd_bn: 100 });
    const asOther = run({ shock_usd_bn: 100 }, { fiscal_multiplier_y1: 0.6 });

    assert.equal(asUs.years[0].output_gap_pp, 10);
    assert.equal(asOther.years[0].output_gap_pp, 6);
    assert.notEqual(asUs.years[0].inflation_pct, asOther.years[0].inflation_pct);
  });
});

describe('runScenario — the grounding payload', () => {
  /*
   * Narration may only write numbers it was handed. Anything the prose needs to
   * describe the shock itself — its size, its share of GDP — must therefore be
   * IN the result, or the gate will reject a correct sentence for quoting a
   * figure that is on the reader's screen but not in the grounding.
   */
  test('restates the shock, so narration may describe it', () => {
    const result = run({ shock_usd_bn: 100 });
    assert.equal(result.shock.usd_bn, 100);
    assert.equal(result.shock.share_of_gdp_pct, 10);
    assert.equal(result.shock.sustained, false);
  });

  test('restates the baseline, so narration may compare against it', () => {
    const result = run({ shock_usd_bn: 100 });
    assert.deepEqual(result.baseline, {
      unemployment_pct: 5,
      inflation_pct: 2,
      wage_growth_gap_pp: 0,
    });
  });

  test('every emitted number is finite', () => {
    const result = run({ shock_usd_bn: 100 }, {}, 5);
    for (const year of result.years) {
      for (const [key, value] of Object.entries(year)) {
        assert.ok(Number.isFinite(value), `${key} in year ${year.year} is not finite`);
      }
    }
  });
});

describe('runHash', () => {
  test('is stable across key order', () => {
    const a = runHash({ scenarioId: 's', countryIso3: 'USA', inputs: { a: 1, b: 2 } });
    const b = runHash({ scenarioId: 's', countryIso3: 'USA', inputs: { b: 2, a: 1 } });
    assert.equal(a, b);
  });

  /* '50' and 50 are the same run arriving from a URL and from a test. Two cache
     entries for one run would mean two separately generated narrations of
     identical numbers. */
  test('is stable across string and numeric forms of the same value', () => {
    const a = runHash({ scenarioId: 's', countryIso3: 'USA', inputs: { shock: '50' } });
    const b = runHash({ scenarioId: 's', countryIso3: 'USA', inputs: { shock: 50 } });
    const c = runHash({ scenarioId: 's', countryIso3: 'USA', inputs: { shock: 50.0 } });
    assert.equal(a, b);
    assert.equal(b, c);
  });

  test('separates scenarios, countries and values', () => {
    const base = { scenarioId: 's', countryIso3: 'USA', inputs: { shock: 50 } };
    assert.notEqual(runHash(base), runHash({ ...base, scenarioId: 't' }));
    assert.notEqual(runHash(base), runHash({ ...base, countryIso3: 'GBR' }));
    assert.notEqual(runHash(base), runHash({ ...base, inputs: { shock: 51 } }));
  });
});

describe('module contract', () => {
  test('requiredParameters names the full contract and cannot be mutated', () => {
    const params = requiredParameters('investment_shock_v1');
    assert.ok(params.includes('okun_coefficient'));
    assert.ok(params.includes('gdp_usd_bn'));

    /* Every year of the profile has to be in the contract, because that is
       what makes `check:data` demand a cited row for each one. A year the
       contract forgets is a year nobody has to source. */
    for (let year = 1; year <= 5; year += 1) {
      assert.ok(
        params.includes(`fiscal_multiplier_y${year}`),
        `fiscal_multiplier_y${year} must be required, or its cell need never be cited`
      );
    }

    params.push('injected');
    assert.ok(
      !requiredParameters('investment_shock_v1').includes('injected'),
      'the returned array must be a copy — a caller must not be able to edit the contract'
    );
  });

  test('MODEL_VERSION is set, so cached runs can be invalidated', () => {
    assert.match(MODEL_VERSION, /^v\d+-\d{4}-\d{2}-\d{2}$/);
  });
});
