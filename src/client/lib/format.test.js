/**
 * These are the first tests over client code. They are worth having because
 * `format.js` is pure — no DOM, no network — and because it is the single
 * chokepoint every number and unit on the site passes through, so a fault here
 * is visible on every page at once.
 *
 * The unit cases are taken from real rows in `indicators`, not invented. The
 * provider metadata genuinely contains sentences addressed to whoever wired
 * the adapter, and they were being printed to readers.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { displayUnit, withUnit, fmt, delta, deltaDirection } from './format.js';

describe('displayUnit', () => {
  test('drops the parenthetical note an ingestion adapter left behind', () => {
    assert.equal(
      displayUnit('ten thousand persons (2026-06 value 6,846 = 68.46 million employed)'),
      'ten thousand persons'
    );
    assert.equal(
      displayUnit('Thousands of vacancies (NA-sentinel strings present; filter them)'),
      'Thousands of vacancies'
    );
    assert.equal(displayUnit('index, 2015 = 100 (2015-01 = 99.9; 2024-04 = 114.0)'), 'index, 2015 = 100');
  });

  test('drops a trailing semicolon clause even without brackets', () => {
    assert.equal(displayUnit('10,000 yuan; 2025 value 1,548,312'), '10,000 yuan');
  });

  test('does not split a thousands separator — "10,000 yuan" must not become "10"', () => {
    // The reason the comma rule requires a non-digit after the comma.
    assert.equal(displayUnit('10,000 yuan (dimension unit=10000_yuan)'), '10,000 yuan');
    assert.equal(displayUnit('100 million units (dimension unit=100_million_units)'), '100 million units');
  });

  test('keeps only the head clause of a long but legitimate description', () => {
    assert.equal(
      displayUnit('Millions of Dollars, seasonally adjusted annual rate'),
      'Millions of Dollars'
    );
    assert.equal(
      displayUnit('US dollars per hour, PPP converted, constant prices'),
      'US dollars per hour'
    );
  });

  test('leaves a short unit alone, including one with a meaningful comma', () => {
    assert.equal(displayUnit('USD per tonne'), 'USD per tonne');
    assert.equal(displayUnit('percent'), 'percent');
    // 30 chars, under the threshold, so the comma clause survives.
    assert.equal(displayUnit('ratio, percent of labour force'), 'ratio, percent of labour force');
  });

  test('survives the shapes that are not strings', () => {
    for (const bad of [null, undefined, 42, {}]) assert.equal(displayUnit(bad), '');
  });
});

describe('withUnit', () => {
  test('never emits a raw provider string', () => {
    const out = withUnit(6846, 'ten thousand persons (2026-06 value 6,846 = 68.46 million)');
    assert.ok(!out.includes('('), `leaked provider note: ${out}`);
    assert.equal(out, '6,846 ten thousand persons');
  });

  test('uses symbols for the two units that have them', () => {
    // Abbreviation starts at 10k, so four digits stay written out in full.
    assert.equal(withUnit(1234, 'USD'), '$1,234');
    assert.equal(withUnit(15_000, 'USD'), '$15.0k');
    assert.equal(withUnit(60.87, 'percent'), '60.9%');
  });

  test('renders a missing value as a dash rather than NaN', () => {
    assert.equal(withUnit(null, 'USD'), '—');
    assert.equal(withUnit(Number.NaN, 'percent'), '—');
  });
});

describe('delta', () => {
  test('reports a rate in points, not as a percentage of a percentage', () => {
    // "0.5% to 60.9%" is +11,831% and also useless — see the note in format.js.
    const points = [
      { date: '2015-01-01', value: 0.5 },
      { date: '2026-01-01', value: 60.9 },
    ];
    const d = delta(points, true, 'annual');
    assert.equal(d.unit, 'pp');
    assert.ok(Math.abs(d.value - 60.4) < 0.001);
  });

  test('a small fall keeps its sign rather than being classed flat', () => {
    assert.equal(deltaDirection({ value: -0.05 }), 'down');
    assert.equal(deltaDirection({ value: 0 }), 'flat');
    assert.equal(deltaDirection(null), 'flat');
  });
});

describe('fmt', () => {
  test('abbreviates at each magnitude', () => {
    assert.equal(fmt(1.5e12), '1.5T');
    assert.equal(fmt(2.4e9), '2.4B');
    assert.equal(fmt(3.7e6), '3.7M');
    assert.equal(fmt(15_000), '15.0k');
  });

  test('keeps decimals only where they carry information', () => {
    // A series moving between 0.2 and 0.9 must not render as "0, 0, 1".
    assert.equal(fmt(0.234, 2), '0.23');
    assert.equal(fmt(1234), '1,234');
  });
});
