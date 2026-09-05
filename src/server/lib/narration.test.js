/**
 * The gate, tested adversarially.
 *
 * `validate()` is the only thing standing between a language model and a page
 * whose entire claim is that its figures are real. A test suite that only
 * checks the happy path would pass while the gate let fabrications through,
 * which is precisely the failure this file exists to prevent — the rule it
 * enforces spent months documented in STATUS.md with nothing behind it.
 *
 * So most of what follows is output that MUST be rejected.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  validate,
  wrongDirection,
  directionPairs,
  allowedNumbers,
  groundingHash,
  buildSimulationGrounding,
  buildLensGrounding,
  __testing,
} from './narration.js';
import { runScenario } from './simulation.js';

const GROUNDING = {
  lens: 'Prices & Markets',
  series: [
    { name: 'Semiconductor PPI', latest: 29.0, previous: 30.1, period: '2026-07-31' },
    { name: 'Gold', latest: 4218.55, previous: 4190.2, period: '2026-08-28' },
  ],
  observations: 74041,
};

describe('allowedNumbers', () => {
  test('collects values from anywhere in the structure', () => {
    const allowed = allowedNumbers(GROUNDING);
    assert.ok(allowed.has('29'), 'a whole number');
    assert.ok(allowed.has('4218.55'), 'a decimal');
    assert.ok(allowed.has('74041'), 'a bare integer');
    assert.ok(allowed.has('74,041'), 'the same integer with separators');
  });

  test('licenses the parts of a date string', () => {
    // A model writing "in 2026" from a date it was handed has invented nothing.
    //
    // The date is licensed part by part rather than whole: '2026-07-31' is not
    // one numeric token, and both the collector and the validator split it on
    // the hyphens. So what matters is that a model writing the date back in
    // any form passes, which is asserted below rather than here.
    const allowed = allowedNumbers(GROUNDING);
    assert.ok(allowed.has('2026'));
    assert.ok(allowed.has('31'));
  });

  test('a model writing a supplied date back passes, in either form', () => {
    assert.equal(validate('Measured on 2026-07-31.', GROUNDING).ok, true);
    assert.equal(validate('Measured in July 2026.', GROUNDING).ok, true);
  });

  test('accepts a value written to fewer decimals than it was given', () => {
    // 4218.55 -> "4218.6" or "4219" is the same measurement, less precisely.
    // Rejecting these makes the gate unusable and catches nothing: a
    // fabrication is a DIFFERENT number, not this one rounded.
    const allowed = allowedNumbers({ v: 4218.55 });
    assert.ok(allowed.has('4218.6'));
    assert.ok(allowed.has('4219'));
  });
});

describe('validate — output that must be ACCEPTED', () => {
  test('prose using only supplied numbers', () => {
    const body =
      'The semiconductor index stood at 29.0 in July, down from 30.1. Gold closed at 4218.55.';
    assert.deepEqual(validate(body, GROUNDING), { ok: true });
  });

  test('prose with no numbers at all', () => {
    const body = 'The index fell over the period while the metal rose.';
    assert.deepEqual(validate(body, GROUNDING), { ok: true });
  });

  test('a supplied number written with thousands separators', () => {
    assert.equal(validate('There are 74,041 observations.', GROUNDING).ok, true);
  });
});

describe('validate — output that must be REJECTED', () => {
  test('a fabricated figure', () => {
    // 3.7 is nowhere in the grounding. This is the whole point of the file.
    const verdict = validate('The index fell 3.7% over the year.', GROUNDING);
    assert.equal(verdict.ok, false);
    assert.deepEqual(verdict.offending, ['3.7']);
  });

  test('arithmetic the model performed itself', () => {
    // 30.1 - 29.0 = 1.1. Both inputs were supplied; the RESULT was not, and a
    // computed number is exactly what the model is forbidden to produce —
    // if the difference matters it should be computed in SQL and supplied.
    const verdict = validate('The index fell by 1.1 points.', GROUNDING);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.offending.includes('1.1'));
  });

  test('a percentage derived from supplied levels', () => {
    const verdict = validate('That is a decline of 3.65 percent.', GROUNDING);
    assert.equal(verdict.ok, false);
  });

  test('a URL', () => {
    const verdict = validate('See https://fred.stlouisfed.org for more.', GROUNDING);
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /URL/);
  });

  test('a DOI', () => {
    assert.equal(validate('Published as 10.1234/abcd.2026.', GROUNDING).ok, false);
  });

  test('a quotation', () => {
    const verdict = validate('The report called it "a turning point".', GROUNDING);
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /quotation/);
  });

  test('attribution without a URL', () => {
    // Still a citation, and this model has no sources to cite.
    const verdict = validate('According to the Federal Reserve, prices fell.', GROUNDING);
    assert.equal(verdict.ok, false);
    assert.match(verdict.reason, /attributes a source/);
  });

  test('empty output', () => {
    assert.equal(validate('', GROUNDING).ok, false);
    assert.equal(validate('   ', GROUNDING).ok, false);
    assert.equal(validate(null, GROUNDING).ok, false);
  });

  test('a plausible year that was never supplied', () => {
    // 2019 is not in the grounding. A model reaching for context it was not
    // given is inventing, even when the invention is only a date.
    const verdict = validate('Prices have fallen steadily since 2019.', GROUNDING);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.offending.includes('2019'));
  });

  test('one bad number among several good ones', () => {
    const body = 'The index was 29.0, down from 30.1, its lowest since 2015.';
    const verdict = validate(body, GROUNDING);
    assert.equal(verdict.ok, false, 'the whole narration fails, not just the clause');
    assert.deepEqual(verdict.offending, ['2015']);
  });
});

/**
 * The direction check.
 *
 * Added after the first working generation wrote "US graduate unemployment
 * decreased slightly from 3.7% to 3.8%" — both figures real, both in the
 * grounding, the number gate happily passing a sentence that reads its own
 * data backwards.
 *
 * These cases are the ones that broke it during development, kept because
 * each represents a way the check can silently stop working:
 *   - decimals and thousands separators being split as punctuation
 *   - a trailing full stop parsed into the number as NaN
 *   - a comma that IS a clause boundary versus one that is a separator
 */
