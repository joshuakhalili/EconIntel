/**
 * The document queries, and the parameter ORDER inside them.
 *
 * WHY THIS IS THE THING WORTH ASSERTING
 *
 * None of these four functions does arithmetic. They bind numbers into SQL and
 * hand back rows, which is exactly why they had no test — and exactly the shape
 * of the failure that has no symptom. `recentDocuments` binds
 * `[minRelevance, limit, kind]` against `$1 = ai_relevance`, `$2 = LIMIT`;
 * `documentsInWindow` binds the same three in a different order because its
 * statement takes two dates first. Swap either pair and the query still parses,
 * still runs, and still returns documents — 40 of them at relevance ≥ 50
 * instead of 50 at relevance ≥ 40. Nothing errors and the page looks fine.
 *
 * The database is stubbed: `pool.query` records what it was asked and returns
 * whatever the test set. Nothing here reaches Postgres and nothing can write.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:5432/unused';
process.env.DB_DRIVER = 'pg';

const { pool } = await import('../db/pool.js');
const { recentDocuments, documentsInWindow, documentsForLens, monthlyDocumentCounts } =
  await import('./documents.js');

let issued = [];
let answer = () => [];

pool.query = async (text, params) => {
  const sql = String(text);
  issued.push({ sql, params });
  const rows = answer(sql, params);
  return { rows, rowCount: rows.length };
};

pool.connect = async () => {
  throw new Error('the document queries must only read');
};

beforeEach(() => {
  issued = [];
  answer = () => [];
});

/** The bound value that lands on a given placeholder in the last statement. */
function boundTo(placeholder, sqlFragment) {
  const statement = issued.find((q) => q.sql.includes(sqlFragment));
  assert.ok(statement, `no statement matched ${sqlFragment}`);
  return statement.params[Number(placeholder.slice(1)) - 1];
}

// ─────────────────────────────────────────────────────────────────────────────

describe('recentDocuments', () => {
  test('the relevance floor and the row limit do not change places', async () => {
    await recentDocuments({ limit: 7, minRelevance: 61, kind: 'filing' });

    assert.equal(boundTo('$1', 'd.ai_relevance >= $1'), 61, 'the floor is the relevance');
    assert.equal(boundTo('$2', 'LIMIT $2'), 7, 'the limit is the row count');
    assert.equal(boundTo('$3', 'd.kind = $3'), 'filing');
  });

  test('called with nothing it uses the documented defaults', async () => {
    await recentDocuments();
    assert.deepEqual(issued[0].params, [40, 50, null]);
  });

  test('no kind means every kind, expressed as a null the SQL tests for', async () => {
    // `($3::document_kind IS NULL OR d.kind = $3)` — a null here is "all", not
    // "none", and it must not be the string 'null'.
    await recentDocuments({ kind: null });
    assert.equal(issued[0].params[2], null);
  });

  test('it returns the rows as they came, not a wrapper', async () => {
    // The route publishes `{ documents: await recentDocuments(...) }`, so an
    // extra layer here would double-wrap the payload.
    answer = () => [{ id: 1, title: 'A story' }];
    const rows = await recentDocuments();
    assert.ok(Array.isArray(rows));
    assert.equal(rows[0].title, 'A story');
  });
});

describe('documentsInWindow', () => {
  test('two dates first, then the floor, then the limit', async () => {
    await documentsInWindow({ from: '2026-01-01', to: '2026-01-31', limit: 5, minRelevance: 55 });

    assert.deepEqual(issued[0].params, ['2026-01-01', '2026-01-31', 55, 5, null]);
    assert.equal(boundTo('$3', 'd.ai_relevance >= $3'), 55);
    assert.equal(boundTo('$4', 'LIMIT $4'), 5);
  });

  test('it orders by relevance before recency, unlike its sibling', async () => {
    /*
     * The two functions differ in ordering on purpose: the context panel wants
     * the most significant thing that happened that month, the news page wants
     * the latest. They also ride different indexes, which is why they are two
     * functions rather than one with a flag.
     */
    await documentsInWindow({ from: '2026-01-01', to: '2026-01-31' });
    assert.match(issued[0].sql, /ORDER BY d\.ai_relevance DESC, d\.published_at DESC/);

    issued = [];
    await recentDocuments();
    assert.match(issued[0].sql, /ORDER BY d\.published_at DESC/);
  });

  test('the window includes the whole of its last day', async () => {
    // `< to + 1 day` rather than `<= to`: published_at is a timestamp, so `<=`
    // would drop everything published after midnight on the final day.
    await documentsInWindow({ from: '2026-01-01', to: '2026-01-31' });
    assert.match(issued[0].sql, /<\s+\(\$2::date \+ INTERVAL '1 day'\)/);
  });
});

describe('documentsForLens', () => {
  test('a lens with no stored query returns an empty list without a second trip', async () => {
    // An empty list is honest — the client renders no news section. Running the
    // search anyway would show whatever matched nothing in particular.
    answer = (sql) => (sql.includes('FROM lenses') ? [{ news_query: null }] : []);

    assert.deepEqual(await documentsForLens('money'), []);
    assert.equal(issued.length, 1, 'the document search must not run');
  });

  test('a lens that does not exist returns an empty list, not an error', async () => {
    answer = () => [];
    assert.deepEqual(await documentsForLens('nope'), []);
    assert.equal(issued.length, 1);
  });

  test('the stored query is bound as a parameter, never built into the SQL', async () => {
    /*
     * Two reasons, both recorded on the function: reading `news_query` inside
     * the same statement stops the planner treating the tsquery as a constant
     * and `documents_search_idx` goes unused — measured at 771ms against 77k
     * rows — and an editorial string interpolated into SQL is an injection.
     */
    answer = (sql) => (sql.includes('FROM lenses') ? [{ news_query: 'ai OR "data centre"' }] : []);
    await documentsForLens('money', { limit: 9, minRelevance: 70 });

    assert.equal(issued.length, 2);
    const search = issued[1];
    assert.deepEqual(search.params, ['ai OR "data centre"', 70, 9]);
    assert.ok(!search.sql.includes('data centre'), 'the query text must not reach the SQL');
    assert.match(search.sql, /websearch_to_tsquery\('english', \$1\)/);
  });

  test('it uses websearch_to_tsquery, which cannot throw on a typo', async () => {
    // `to_tsquery` raises a syntax error on a stray operator, which would turn
    // an editorial typo in a seed file into a 500 on a public page.
    answer = (sql) => (sql.includes('FROM lenses') ? [{ news_query: 'ai &&& jobs' }] : []);
    await documentsForLens('money');

    assert.match(issued[1].sql, /websearch_to_tsquery/);
    // A bare `to_tsquery(` — one not preceded by the `websearch_` prefix — is
    // the form that throws. The underscore in `websearch_to_tsquery` is what
    // keeps this from matching the safe call.
    assert.ok(!/(^|[^_])to_tsquery\(/.test(issued[1].sql), 'no bare to_tsquery call');
  });
});

describe('monthlyDocumentCounts', () => {
  test('it returns both the relevant count and the total', async () => {
    /*
     * A raw count would rise simply because more feeds were added, which reads
     * on a chart as "AI is being discussed more". Returning the denominator is
     * what lets the indicator be a share.
     */
    await monthlyDocumentCounts({ minRelevance: 40 });
    assert.match(issued[0].sql, /count\(\*\) FILTER \(WHERE ai_relevance >= \$1\)::int\s+AS relevant/);
    assert.match(issued[0].sql, /count\(\*\)::int\s+AS total/);
    assert.deepEqual(issued[0].params, [40]);
  });
});
