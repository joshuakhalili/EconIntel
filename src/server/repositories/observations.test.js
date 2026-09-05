/**
 * `upsertObservations` — the only write path for a number on this site.
 *
 * Every ingestion adapter funnels through this function, so its batching, its
 * validation and the ORDER of the ten bound parameters per row decide what ends
 * up in the database. A transposed pair there would write country codes into
 * `industry_code` for every source at once, and nothing downstream would throw:
 * charts would simply draw the wrong series. It had no test.
 *
 * NOTHING HERE REACHES POSTGRES.
 *
 * `withTransaction` obtains its client from `pool.connect()`, and that is the
 * one method replaced below. The fake client records the statements it is given
 * and answers with a row count. It cannot write, and if the function ever
 * stopped going through `withTransaction` these tests would fail rather than
 * quietly start talking to a database.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:5432/unused';
process.env.DB_DRIVER = 'pg';

const { pool } = await import('../db/pool.js');
const { upsertObservations } = await import('./observations.js');

/** Statements the fake client received, in order. */
let statements = [];
/** How many rows each INSERT should claim to have written. */
let rowCountFor = (sql, params) => params?.length / 10;
/** Set to throw from the INSERT, to exercise the rollback path. */
let failOn = null;
let released = 0;

pool.connect = async () => ({
  query: async (sql, params) => {
    statements.push({ sql: String(sql), params });
    if (failOn && String(sql).includes(failOn)) throw new Error('deliberate failure');
    return { rowCount: rowCountFor(String(sql), params) };
  },
  release: () => {
    released += 1;
  },
});

pool.query = async () => {
  throw new Error('upsertObservations must go through withTransaction, not the pool directly');
};

beforeEach(() => {
  statements = [];
  rowCountFor = (sql, params) => params?.length / 10;
  failOn = null;
  released = 0;
});

/** A well-formed observation; override any field to make it malformed. */
const obs = (over = {}) => ({
  indicatorId: 'test.indicator',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  value: 42,
  ...over,
});

const inserts = () => statements.filter((s) => s.sql.startsWith('INSERT INTO observations'));

// ─────────────────────────────────────────────────────────────────────────────

describe('the empty case', () => {
  test('nothing to write opens no transaction', async () => {
    const result = await upsertObservations([]);
    assert.deepEqual(result, { written: 0, skipped: 0 });
    assert.equal(statements.length, 0, 'a BEGIN for zero rows is a round trip for nothing');
  });

  test('a batch that is entirely invalid still opens and closes cleanly', async () => {
    // The transaction opens because validity is decided per row inside it. What
    // matters is that it commits rather than being left open.
    const result = await upsertObservations([obs({ indicatorId: null })]);
    assert.deepEqual(result, { written: 0, skipped: 1 });
    assert.deepEqual(statements.map((s) => s.sql), ['BEGIN', 'COMMIT']);
    assert.equal(released, 1);
  });
});

describe('what counts as a row worth writing', () => {
  test('one bad row costs that row, not the batch', async () => {
    /*
     * The stated contract: rejecting here rather than letting a constraint
     * violation abort the statement is what keeps one malformed row from an
     * upstream API from discarding the other 999.
     */
    const result = await upsertObservations([
      obs(),
      obs({ indicatorId: '' }),
      obs({ periodStart: null }),
      obs({ periodEnd: undefined }),
      obs({ value: Number.NaN }),
      obs({ value: Number.POSITIVE_INFINITY }),
      obs(),
    ]);

    assert.deepEqual(result, { written: 2, skipped: 5 });
    assert.equal(inserts().length, 1);
    assert.equal(inserts()[0].params.length, 20, 'two rows at ten parameters each');
  });

  test('an explicit null value is data, not a defect', async () => {
    // A suppressed cell (Census) or a missing period (FRED's ".") is a real
    // observation that the source declined to report. Dropping it would make a
    // gap in the data look like a gap in coverage.
    const result = await upsertObservations([obs({ value: null })]);
    assert.deepEqual(result, { written: 1, skipped: 0 });
    assert.equal(inserts()[0].params[6], null);
  });

  test('a value that is merely absent is skipped, not written as null', async () => {
    /*
     * Asserted because the two cases read alike and behave differently:
     * `value: null` is written, `value` omitted is dropped. Adapters all set
     * the field explicitly, so this is the defence against one that stops
     * doing so — a field renamed upstream becomes zero rows written rather than
     * a column of nulls that looks like real absence.
     */
    const result = await upsertObservations([obs({ value: undefined })]);
    assert.deepEqual(result, { written: 0, skipped: 1 });
  });
});