describe('validate — direction', () => {
  const MOVED = {
    series: [
      { name: 'US graduate unemployment', previous: 3.7, latest: 3.8 },
      { name: 'Gold', previous: 4190.2, latest: 4218.55 },
      { name: 'Chip prices', previous: 29.75, latest: 28.99 },
      { name: 'Copper', previous: 13552, latest: 13543 },
      { name: 'Big', previous: 1234567, latest: 1234000 },
    ],
  };

  const rejects = [
    ['the sentence that caused this check to exist',
     'US graduate unemployment decreased slightly from 3.7% to 3.8%.'],
    ['the to-from form', 'Chip prices increased to 28.99 from 29.75.'],
    ['a trailing full stop must not defeat it', 'Gold fell from 4190.2 to 4218.55.'],
    ['a second clause after the pair', 'Gold dropped from 4190.2 to 4218.55 while chips fell.'],
    ['thousands separators', 'Copper rose from 13,552 to 13,543.'],
    ['two clauses, the second one wrong',
     'Chip prices climbed to 28.99 from 29.75, and gold declined from 4190.2 to 4218.55.'],
    ['millions', 'Big rose from 1,234,567 to 1,234,000.'],
  ];

  for (const [what, body] of rejects) {
    test(`rejects: ${what}`, () => {
      const verdict = validate(body, MOVED);
      assert.equal(verdict.ok, false, body);
      assert.match(verdict.reason, /wrong direction/);
    });
  }

  const accepts = [
    ['a rise described as a rise', 'US graduate unemployment increased from 3.7% to 3.8%.'],
    ['a fall described as a fall', 'Chip prices decreased to 28.99 from 29.75.'],
    ['a clause boundary keeps verbs apart',
     'Chip prices fell, while gold rose from 4190.2 to 4218.55.'],
    ['both clauses correct',
     'Chip prices decreased to 28.99 from 29.75, and gold increased from 4190.2 to 4218.55.'],
    ['two correct claims in one sentence',
     'Gold rose from 4190.2 to 4218.55 and chip prices fell to 28.99 from 29.75.'],
    ['a neutral verb makes no claim', 'Gold moved from 4190.2 to 4218.55.'],
    ['thousands separators, correct', 'Copper moved down from 13,552 to 13,543.'],
    ['millions, correct', 'Big fell from 1,234,567 to 1,234,000.'],
  ];

  for (const [what, body] of accepts) {
    test(`accepts: ${what}`, () => {
      const verdict = validate(body, MOVED);
      assert.equal(verdict.ok, true, `${body}\n${verdict.reason ?? ''}`);
    });
  }

  test('says nothing about a pair it was not given', () => {
    // The check only fires on pairs it recognises. A movement between two
    // numbers that are both in the grounding but are not a series' own
    // previous/latest is not a direction claim it can adjudicate.
    assert.equal(validate('It rose from 3.7 to 28.99.', MOVED).ok, true);
  });
});

