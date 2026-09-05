/**
 * `/api/series` and the rebasing decision, which is a chart-honesty rule.
 *
 * WHY IT GETS ITS OWN FILE
 *
 * This endpoint is the only place in the codebase where the server decides to
 * show the reader something other than what they asked for. The project bans
 * dual axes, so series on incompatible scales are indexed to 100 instead — and
 * `squashed` extends that to the case the caller cannot see coming, where the
 * units MATCH and the magnitudes do not. A series covering under a tenth of the
 * axis renders as a flat line along the bottom, which on the productivity page
 * read as "the information sector has not grown" when it had roughly
 * quadrupled.
 *
 * That rule has forty lines of reasoning above it and, until now, no test. Its
 * two halves fail in opposite directions and both are silent:
 *
 *   rebasing when it should not   destroys the comparison the page exists to
 *                                 make — the adoption panel runs 3% to 27% and
 *                                 indexing both to 100 hides exactly that
 *   not rebasing when it should   draws the flat line and says nothing
 *
 * The database is stubbed the same way as in `app.routes.test.js`: `pool.query`
 * is replaced, an unstubbed statement throws rather than reaching a socket, and
 * `pool.connect` throws so nothing here can open a transaction.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import crypto from 'node:crypto';

process.env.SESSION_SECRET = 's'.repeat(64);
process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:5432/unused';
process.env.DB_DRIVER = 'pg';

const { pool } = await import('./db/pool.js');
const { app } = await import('./app.js');

const READER = {
  id: 'series-fixture-reader',
  handle: null,
  name: 'Fixture Reader',
  email: 'fixture@example.invalid',
  avatar_url: null,
  is_editor: false,
  identity: 'email',
  last_seen_at: new Date(),
};

/** Indicators the metadata SELECT will find, by id. */
let catalogue = new Map();
/** Observation points the ORDINALITY SELECT will find, keyed `id country`. */
let history = new Map();
/** Every statement issued during the current test. */
let issued = [];

const META_SQL = 'FROM indicators WHERE id = ANY($1::text[])';
const POINTS_SQL = 'WITH ORDINALITY';

pool.query = async (text, params) => {
  const sql = String(text);
  issued.push({ text: sql, params });

  if (sql.includes('FROM readers')) return { rows: [READER], rowCount: 1 };

  if (sql.includes(META_SQL)) {
    const rows = params[0].map((id) => catalogue.get(id)).filter(Boolean);
    return { rows, rowCount: rows.length };
  }

  if (sql.includes(POINTS_SQL)) {
    // Rebuild what `unnest(...) WITH ORDINALITY` would return: every point for
    // every pair, each row carrying its pair's 1-based slot.
    const [ids, countries] = params;
    const rows = [];
    ids.forEach((id, i) => {
      const key = `${id} ${countries[i] ?? ''}`;
      for (const point of history.get(key) ?? []) {
        rows.push({ slot: i + 1, date: point.date, value: point.value, value_status: point.value_status ?? null });
      }
    });
    return { rows, rowCount: rows.length };
  }

  throw new Error(`this test did not stub the statement:\n${sql.trim().slice(0, 240)}`);
};

pool.connect = async () => {
  throw new Error('/api/series opened a transaction — it must only read');
};

let base;
let server;

before(async () => {
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  catalogue = new Map();
  history = new Map();
  issued = [];
});

function sessionCookie() {
  const body = `${READER.id}.${Date.now() + 3_600_000}`;
  const signature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `diffusion_session=${body}.${signature}`;
}

/**
 * Register an indicator and the points it holds.
 *
 * `country` is the key the observations join uses: null means "every country
 * this indicator holds", which is what a null parameter means in the real
 * query too.
 */
function indicator(id, { kind, country = null, values, dates, statuses = [] }) {
  catalogue.set(id, {
    id,
    name: id,
    unit: kind === 'rate' ? 'percent' : 'USD millions',
    unit_symbol: kind === 'rate' ? '%' : '$',
    decimals: 1,
    cadence: 'annual',
    quantity_kind: kind,
    source_url: 'https://example.invalid',
    confidence_tier: 'official',
    default_country_iso3: country,
  });
  history.set(
    `${id} ${country ?? ''}`,
    values.map((value, i) => ({ date: dates[i], value, value_status: statuses[i] ?? null }))
  );
}

const YEARS = ['2020-01-01', '2021-01-01', '2022-01-01'];

/** An indexed value, to six places — enough to see a wrong base, blind to IEEE noise. */
const rounded = (point) => (point.value == null ? null : Number(point.value.toFixed(6)));