describe('the parameters, in the order the INSERT names its columns', () => {
  test('ten per row, in the documented order', async () => {
    /*
     * The column list is
     *   indicator_id, country_iso3, industry_code, company_id,
     *   period_start, period_end, value, value_status,
     *   confidence_tier, source_ref
     * and a transposition here writes plausible values into the wrong columns
     * for every source at once.
     */
    await upsertObservations([
      obs({
        indicatorId: 'ai.capex',
        countryIso3: 'USA',
        industryCode: '5415',
        companyId: 77,
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        value: 12.5,
        valueStatus: 'projected',
        confidenceTier: 'modelled',
        sourceRef: 'https://example.invalid/ref',
      }),
    ]);

    assert.deepEqual(inserts()[0].params, [
      'ai.capex',
      'USA',
      '5415',
      77,
      '2026-01-01',
      '2026-03-31',
      12.5,
      'projected',
      'modelled',
      'https://example.invalid/ref',
    ]);
  });

  test('the optional dimensions default to null, never to undefined', async () => {
    // `undefined` is not a value the driver can bind; it would either throw or
    // be coerced silently depending on the driver.
    await upsertObservations([obs()]);
    const [, country, industry, company, , , , status, tier, ref] = inserts()[0].params;
    assert.deepEqual([country, industry, company, status, tier, ref], [null, null, null, null, null, null]);
  });

  test('no value is interpolated into the SQL text', async () => {
    await upsertObservations([obs({ indicatorId: "it's.quoted", sourceRef: 'DROP TABLE observations' })]);
    const { sql } = inserts()[0];
    assert.ok(!sql.includes("it's.quoted"));
    assert.ok(!sql.includes('DROP TABLE observations'));
    assert.match(sql, /\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9::confidence_tier, \$10/);
  });

  test('placeholders keep counting across rows within one statement', async () => {
    // `$11..$20` for the second row. Restarting at $1 per row is the classic
    // way this shape of builder breaks, and Postgres would bind the first row's
    // values to every row without complaint.
    await upsertObservations([obs(), obs()]);
    assert.match(inserts()[0].sql, /\$11, \$12, \$13, \$14, \$15, \$16, \$17, \$18, \$19::confidence_tier, \$20/);
  });
});

describe('batching', () => {
  test('2500 rows go out as 1000, 1000 and 500', async () => {
    /*
     * Postgres caps a statement at 65535 bound parameters. At ten per row the
     * ceiling is ~6500 rows, so the batch size is what keeps a large ingest
     * from failing at bind time rather than at validation.
     */
    const many = Array.from({ length: 2500 }, (_, i) =>
      obs({ periodStart: `2020-01-${String((i % 28) + 1).padStart(2, '0')}` })
    );

    const result = await upsertObservations(many);
    assert.deepEqual(
      inserts().map((s) => s.params.length / 10),
      [1000, 1000, 500]
    );
    assert.equal(result.written, 2500);
    assert.ok(inserts().every((s) => s.params.length <= 65535), 'no statement may exceed the bind limit');
  });

  test('every batch rides inside ONE transaction', async () => {
    const many = Array.from({ length: 2100 }, () => obs());
    await upsertObservations(many);

    assert.equal(statements.filter((s) => s.sql === 'BEGIN').length, 1);
    assert.equal(statements.filter((s) => s.sql === 'COMMIT').length, 1);
    assert.equal(statements.at(0).sql, 'BEGIN');
    assert.equal(statements.at(-1).sql, 'COMMIT');
  });
});

describe('what `written` actually counts', () => {
  test('it is rows the database changed, not rows we sent', async () => {
    /*
     * The statement carries `WHERE observations.value IS DISTINCT FROM
     * EXCLUDED.value`, so a re-run over unchanged history writes nothing — and
     * that is what keeps `ingested_at` meaning "when the value last moved".
     * Reporting the rows sent instead would make every nightly run look like it
     * had revised the entire series.
     */
    rowCountFor = () => 0;
    const result = await upsertObservations([obs(), obs(), obs()]);
    assert.deepEqual(result, { written: 0, skipped: 0 });
  });

  test('it sums across batches', async () => {
    // Half of each batch moved. BEGIN and COMMIT carry no parameters.
    rowCountFor = (_sql, params) => (params ? params.length / 20 : 0);
    const result = await upsertObservations(Array.from({ length: 1500 }, () => obs()));
    assert.equal(result.written, 750);
  });
});

describe('failure', () => {
  test('a failed INSERT rolls back and releases the client', async () => {
    // Without the release the pool leaks a connection per failed transaction,
    // which on a serverless host is a connection limit reached under load.
    failOn = 'INSERT INTO observations';

    await assert.rejects(() => upsertObservations([obs()]), /deliberate failure/);
    assert.deepEqual(statements.map((s) => s.sql.split(' ').slice(0, 3).join(' ')), [
      'BEGIN',
      'INSERT INTO observations',
      'ROLLBACK',
    ]);
    assert.equal(released, 1);
  });
});