describe('validate — direction on a simulation grounding', () => {
  /*
   * THE HOLE THIS BLOCK CLOSES.
   *
   * `wrongDirection` collected its (previous, latest) pairs by looking for
   * objects carrying both keys. A simulation grounding has NEITHER — it states
   * a `baseline` and a `years` array and lets the movement be the distance
   * between them — so `pairs` came back empty and the function returned null
   * before doing any work. `validate()` therefore answered `{ok: true}` to a
   * sentence whose direction is backwards, on real figures. The number gate
   * passed it because both numbers really are in the grounding.
   *
   * The whole check exists because of a measured incident on the labour lens
   * (see the docblock in narration.js). The simulation feature reused the gate
   * and inherited none of its protection.
   *
   * Every figure below is COMPUTED, not typed: the coefficients are the USA
   * rows of `db/seeds/034_scenario_ai-capex-dotcom.sql` and the run is the real
   * engine at the scenario's own default slider position.
   */
  const USA = {
    gdp_usd_bn: 29298.0,          // seed line 275
    unemployment_baseline: 4.02,  // 292
    inflation_anchor: 2.0,        // 334
    okun_coefficient: -0.563,     // 378
    price_phillips_slope: 0.11,   // 422
    fiscal_multiplier_y1: 0.457,  // the five panel cells, IMF WP/15/95 Table 1
    fiscal_multiplier_y2: 0.755,
    fiscal_multiplier_y3: 1.035,
    fiscal_multiplier_y4: 1.389,
    fiscal_multiplier_y5: 1.539,
    wage_phillips_slope: 0.13,
    wage_persistence: 0.65,
    wage_price_passthrough: 0.33,
  };

  const run = runScenario({
    modelKey: 'investment_shock_v1',
    /* The scenario's own defaults: $100bn, not repeated. */
    inputs: { shock_usd_bn: 100, sustained: 0 },
    parameters: USA,
    horizonYears: 5,
  });

  const baseline = run.baseline.unemployment_pct;
  const finalYear = run.years[run.years.length - 1].unemployment_pct;

  /* Sanity: the model says an investment boom LOWERS unemployment. If this ever
     fails, the sentences below stop being backwards and the tests are lying. */
  test('the run this block is built on really does fall', () => {
    assert.ok(finalYear < baseline, `${baseline} → ${finalYear} must be a fall`);
  });

  const shapes = {
    /* What the generator writes today. */
    'series rows': buildSimulationGrounding('AI capex', 'USA', run),
    /* What the generator wrote before, and what any future caller might hand
       `narrate()` directly. The gate itself has to understand this, or the fix
       lives only in one script and comes back with the next one. */
    'the raw run object': {
      scenario: 'AI capex',
      country: 'USA',
      shock: run.shock,
      baseline: run.baseline,
      years: run.years,
    },
  };

  for (const [shape, grounding] of Object.entries(shapes)) {
    test(`${shape}: the backwards sentence is rejected`, () => {
      const body =
        `Unemployment rises from ${baseline} in year one to ${finalYear} by year five. ` +
        'These are modelled projections, not measurements.';
      const verdict = validate(body, grounding);
      assert.equal(verdict.ok, false, `this passed the gate: ${body}`);
      assert.match(verdict.reason, /wrong direction/);
    });

    test(`${shape}: the same movement described correctly is accepted`, () => {
      const body =
        `Unemployment falls from ${baseline} with no injection to ${finalYear} by year five. ` +
        'These are modelled projections, not measurements.';
      const verdict = validate(body, grounding);
      assert.equal(verdict.ok, true, verdict.reason);
    });

    test(`${shape}: a fabricated figure is still rejected`, () => {
      const invented = Number((finalYear - 0.31).toFixed(2));
      assert.ok(
        !JSON.stringify(grounding).includes(String(invented)),
        'the fixture must not contain the invented figure'
      );
      const verdict = validate(`Unemployment falls to ${invented} by year five.`, grounding);
      assert.equal(verdict.ok, false);
      assert.match(verdict.reason, /not in the grounding/);
    });

    test(`${shape}: the gate finds pairs at all`, () => {
      // The failure was silent: no pairs meant no check, and every test written
      // from the accepting side went on passing.
      assert.ok(directionPairs(grounding).length > 0, 'no pairs means no check');
    });
  }

  test('the baseline-to-final pair is the one the page argues about', () => {
    const pairs = directionPairs(buildSimulationGrounding('AI capex', 'USA', run));
    assert.ok(
      pairs.some((p) => p.previous === baseline && p.latest === finalYear),
      `expected ${baseline} → ${finalYear} among ${JSON.stringify(pairs)}`
    );
  });

  /*
   * ALL THREE OUTPUT SERIES, NOT TWO.
   *
   * The block above closed the hole for `unemployment_pct` and stopped there,
   * so the fix was never checked against the other two tabs the page draws. One
   * of them was still unguarded, for a reason no test written from the
   * unemployment side could ever have found: the third series is NAMED
   * "Wage growth vs trend", `RISING` matched the noun "growth", and a clause
   * carrying a rising word and a falling word is treated as undecidable and
   * skipped. The gate did not fail — it declined to look, which is the quieter
   * failure and the one that reaches a reader.
   *
   * Every figure below is computed by the engine from the seed's USA
   * coefficients. Nothing is typed in, so a coefficient correction moves the
   * sentences with it instead of leaving them asserting last month's numbers.
   */
  const OUTPUT_SERIES = [
    { name: 'Unemployment', key: 'unemployment_pct' },
    { name: 'Inflation', key: 'inflation_pct' },
    { name: 'Wage growth vs trend', key: 'wage_growth_gap_pp' },
  ];

  for (const { name, key } of OUTPUT_SERIES) {
    const grounding = buildSimulationGrounding('AI capex', 'USA', run);
    const from = run.baseline[key];
    const to = run.years[run.years.length - 1][key];
    const rose = to > from;
    const sentence = (verb) =>
      `${name} ${verb} from ${from} with no injection to ${to} by year five.`;

    test(`${name}: the movement is real and the gate can see it`, () => {
      assert.notEqual(from, to, `${name} must actually move, or nothing below is a test`);
      assert.ok(
        directionPairs(grounding).some((p) => p.name === name && p.previous === from && p.latest === to),
        `no ${from} → ${to} pair for ${name} in ${JSON.stringify(directionPairs(grounding))}`
      );
    });

    test(`${name}: a sentence describing it backwards is rejected`, () => {
      const body = sentence(rose ? 'falls' : 'rises');
      const verdict = validate(body, grounding);
      assert.equal(verdict.ok, false, `this passed the gate: ${body}`);
      assert.match(verdict.reason, /wrong direction/);
    });

    test(`${name}: the same movement described correctly is accepted`, () => {
      const body = sentence(rose ? 'rises' : 'falls');
      const verdict = validate(body, grounding);
      assert.equal(verdict.ok, true, `${verdict.reason} — ${body}`);
    });
  }

  test('the exact sentence the gate used to pass', () => {
    /*
     * Reproduced before it was fixed, on the real run at the scenario's own
     * default slider position: `validate()` answered {ok: true} to this.
     * Written out rather than assembled, because the incident is the sentence.
     * The two assertions above it are what stop the literal from drifting away
     * from the numbers the engine actually produces.
     */
    const last = run.years[run.years.length - 1];
    assert.equal(run.baseline.wage_growth_gap_pp, 0, 'the wage baseline is a deviation of zero');
    assert.equal(last.wage_growth_gap_pp, 0.08, 'year five of the USA default run');

    const verdict = validate(
      'Wage growth vs trend falls from 0 with no injection to 0.08 by year five.',
      buildSimulationGrounding('AI capex', 'USA', run)
    );
    assert.equal(verdict.ok, false, 'the wage series has no direction gate');
    assert.match(verdict.reason, /wrong direction/);
    assert.match(verdict.reason, /Wage growth vs trend went 0 to 0\.08/);
  });

  test('the year counter is never treated as a measurement', () => {
    // years run 1…5, so pairing on `year` would assert a rise on every run and
    // could reject a correct sentence about a genuine fall.
    const pairs = directionPairs({ baseline: run.baseline, years: run.years });
    assert.ok(!pairs.some((p) => p.name === 'year'), 'the horizon index is not a series');
  });
});