function series(qs) {
  return fetch(`${base}/api/series?${qs}`, { headers: { Cookie: sessionCookie() } });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('the request itself', () => {
  test('no ids is 400, not an empty 200', async () => {
    const response = await series('');
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'ids required' });
  });

  test('more than twelve series is refused rather than served slowly', async () => {
    // A request for 200 series is a mistake or an attack; either way it should
    // fail clearly rather than exhaust the pool.
    const ids = Array.from({ length: 13 }, (_, i) => `i${i}`).join(',');
    const response = await series(`ids=${ids}`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'at most 12 series per request' });
    assert.equal(issued.filter((q) => q.text.includes(META_SQL)).length, 0);
  });

  test('signed out it is 401, like everything else behind the gate', async () => {
    const response = await fetch(`${base}/api/series?ids=a`);
    assert.equal(response.status, 401);
  });

  test('whatever the caller asks for, it is two statements', async () => {
    // The comment on the handler records the regression: a metadata SELECT and
    // an observations SELECT per id meant twelve series cost 24 round trips.
    for (const id of ['a', 'b', 'c']) {
      indicator(id, { kind: 'currency', values: [1, 2, 3], dates: YEARS });
    }
    await series('ids=a,b,c');

    assert.equal(issued.filter((q) => q.text.includes(META_SQL)).length, 1);
    assert.equal(issued.filter((q) => q.text.includes(POINTS_SQL)).length, 1);
  });

  test('an id that does not exist is reported, and does not sink the others', async () => {
    indicator('a', { kind: 'currency', values: [1, 2, 3], dates: YEARS });

    const body = await (await series('ids=a,ghost')).json();
    assert.equal(body.series.length, 2);
    assert.equal(body.series[1].id, 'ghost');
    assert.equal(body.series[1].error, 'not found');
    assert.deepEqual(body.series[1].points, []);
    assert.equal(body.series[0].points.length, 3);
  });

  test('the same pair asked for twice is fetched once', async () => {
    indicator('a', { kind: 'currency', country: 'USA', values: [1, 2, 3], dates: YEARS });

    const body = await (await series('ids=a,a&countries=USA,USA')).json();
    const points = issued.find((q) => q.text.includes(POINTS_SQL));
    assert.equal(points.params[0].length, 1, 'one pair, not two');
    // Both requested positions still answer — deduplication is about the
    // fetch, not about the response.
    assert.equal(body.series.length, 2);
    assert.equal(body.series[0].points.length, 3);
    assert.equal(body.series[1].points.length, 3);
  });

  test('countries is positional, and a blank falls back to the indicator default', async () => {
    /*
     * The parameter is positional precisely so a mixed request of
     * country-specific and global series stays aligned with `ids`. A blank that
     * shifted the list would silently attach one country's history to another
     * country's line.
     */
    indicator('global', { kind: 'currency', values: [1, 2, 3], dates: YEARS });
    indicator('bycountry', { kind: 'currency', country: 'GBR', values: [4, 5, 6], dates: YEARS });

    const body = await (await series('ids=global,bycountry&countries=,GBR')).json();
    const points = issued.find((q) => q.text.includes(POINTS_SQL));
    assert.deepEqual(points.params[0], ['global', 'bycountry']);
    assert.deepEqual(points.params[1], [null, 'GBR']);
    assert.equal(body.series[0].country, null);
    assert.equal(body.series[1].country, 'GBR');
  });
});

describe('the un-rebased branch — levels the reader is meant to compare', () => {
  test('two rates at eight times apart are returned raw', async () => {
    /*
     * The adoption panel, which is the case the rule was written around:
     * Australia at 3% against Denmark at 27%. Indexing both to 100 destroys the
     * comparison the page exists to make, so `rate` is on the comparable list
     * and the spread is allowed to stand.
     */
    indicator('au', { kind: 'rate', values: [3, 3.2, 3.5], dates: YEARS });
    indicator('dk', { kind: 'rate', values: [24, 25.5, 27], dates: YEARS });

    const body = await (await series('ids=au,dk')).json();
    assert.equal(body.indexed, false);
    assert.equal(body.indexNote, undefined);
    assert.deepEqual(body.series[0].points.map((p) => p.value), [3, 3.2, 3.5]);
    assert.deepEqual(body.series[1].points.map((p) => p.value), [24, 25.5, 27]);
  });

  test('index, change and score count as comparable levels too', async () => {
    for (const kind of ['index', 'change', 'score']) {
      catalogue = new Map();
      history = new Map();
      indicator('small', { kind, values: [1, 1.1, 1.2], dates: YEARS });
      indicator('big', { kind, values: [90, 95, 100], dates: YEARS });

      const body = await (await series('ids=small,big')).json();
      assert.equal(body.indexed, false, `${kind} should never be auto-rebased`);
    }
  });

  test('a single series is never auto-rebased, however small its range', async () => {
    // There is nothing to compare it to, so there is no axis it can be squashed
    // off. Rebasing here would replace real units with an index for no reason.
    indicator('a', { kind: 'currency', values: [1000, 1001, 1002], dates: YEARS });

    const body = await (await series('ids=a')).json();
    assert.equal(body.indexed, false);
    assert.deepEqual(body.series[0].points.map((p) => p.value), [1000, 1001, 1002]);
  });

  test('two currency series on a similar scale are left alone', async () => {
    indicator('a', { kind: 'currency', values: [100, 110, 120], dates: YEARS });
    indicator('b', { kind: 'currency', values: [80, 95, 105], dates: YEARS });

    const body = await (await series('ids=a,b')).json();
    assert.equal(body.indexed, false);
  });
});

