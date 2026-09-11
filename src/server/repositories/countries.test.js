import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:5432/unused';
process.env.DB_DRIVER = 'pg';
const { pool } = await import('../db/pool.js');
const { listCountryCoverage, countryCoverage } = await import('./countries.js');
const { app } = await import('../app.js');
pool.connect = async () => { throw new Error('No database allowed'); };

test('coverage retains empty countries, excludes null observations and inactive series', async () => {
  pool.query = async (sql) => {
    assert.match(sql, /LEFT JOIN/);
    assert.match(sql, /o.value IS NOT NULL AND i.is_active/);
    assert.match(sql, /c.is_aggregate/);
    return { rows: [{ iso3: 'HIC', is_aggregate: true, indicator_count: 0 }] };
  };
  assert.equal((await listCountryCoverage())[0].indicator_count, 0);
});
test('country detail restricts observations to requested country and returns unknown as null', async () => {
  let calls = 0;
  pool.query = async (sql, params) => {
    assert.deepEqual(params, ['DEU']);
    calls++;
    if (calls === 1) return { rows: [{ iso3: 'DEU', name: 'Germany', is_aggregate: false }] };
    assert.match(sql, /o.country_iso3 = \$1 AND o.value IS NOT NULL AND i.is_active/);
    return { rows: [{ id: 'wb.test', observation_count: 4 }] };
  };
  assert.equal((await countryCoverage('DEU')).indicators.length, 1);
  pool.query = async () => ({ rows: [] });
  assert.equal(await countryCoverage('ZZZ'), null);
});

test('country API rejects invalid codes and returns 404 for unknown geographies', async () => {
  const handler = app._router.stack.find((layer) => layer.route?.path === '/api/countries/:iso3').route.stack[0].handle;
  const invoke = async (iso3) => {
    const result = { statusCode: 200 };
    const response = { status: (code) => { result.statusCode = code; return response; }, json: (body) => { result.body = body; } };
    await handler({ params: { iso3 } }, response, (error) => { throw error; });
    return result;
  };
  pool.query = async () => { throw new Error('Invalid code must not query database'); };
  assert.equal((await invoke('bad-code')).statusCode, 400);
  pool.query = async (sql, params) => { assert.deepEqual(params, ['ZZZ']); return { rows: [] }; };
  assert.equal((await invoke('zzz')).statusCode, 404);
});