describe('validate — the direction vocabulary', () => {
  const MOVED = {
    series: [
      { name: 'Chip prices', previous: 29.75, latest: 28.99 },
      { name: 'Gold', previous: 4190.2, latest: 4218.55 },
    ],
  };

  /*
   * `\brise\b` does not match "rises" or "risen". The check read those clauses
   * as containing NO direction word, called them undecidable, and declined to
   * look — on the lens path as much as the simulation one.
   */
  const rejects = [
    ['rises', 'The chip price index rises from 29.75 to 28.99.'],
    ['risen', 'The chip price index has risen from 29.75 to 28.99.'],
    ['shrinks', 'Gold shrinks from 4190.2 to 4218.55.'],
  ];
  for (const [word, body] of rejects) {
    test(`"${word}" is a direction word`, () => {
      const verdict = validate(body, MOVED);
      assert.equal(verdict.ok, false, `this passed the gate: ${body}`);
      assert.match(verdict.reason, /wrong direction/);
    });
  }

  test('the word "risk" does not disable the check', () => {
    /*
     * Why the inflections are spelled out instead of `ris\w*`.
     *
     * `ris\w*` matches "risk", which claims no direction at all. A clause
     * carrying a rising word AND a falling word is treated as undecidable and
     * skipped — so "risk" beside "decreased" would switch the check off, and
     * this backwards sentence would ship.
     */
    const verdict = validate('The risk decreased from 4190.2 to 4218.55.', MOVED);
    assert.equal(verdict.ok, false, 'a stray "risk" must not switch the check off');
    assert.match(verdict.reason, /wrong direction/);
  });

  /*
   * The same shape as "risk", one list over, and it was live rather than
   * hypothetical: `grow\w*` matched the NOUN "growth", which is part of the name
   * of a measurement rather than a claim about one. Four active indicators are
   * called "… Growth" — wb.NY.GDP.MKTP.KD.ZG is "GDP Growth (annual %)" — and a
   * lens is called "Growth & Productivity", so this switched the check off on the
   * lens path as well as on the simulation's wage series.
   */
  const NAMED_GROWTH = {
    series: [{ name: 'GDP Growth (annual %)', previous: 2.9, latest: 2.1 }],
  };

  test('a series with "Growth" in its name does not switch the check off', () => {
    const verdict = validate('GDP Growth (annual %) increased from 2.9 to 2.1.', NAMED_GROWTH);
    assert.equal(verdict.ok, false, 'the name is not a direction claim');
    assert.match(verdict.reason, /wrong direction/);
  });

  test('the verbs still claim a direction — only the noun was dropped', () => {
    for (const verb of ['grows', 'grew', 'is growing', 'has grown']) {
      const body = `GDP Growth (annual %) ${verb} from 2.9 to 2.1.`;
      assert.equal(validate(body, NAMED_GROWTH).ok, false, `this passed the gate: ${body}`);
    }
  });

  test('and the honest sentence about it is still accepted', () => {
    assert.equal(validate('GDP Growth (annual %) fell from 2.9 to 2.1.', NAMED_GROWTH).ok, true);
  });
});