describe('the rebased branch', () => {
  test('index=true indexes every series to 100 at the first SHARED period', async () => {
    /*
     * Shared, not each series' own first observation — otherwise whichever
     * series began earliest is silently credited with the growth that happened
     * before the others existed.
     */
    indicator('early', { kind: 'currency', values: [50, 100, 110, 120], dates: ['2019-01-01', ...YEARS] });
    indicator('late', { kind: 'currency', values: [8, 9, 10], dates: YEARS });

    const body = await (await series('ids=early,late&index=true')).json();
    assert.equal(body.indexed, true);
    assert.equal(body.indexBase, '2020-01-01');
    assert.equal(body.series[0].indexed, true);
    assert.equal(body.series[1].indexed, true);

    /*
     * early is anchored at its 2020 value of 100, so 2019 sits BELOW 100.
     * Rounded because `(110 / 100) * 100` is 110.00000000000001 in IEEE 754 —
     * the arithmetic is a division and a multiplication, not an identity, and
     * asserting exact equality would make this test a float trivia question
     * rather than a statement about rebasing.
     */
    assert.deepEqual(body.series[0].points.map(rounded), [50, 100, 110, 120]);
    assert.deepEqual(body.series[1].points.map(rounded), [100, 112.5, 125]);
  });

  test('a caller-requested rebase carries no note — it was not our decision', async () => {
    indicator('a', { kind: 'currency', values: [100, 110, 120], dates: YEARS });
    indicator('b', { kind: 'currency', values: [8, 9, 10], dates: YEARS });

    const body = await (await series('ids=a,b&index=true')).json();
    assert.equal(body.indexed, true);
    assert.equal(body.indexNote, undefined);
  });

  test('index=1 is not index=true — only the exact string opts in', async () => {
    // Asserted because the handler compares against the literal 'true'. A
    // client sending `index=1` gets raw units, and should find that out here
    // rather than from a chart that quietly did not rebase.
    indicator('a', { kind: 'rate', values: [3, 4, 5], dates: YEARS });
    indicator('b', { kind: 'rate', values: [30, 40, 50], dates: YEARS });

    const body = await (await series('ids=a,b&index=1')).json();
    assert.equal(body.indexed, false);
  });

  test('a projection indexed to 100 is still a projection', async () => {
    /*
     * `value_status` rides along per point because a forecast drawn like a
     * measurement is the failure this site's first rule exists to prevent.
     * Rebasing changes the scale, not what the value IS, so the status has to
     * survive the map.
     */
    indicator('a', {
      kind: 'currency',
      values: [100, 110, 120],
      dates: YEARS,
      statuses: ['actual', 'actual', 'projected'],
    });
    indicator('b', { kind: 'currency', values: [8, 9, 10], dates: YEARS, statuses: ['actual', 'actual', 'actual'] });

    const body = await (await series('ids=a,b&index=true')).json();
    assert.deepEqual(
      body.series[0].points.map((p) => p.value_status),
      ['actual', 'actual', 'projected']
    );
  });

  test('a series whose anchor is zero is left raw while the others rebase', async () => {
    // Dividing by it would be Infinity, and dropping the series would remove a
    // line from a chart without saying so. It is marked `indexed: false`
    // instead, which is the one thing the client can act on.
    indicator('a', { kind: 'currency', values: [100, 110, 120], dates: YEARS });
    indicator('zero', { kind: 'currency', values: [0, 5, 10], dates: YEARS });

    const body = await (await series('ids=a,zero&index=true')).json();
    assert.equal(body.series[0].indexed, true);
    assert.equal(body.series[1].indexed, false);
    assert.deepEqual(body.series[1].points.map((p) => p.value), [0, 5, 10]);
  });

  test('no overlapping period means no index, and the response says so', async () => {
    // Picking a base anyway would make the comparison meaningless without
    // admitting it.
    indicator('a', { kind: 'currency', values: [100, 110], dates: ['2019-01-01', '2020-01-01'] });
    indicator('b', { kind: 'currency', values: [8, 9], dates: ['2023-01-01', '2024-01-01'] });

    const body = await (await series('ids=a,b&index=true')).json();
    assert.equal(body.indexed, false);
    assert.match(body.indexNote ?? '', /shared period/);
  });
});

