/**
 * Tests for scenario input validation.
 *
 * This is the guarantee that a shared link means what it says. A slider value
 * outside its range is refused rather than quietly pulled back inside, because
 * a clamp computes a DIFFERENT scenario from the one the URL describes — and
 * the reader who shares that URL is then sharing a result that nobody, opening
 * it, can reproduce from what it says.
 *
 * Only the pure function is exercised here; everything else in the repository
 * needs a database and belongs in the endpoint checks.
 *
 * Run with: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { validateInputs, narrationScope } from './simulations.js';

/** Shaped like rows from `simulation_inputs`, NUMERIC included as strings. */
const DEFINITIONS = [
  {
    key: 'shock_usd_bn',
    min_value: '0',
    max_value: '5000',
    default_value: '500',
    step: '50',
  },
  {
    key: 'sustained',
    min_value: '0',
    max_value: '1',
    default_value: '0',
    step: '1',
  },
];

describe('validateInputs', () => {
  test('fills in defaults for anything not supplied', () => {
    const result = validateInputs(DEFINITIONS, {});
    assert.deepEqual(result, { ok: true, values: { shock_usd_bn: 500, sustained: 0 } });
  });

  test('accepts values inside the range, as numbers', () => {
    const result = validateInputs(DEFINITIONS, { shock_usd_bn: '1200', sustained: '1' });
    assert.ok(result.ok);
    assert.deepEqual(result.values, { shock_usd_bn: 1200, sustained: 1 });
    assert.equal(typeof result.values.shock_usd_bn, 'number', 'must not stay a string');
  });

  test('accepts the exact boundaries', () => {
    for (const value of [0, 5000]) {
      const result = validateInputs(DEFINITIONS, { shock_usd_bn: value });
      assert.ok(result.ok, `${value} sits on the boundary and must be allowed`);
    }
  });

  /* The behaviour the whole function exists for. */
  test('refuses an out-of-range value rather than clamping it', () => {
    const over = validateInputs(DEFINITIONS, { shock_usd_bn: 999999 });
    assert.equal(over.ok, false);
    assert.match(over.error, /shock_usd_bn/);
    assert.match(over.error, /5000/);
    assert.equal(over.values, undefined, 'a refusal must not also return values');

    const under = validateInputs(DEFINITIONS, { shock_usd_bn: -1 });
    assert.equal(under.ok, false);
  });

  test('refuses anything that is not a number', () => {
    for (const bad of ['abc', 'NaN', '1e', {}, [], true]) {
      const result = validateInputs(DEFINITIONS, { shock_usd_bn: bad });
      assert.equal(result.ok, false, `"${String(bad)}" must be refused`);
    }
  });

  /*
   * Empty string is the shape a cleared text input sends, and it is NOT the
   * same as a malformed number — it means "I did not set this". Treating it as
   * NaN would 400 a reader for clearing a box.
   */
  test('treats an empty value as absent, not as malformed', () => {
    const result = validateInputs(DEFINITIONS, { shock_usd_bn: '' });
    assert.ok(result.ok);
    assert.equal(result.values.shock_usd_bn, 500);
  });

  test('ignores parameters the scenario does not define', () => {
    const result = validateInputs(DEFINITIONS, { shock_usd_bn: 100, nonsense: 'x' });
    assert.ok(result.ok);
    assert.deepEqual(Object.keys(result.values).sort(), ['shock_usd_bn', 'sustained']);
  });
});

describe('narrationScope', () => {
  /* The generator script and the page must agree on this string exactly, or the
     page looks for prose under a name nothing ever wrote to. */
  test('is stable and includes both the scenario and the country', () => {
    assert.equal(narrationScope('ai-capex-dotcom', 'USA'), 'simulation:ai-capex-dotcom:USA');
    assert.notEqual(narrationScope('a', 'USA'), narrationScope('a', 'GBR'));
  });
});