describe('wrongDirection — words between the figure and the preposition', () => {
  const MOVED = {
    series: [{ name: 'Chip prices', previous: 29.75, latest: 28.99 }],
  };

  test('a period label between the figure and "to" does not hide the pair', () => {
    // `from 4.02 IN YEAR ONE to 3.72` is how the simulation prompt makes the
    // model write. The pattern required the two to be adjacent, so it matched
    // nothing and the check declined to look.
    assert.ok(
      wrongDirection('Chip prices increased from 29.75 in year one to 28.99 by year five.', MOVED)
    );
  });

  test('the to-from form tolerates it too', () => {
    assert.ok(
      wrongDirection('Chip prices increased to 28.99 by year five from 29.75.', MOVED)
    );
  });

  test('a figure inside the gap stops the match, deliberately', () => {
    /*
     * The gap admits words and not digits. Allowing a number in it would let
     * the pattern skip over one figure and pair the two either side of it, and
     * a mis-paired match can only ever produce a FALSE ACCUSATION against prose
     * that is correct. Declining to check costs a check; that is the cheaper
     * mistake, and this test pins the choice so it is not "fixed" later.
     */
    assert.equal(
      wrongDirection('Chip prices increased from 29.75 in 2024 to 28.99.', MOVED),
      null
    );
  });

  test('a comma still separates clauses', () => {
    // The gap must not reach across a clause boundary and lend one clause's
    // verb to another clause's pair.
    assert.equal(
      validate('Chip prices fell, while gold rose from 4190.2 to 4218.55.', {
        series: [
          { name: 'Chip prices', previous: 29.75, latest: 28.99 },
          { name: 'Gold', previous: 4190.2, latest: 4218.55 },
        ],
      }).ok,
      true
    );
  });
});

