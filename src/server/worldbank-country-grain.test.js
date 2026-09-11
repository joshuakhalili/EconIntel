import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectCountry } from '../client/components/countrySelection.js';

test('new multi-country WDI series receive a scoped forward attribution correction', () => {
  const seed = readFileSync(new URL('../../db/seeds/063_worldbank_country_grain.sql', import.meta.url), 'utf8');
  assert.match(seed, /SET default_country_iso3 = NULL/);
  assert.match(seed, /WHERE id IN \('wb.SL.GDP.PCAP.EM.KD', 'wb.SL.EMP.TOTL.SP.ZS'\)/);
  assert.match(seed, /AND source_id = 'worldbank'/);
  assert.match(seed, /AND has_country_dim/);
  assert.match(seed, /AND default_country_iso3 = 'USA'/);
  assert.doesNotMatch(seed, /UPDATE observations|UPDATE question_indicators|DELETE/);
  const gate = readFileSync(new URL('../../scripts/check-data.js', import.meta.url), 'utf8');
  assert.match(gate, /WHERE i.default_country_iso3 IS NOT NULL\s+AND o.country_iso3 IS DISTINCT FROM i.default_country_iso3/);
});

test('null provider attribution keeps USA browsing fallback without losing requested country', () => {
  const rows = [{ country_iso3: 'GBR' }, { country_iso3: 'USA' }];
  assert.equal(selectCountry(rows, null, null), 'USA');
  assert.equal(selectCountry(rows, 'GBR', null), 'GBR');
});
