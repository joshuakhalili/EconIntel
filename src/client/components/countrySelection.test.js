import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectCountry } from './countrySelection.js';

const countries = [{ country_iso3: 'DEU' }, { country_iso3: 'USA' }, { country_iso3: 'WLD', is_aggregate: true }];
test('country deep link overrides default and stays selected', () => {
  assert.equal(selectCountry(countries, 'DEU', 'USA'), 'DEU');
  assert.equal(selectCountry(countries, 'WLD', 'USA'), 'WLD');
});
test('missing defaults fall back only to available countries', () => {
  assert.equal(selectCountry(countries, null, 'CAN'), 'USA');
  assert.equal(selectCountry([{ country_iso3: 'DEU' }], null, 'USA'), 'DEU');
  assert.equal(selectCountry([], null, 'USA'), null);
});