describe('buildSimulationGrounding — the audit panel is complete', () => {
  /*
   * `NarrationBlock` reads `grounding.series`, counts it into "Show the N
   * figures it was given", and prints above it: "This is the whole of what the
   * model received. It was permitted to write these numbers and no others."
   *
   * The simulation generator built `{scenario, country, shock, baseline,
   * years}` — no `series` key — so the button read "Show the 0 figures it was
   * given" and the panel showed that paragraph above an EMPTY LIST. The
   * paragraph is the component's stated reason for existing.
   */
  const run = {
    years: [
      { year: 1, output_gap_pp: 0.16, unemployment_pct: 3.93, unemployment_gap_pp: -0.09, wage_growth_gap_pp: 0.01, inflation_pct: 2.01, inflation_gap_pp: 0.01 },
      { year: 5, output_gap_pp: 0.53, unemployment_pct: 3.72, unemployment_gap_pp: -0.3, wage_growth_gap_pp: 0.08, inflation_pct: 2.06, inflation_gap_pp: 0.06 },
    ],
    baseline: { unemployment_pct: 4.02, inflation_pct: 2, wage_growth_gap_pp: 0 },
    shock: { usd_bn: 100, share_of_gdp_pct: 0.34, sustained: false },
  };

  test('emits the key the client actually reads', () => {
    const g = buildSimulationGrounding('AI capex', 'USA', run);
    assert.ok(Array.isArray(g.series));
    assert.ok(g.series.length > 0, 'an empty list under "this is the whole of it" is the bug');
  });

  test('the grounding holds nothing the panel would not show', () => {
    // The panel renders `series` and nothing else, so any other key carrying a
    // figure would be a number the model may write and the reader cannot see.
    const g = buildSimulationGrounding('AI capex', 'USA', run);
    assert.deepEqual(Object.keys(g).sort(), ['country', 'scenario', 'series']);
    assert.equal(typeof g.scenario, 'string');
    assert.equal(typeof g.country, 'string');
    assert.ok(!/\d/.test(g.scenario + g.country), 'only `series` may carry a figure');
  });

  test('every row is shaped the way the client renders it', () => {
    for (const row of buildSimulationGrounding('AI capex', 'USA', run).series) {
      assert.equal(typeof row.name, 'string');
      assert.ok(Number.isFinite(row.latest), `${row.name} has no latest value`);
      assert.ok(row.previous === null || Number.isFinite(row.previous));
    }
  });

  test('a level is baseline → final year, which is what the page draws', () => {
    const g = buildSimulationGrounding('AI capex', 'USA', run);
    const u = g.series.find((r) => r.name === 'Unemployment');
    assert.equal(u.previous, 4.02, 'the no-injection baseline');
    assert.equal(u.latest, 3.72, 'the last year of the horizon');
  });

  test('the redundant gap metrics are withheld', () => {
    const g = buildSimulationGrounding('AI capex', 'USA', run);
    const names = g.series.map((r) => r.name);
    for (const withheld of ['unemployment_gap_pp', 'inflation_gap_pp', 'output_gap_pp']) {
      assert.ok(!names.includes(withheld), `${withheld} has no tab on the page`);
    }
  });

  test('the sustained flag never becomes a figure the model may write', () => {
    // `sustained: true` in the grounding would license a bare 1, and 0 for
    // false — two numbers with no meaning, admitted into a set whose whole
    // purpose is that every member is a real measurement.
    const sustained = buildSimulationGrounding('AI capex', 'USA', {
      ...run,
      shock: { ...run.shock, sustained: true },
    });
    const allowed = allowedNumbers(sustained);
    assert.ok(!allowed.has('1'), 'a bare 1 must not be licensed by a boolean');
    assert.match(
      sustained.series[0].period,
      /repeated/,
      'the flag is stated in words instead'
    );
  });

  test('an unrecognised model output is surfaced, not silently dropped', () => {
    // Dropping it would rebuild this very bug for the next metric added to the
    // engine: a number in the model's world the audit panel does not show.
    const g = buildSimulationGrounding('AI capex', 'USA', {
      ...run,
      years: run.years.map((y) => ({ ...y, productivity_gap_pp: 0.42 })),
    });
    assert.ok(g.series.some((r) => r.name === 'productivity_gap_pp'));
  });
});