describe('the squashed rule — rebasing the caller did not ask for', () => {
  test('a series covering under a tenth of the axis triggers it', async () => {
    /*
     * `productivity / us-value-added` in miniature: private services against
     * information, a factor of thirteen. The smaller line renders along the
     * bottom of the axis and its whole history looks flat.
     *
     * Axis span is 130 (zero-based, which is what these charts draw for
     * all-positive data). The smaller series moves 2, which is 1.5% of it.
     */
    indicator('big', { kind: 'currency', values: [100, 115, 130], dates: YEARS });
    indicator('small', { kind: 'currency', values: [8, 9, 10], dates: YEARS });

    const body = await (await series('ids=big,small')).json();
    assert.equal(body.indexed, true);
    assert.equal(body.indexBase, '2020-01-01');
    assert.match(body.indexNote ?? '', /flat line/);
    assert.deepEqual(body.series[1].points.map((p) => p.value), [100, 112.5, 125]);
  });

  test('the note is only attached when the rebase was ours', async () => {
    indicator('big', { kind: 'currency', values: [100, 115, 130], dates: YEARS });
    indicator('small', { kind: 'currency', values: [8, 9, 10], dates: YEARS });

    const asked = await (await series('ids=big,small&index=true')).json();
    assert.equal(asked.indexed, true);
    assert.equal(asked.indexNote, undefined, 'the caller asked; there is nothing to explain');
  });

  test('the axis share is measured against the axis, not against the neighbour\'s peak', async () => {
    /*
     * The ratio-between-peaks test was the first attempt and it let
     * `us-value-added` through: private services peaks around eight times
     * information, a ratio under any sane threshold, while information's entire
     * movement still covers under a tenth of the axis.
     *
     * Here the peaks differ by a factor of 8 — under a 10x ratio rule — but the
     * smaller series moves 1 on an axis of 80, which is 1.25%. It must still
     * trigger.
     */
    indicator('big', { kind: 'currency', values: [70, 75, 80], dates: YEARS });
    indicator('small', { kind: 'currency', values: [9, 9.5, 10], dates: YEARS });

    const body = await (await series('ids=big,small')).json();
    assert.equal(body.indexed, true);
    assert.match(body.indexNote ?? '', /tenth of the axis/);
  });

  test('a comparable level is never squash-rebased, even at the same spread', async () => {
    // The same numbers as the test above, declared as rates. The axis position
    // IS the finding for a rate, so the endpoint must leave it alone. This is
    // the pair of tests that pins `LEVELS_ARE_COMPARABLE` in place: change the
    // set and exactly one of them goes red.
    indicator('big', { kind: 'rate', values: [70, 75, 80], dates: YEARS });
    indicator('small', { kind: 'rate', values: [9, 9.5, 10], dates: YEARS });

    const body = await (await series('ids=big,small')).json();
    assert.equal(body.indexed, false);
  });

  test('one comparable series among incomparable ones does not protect the group', async () => {
    // `every` rather than `some`: a rate charted against a currency cannot share
    // an axis in raw units at all, so the mixed case must rebase.
    indicator('money', { kind: 'currency', values: [100, 115, 130], dates: YEARS });
    indicator('pct', { kind: 'rate', values: [8, 9, 10], dates: YEARS });

    const body = await (await series('ids=money,pct')).json();
    assert.equal(body.indexed, true);
  });

  test('series with no values at all are not counted as measurable', async () => {
    // A null-only series has no range to measure and no anchor to index on.
    // Counting it would make every chart with an empty series rebase.
    indicator('a', { kind: 'currency', values: [100, 110, 120], dates: YEARS });
    indicator('empty', { kind: 'currency', values: [null, null, null], dates: YEARS });

    const body = await (await series('ids=a,empty')).json();
    assert.equal(body.indexed, false, 'one measurable series is not a comparison');
  });
});
