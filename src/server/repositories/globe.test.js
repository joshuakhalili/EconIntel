/**
 * `globe()` — the shaping between jsonb and the client.
 *
 * The query returns `adoption` as a jsonb object whose KEYS ARE TEXT, because
 * that is what `jsonb_object_agg` produces. The client indexes it by year as a
 * number. Everything below is about that seam, plus the two counts the function
 * publishes so a caption on the globe cannot drift from what the globe draws.
 *
 * The database is stubbed; nothing here reaches Postgres.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:5432/unused';
process.env.DB_DRIVER = 'pg';

const { pool } = await import('../db/pool.js');
const { globe } = await import('./globe.js');

let rows = [];

pool.query = async () => ({ rows, rowCount: rows.length });
pool.connect = async () => {
  throw new Error('globe() must only read');
};

beforeEach(() => {
  rows = [];
});

/** One row as the SELECT returns it: jsonb keys and values arrive as text. */
const country = (over = {}) => ({
  iso3: 'GBR',
  name: 'United Kingdom',
  lat: 54.0,
  lon: -2.0,
  indicator_count: 6,
  adoption: {},
  ...over,
});

describe('the jsonb seam', () => {
  test('adoption keys and values come back as numbers', async () => {
    rows = [country({ adoption: { 2021: '5.5', 2022: '13.5' } })];

    const { countries } = await globe();
    const [{ adoption }] = countries;
    assert.deepEqual(Object.keys(adoption), ['2021', '2022']);
    assert.equal(adoption[2021], 5.5);
    assert.equal(typeof adoption[2022], 'number');
  });

  test('the row is renamed to the client\'s vocabulary', async () => {
    rows = [country({ indicator_count: 61, iso3: 'USA', name: 'United States' })];

    const [only] = (await globe()).countries;
    assert.deepEqual(Object.keys(only), ['iso3', 'name', 'lat', 'lon', 'indicatorCount', 'adoption']);
    assert.equal(only.indicatorCount, 61);
  });
});

describe('years', () => {
  test('it is the union across countries, deduplicated and ascending', async () => {
    /*
     * THE ROW ORDER HERE IS THE WHOLE TEST, AND IT IS NOT ARBITRARY.
     *
     * An earlier version of this fixture could not fail on ORDER: deleting the
     * `.sort()` in globe.js left it at 6 pass / 0 fail. Two things conspire to
     * make that easy to write by accident. The SQL is `ORDER BY c.iso3`, so
     * rows arrive alphabetically; and JavaScript iterates integer-like object
     * keys in ascending numeric order whatever order they were written in, so
     * `Object.keys({ 2022: …, 2021: … })` is already `['2021', '2022']`. A
     * fixture whose earliest years happen to sit in its alphabetically-first
     * country therefore arrives pre-sorted and the sort is doing nothing.
     *
     * So Denmark — first by iso3 — holds the LATER years and the United Kingdom
     * holds the earlier one. Unsorted, the union is [2022, 2024, 2021]; the
     * client animates a timeline over it and would run 2022 → 2024 → 2021.
     */
    rows = [
      country({ iso3: 'AUS', adoption: {} }),
      country({ iso3: 'DNK', adoption: { 2022: '15.2', 2024: '27.0' } }),
      country({ iso3: 'GBR', adoption: { 2021: '5.5', 2022: '13.5' } }),
    ];

    const { years } = await globe();
    assert.deepEqual(
      years,
      [2021, 2022, 2024],
      'ascending, whatever order the countries holding them arrived in'
    );
    assert.ok(years.every((y) => typeof y === 'number'), 'the client animates over these');
  });

  test('no measured country anywhere means no years, not [NaN]', async () => {
    rows = [country({ adoption: {} }), country({ iso3: 'FRA', adoption: {} })];
    assert.deepEqual((await globe()).years, []);
  });
});

describe('the two counts, which the caption is written from', () => {
  test('measured counts countries with at least one adoption reading', async () => {
    /*
     * A country with no adoption survey is not a country with no adoption, and
     * rendering both as darkness would say it was. `measured` against `total`
     * is how the panel admits which it is showing.
     */
    rows = [
      country({ iso3: 'GBR', adoption: { 2022: '13.5' } }),
      country({ iso3: 'DNK', adoption: { 2022: '15.2' } }),
      country({ iso3: 'BRA', adoption: {} }),
      country({ iso3: 'NGA', adoption: {} }),
      country({ iso3: 'IDN', adoption: {} }),
    ];

    const { measured, total } = await globe();
    assert.equal(measured, 2);
    assert.equal(total, 5);
  });

  test('an unmeasured country carries an EMPTY OBJECT, and that is the contract', async () => {
    /*
     * The header prose above `globe()` says "adoption is null rather than zero
     * for the unmeasured". It is not null — the SQL COALESCEs to '{}'::jsonb
     * and the mapping preserves that. `measured` itself tests
     * `Object.keys(...).length > 0`, so the empty object IS the real contract
     * and the sentence is stale. Asserted here so a client written against
     * `adoption == null` fails against this rather than against production.
     */
    rows = [country({ adoption: {} })];
    const [only] = (await globe()).countries;
    assert.deepEqual(only.adoption, {});
    assert.notEqual(only.adoption, null);
  });
});