describe('buildLensGrounding — and the staleness check it makes possible', () => {
  /*
   * This lived inside `scripts/generate-narrations.js`, which meant the only
   * code that could reconstruct a lens grounding was the code that WROTE one.
   * `getLens()` therefore had nothing to compare a stored `input_hash` against,
   * so it did not compare it against anything — it selected on scope and prompt
   * version alone and served whatever was there. Every stored narration also has
   * `expires_at` NULL, so the `(expires_at IS NULL OR expires_at > now())`
   * clause beside it expires nothing either.
   */
  const lens = { name: 'Prices & Markets' };
  const tickers = [
    { label: 'Gold', unit_symbol: '$', latest_value: 4218.5512, previous_value: 4190.2, decimals: 2, latest_period: '2026-08-28' },
    { label: 'Copper', unit_symbol: '$', latest_value: 13552.04090909091, previous_value: 13543.1, decimals: 2, latest_period: '2026-08-28' },
  ];

  test('rounds to the indicator\'s own decimals, so the prose and the ticker agree', () => {
    const g = buildLensGrounding(lens, tickers);
    assert.equal(g.series[1].latest, 13552.04, 'the raw double disagrees with the page');
  });

  test('a ticker with no value is dropped rather than narrated as null', () => {
    const g = buildLensGrounding(lens, [...tickers, { label: 'Empty', latest_value: null }]);
    assert.equal(g.series.length, 2);
  });

  test('caps at six, because an 8B model handed fourteen rows writes a list', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      label: `S${i}`, latest_value: i + 1, previous_value: i, decimals: 0, latest_period: '2026-08-28',
    }));
    assert.equal(buildLensGrounding(lens, many).series.length, 6);
  });

  test('the same figures hash the same, and a moved figure does not', () => {
    // This is the whole mechanism a fail-closed `getLens()` would rest on:
    // rebuild today's grounding, hash it, and render nothing on a mismatch.
    const before = groundingHash(buildLensGrounding(lens, tickers));
    const again = groundingHash(buildLensGrounding(lens, tickers.map((t) => ({ ...t }))));
    assert.equal(before, again, 'a rebuild of the same figures must be the same hash');

    const moved = tickers.map((t, i) => (i === 0 ? { ...t, latest_value: 4300.0 } : t));
    assert.notEqual(
      before,
      groundingHash(buildLensGrounding(lens, moved)),
      'a figure that moved must not hash to the narration written about the old one'
    );
  });
});

describe('groundingHash', () => {
  test('is stable across key order', () => {
    const a = { alpha: 1, beta: [2, 3], gamma: { delta: 4 } };
    const b = { gamma: { delta: 4 }, beta: [2, 3], alpha: 1 };
    assert.equal(groundingHash(a), groundingHash(b));
  });

  test('changes when a value changes', () => {
    // The cache key depends on this. A grounding that changed while the hash
    // did not would serve prose describing last month's numbers forever.
    assert.notEqual(groundingHash({ v: 1 }), groundingHash({ v: 2 }));
  });
});

describe('renderGrounding', () => {
  test('every supplied value appears as a findable line', () => {
    const rendered = __testing.renderGrounding(GROUNDING);
    assert.match(rendered, /observations: 74041/);
    assert.match(rendered, /series\[1\]\.latest: 29/);
    assert.match(rendered, /series\[2\]\.name: Gold/);
  });
});

describe('the system prompt', () => {
  test('forbids the three things the gate checks for', () => {
    // Belt and braces: the gate is the control, but a prompt that asked for
    // the opposite of what the gate permits would fail every time and the
    // feature would silently never render.
    const prompt = __testing.SYSTEM_PROMPT;
    assert.match(prompt, /Never calculate a\s+new number/);
    assert.match(prompt, /never give a URL/);
    assert.match(prompt, /never quote/i);
  });
});
