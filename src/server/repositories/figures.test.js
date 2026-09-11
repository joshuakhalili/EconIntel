import { test } from 'node:test';
import assert from 'node:assert/strict';
process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:5432/unused';
process.env.DB_DRIVER = 'pg';
const { pool } = await import('../db/pool.js');
const { figuresForQuestion, figuresForLens } = await import('./figures.js');
const point = { value: null, value_note: 'No precise estimate reported', basis: 'scenario' };
pool.query = async (sql, params) => {
  assert.match(sql, /'basis', p\.basis/);
  assert.match(sql, /'value_note', p\.value_note/);
  assert.equal(params[0], 'fixture');
  return { rows: [{ id: 'fixture', points: [point] }] };
};
pool.connect = async () => { throw new Error('No test database access'); };
test('question and lens API repository retain qualitative findings and per-point basis', async () => {
  for (const get of [figuresForQuestion, figuresForLens]) {
    const rows = await get('fixture');
    assert.deepEqual(rows[0].points[0], point);
  }
});
