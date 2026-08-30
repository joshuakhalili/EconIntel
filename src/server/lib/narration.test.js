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
import { validate, allowedNumbers, groundingHash, __testing } from './narration.js';

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
