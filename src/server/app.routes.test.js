/**
 * The route handlers themselves — status, body shape, and the decisions taken
 * between the database and the reader.
 *
 * WHY THIS FILE EXISTS
 *
 * `app.test.js` proves the module parses and that four paths are registered.
 * `app.http.test.js` proves the gates around the API behave (bad bodies, the
 * auth gate's position, CSRF, the sign-in rate limit) and deliberately never
 * reaches a handler. Between them, no test had ever called a route handler and
 * looked at what it returned — so `overview()`, `getQuestion()` and the
 * rebasing branch in `/api/series`, which between them produce every number on
 * every page, could return the wrong shape, the wrong type or a 500 and the
 * suite would stay green. Two of the three production incidents this repo
 * records were in exactly that layer.
 *
 * HOW THE DATABASE IS STUBBED, AND WHY IT IS STUBBED RATHER THAN SEEDED
 *
 * `db/pool.js` exports one `pool` object and its own `query()` calls
 * `pool.query`. Replacing that one method intercepts every statement the app
 * or any repository issues, without touching a line of source. The default
 * answer is a THROW: a statement this file has not deliberately answered fails
 * the test loudly rather than falling through to a socket, which is what keeps
 * a stubbed test from quietly becoming a live one.
 *
 * `pool.connect` is replaced too, so nothing here can open a transaction —
 * every write path in this codebase goes through `withTransaction`. This file
 * cannot write a row.
 *
 * The rows are hand-built rather than seeded because the interesting cases are
 * ones a seed does not contain: a NUMERIC that arrived as a string, a lens with
 * no ticker, a question with no siblings, two series whose magnitudes differ by
 * two orders of magnitude. A fixture database would have to be corrupted on
 * purpose to hold them.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import crypto from 'node:crypto';

/*
 * Set before anything imports `config.js`, which reads the environment once at
 * module load. `dotenv` does not overwrite what is already there, so these win
 * over the real `.env` — and that is the point of assigning rather than
 * defaulting with `??=`: the checked-in `.env` holds a production Neon URL, and
 * a stub that missed a statement would otherwise reach it.
 */
process.env.SESSION_SECRET = 'r'.repeat(64);
process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:5432/unused';
process.env.DB_DRIVER = 'pg';

const { pool } = await import('./db/pool.js');
const { app } = await import('./app.js');

/** Every statement the app issued during the current test, in order. */
let issued = [];
/** Maps a fragment of SQL to the rows it should answer with. */
let answers = [];

/*
 * EVERY FRAGMENT IS CHECKED, NOT THE FIRST ONE THAT MATCHES.
 *
 * This used to `return` on the first fragment a statement contained, and the
 * loose fragment `count(*)` was answering the WRONG query in this very file:
 * /api/status issues four statements, and the fourth — the source register —
 * contains `count(*)::int` inside its first CTE. It matched the stub written
 * for the counts query, so `sources.rows` was the counts row, `sources_supplying`
 * was 1, and the test stayed green while testing something else entirely.
 *
 * Collecting every match and refusing to guess between them turns that class of
 * mistake from a silent wrong answer into a loud failure, which is the only
 * form of it a test run can act on. It also makes the fragments themselves
 * assertions: a statement that grows a phrase belonging to another stub fails
 * here rather than quietly swapping its rows.
 */
pool.query = async (text, params) => {
  const sql = String(text);
  issued.push({ text: sql, params });

  const matched = answers.filter(([fragment]) => sql.includes(fragment));

  if (matched.length > 1) {
    throw new Error(
      `AMBIGUOUS STUB — ${matched.length} fragments match one statement, so the ` +
        `rows this returns depend on the order they were written in:\n  ` +
        `${matched.map(([fragment]) => JSON.stringify(fragment)).join('\n  ')}\n` +
        `statement:\n${sql.trim().slice(0, 240)}`
    );
  }

  if (matched.length === 0) {
    throw new Error(`this test did not stub the statement:\n${sql.trim().slice(0, 240)}`);
  }

  const [, rows] = matched[0];
  return { rows, rowCount: rows.length };
};

pool.connect = async () => {
  throw new Error('a read route opened a transaction — nothing here should write');
};

/** The reader row `auth.currentReader` looks up, fresh so it triggers no UPDATE. */
const READER = {
  id: 'reader-fixture',
  handle: null,
  name: 'Fixture Reader',
  email: 'fixture@example.invalid',
  avatar_url: null,
  is_editor: false,
  identity: 'email',
  last_seen_at: new Date(),
};

/**
 * Answer these statements with these rows; anything else throws.
 *
 * `UPDATE readers` is answered rather than left to throw, and it is the one
 * write-shaped statement in the file. Not because anything here should write —
 * `pool.connect` still refuses, and this returns no rows to a statement that
 * needs none — but because of HOW it fails otherwise. `requireReader` is an
 * async middleware with no try/catch, and express 4 does not catch a rejected
 * promise from one, so a throw there produces no response at all: the request
 * hangs and `node --test` waits on it forever with no output. A test that hangs
 * reports nothing. Answering the statement means the assertion below fails by
 * COUNTING the write, which is the thing it is actually about.
 *
 * (That the gate hangs instead of answering 500 is a defect in auth.js, not in
 * this file, and it is reported rather than asserted here.)
 */
function stub(pairs) {
  answers = [['FROM readers', [READER]], ['UPDATE readers', []], ...pairs];
}

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
  issued = [];
  stub([]);
});

/**
 * A session cookie built the way `lib/auth.js` seals one: `id.expiry.hmac`.
 *
 * Constructed here rather than obtained by signing in, because signing in
 * writes a row. The algorithm is duplicated on purpose — if `seal()` ever
 * changes shape, this file should fail rather than follow it silently.
 */
function sessionCookie(readerId = READER.id, ttlMs = 3_600_000) {
  const body = `${readerId}.${Date.now() + ttlMs}`;
  const signature = crypto
    .createHmac('sha256', process.env.SESSION_SECRET)
    .update(body)
    .digest('base64url');
  return `diffusion_session=${body}.${signature}`;
}

function get(path, { signedIn = true } = {}) {
  return fetch(`${base}${path}`, {
    headers: signedIn ? { Cookie: sessionCookie() } : {},
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('/api/overview — the front page, and the coercions it performs', () => {
  /** One row shaped exactly as the SELECT in `overview()` returns it. */
  const lensRow = (over = {}) => ({
    id: 1,
    slug: 'money',
    name: 'Investment & Capital',
    subtitle: 'What is being spent',
    thesis_plain: 'Plain thesis.',
    thesis_expert: 'Expert thesis.',
    sort_order: 1,
    question_count: 4,
    lead_label: 'Data centre capex',
    unit: 'USD millions',
    unit_symbol: '$',
    latest_value: 1234.5,
    latest_period: '2026-06-30',
    previous_value: 1200,
    ...over,
  });

  test('answers 200 with a lenses array, one entry per active lens', async () => {
    stub([['WITH lead AS', [lensRow(), lensRow({ id: 2, slug: 'labour', sort_order: 2 })]]]);

    const response = await get('/api/overview');
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.deepEqual(Object.keys(body), ['lenses']);
    assert.equal(body.lenses.length, 2);
    assert.equal(typeof body.lenses[0].slug, 'string');
    assert.equal(typeof body.lenses[0].question_count, 'number');
  });

  test('a NUMERIC that arrived as a string is published as a number', async () => {
    /*
     * Not hypothetical. `db/pool.js` registers the NUMERIC parser on whichever
     * driver it chose, and its own comment records what happens when that
     * registration lands on a registry nothing reads: every value arrives as a
     * string, `"4.2" + 2` is `"4.22"`, and the failure surfaces as plausible
     * wrong numbers on charts rather than as an error. `overview()` coerces for
     * that reason; nothing asserted the coercion.
     */
    stub([['WITH lead AS', [lensRow({ latest_value: '1234.5', previous_value: '1200' })]]]);

    const { lenses } = await (await get('/api/overview')).json();
    assert.equal(lenses[0].latest_value, 1234.5);
    assert.equal(lenses[0].previous_value, 1200);
    assert.equal(typeof lenses[0].latest_value, 'number');
  });

  test('a period that arrived as a timestamp string is published as a calendar date', async () => {
    /*
     * The DATE parser in pool.js keeps periods as 'YYYY-MM-DD' precisely so a
     * process west of UTC does not shift them a day. `overview()` slices to ten
     * characters as a second defence; this asserts that defence works for the
     * form it can actually receive.
     *
     * It does NOT work for a `Date` object — `String(new Date(...)).slice(0,10)`
     * is 'Tue Jun 30' — and that is reported as a defect rather than asserted
     * here, because a test that pins the wrong answer in place is worse than no
     * test at all.
     */
    stub([['WITH lead AS', [lensRow({ latest_period: '2026-06-30T00:00:00.000Z' })]]]);

    const { lenses } = await (await get('/api/overview')).json();
    assert.equal(lenses[0].latest_period, '2026-06-30');
  });

  test('a lens with no ticker keeps its null figures rather than reporting NaN', async () => {
    // `Number(null)` is 0 and `Number(undefined)` is NaN, so the difference
    // between "no data" and "zero" lives entirely in this branch.
    stub([
      ['WITH lead AS', [lensRow({ latest_value: null, previous_value: null, latest_period: null })]],
    ]);

    const { lenses } = await (await get('/api/overview')).json();
    assert.equal(lenses[0].latest_value, null);
    assert.equal(lenses[0].previous_value, null);
    assert.equal(lenses[0].latest_period, null);
  });

  test('it is one statement, not one per lens', async () => {
    // The comment above the query records a 5.9s first load caused by the
    // observation lookup running per ticker. One reader query plus one
    // overview query is the whole budget for the page a visitor sees first.
    stub([['WITH lead AS', [lensRow(), lensRow({ id: 2, slug: 'labour' })]]]);
    await get('/api/overview');

    const overviewStatements = issued.filter((q) => q.text.includes('WITH lead AS'));
    assert.equal(overviewStatements.length, 1);
  });
});

describe('/api/questions/:slug — the editorial page', () => {
  const QUESTION = {
    id: 7,
    slug: 'entry-level',
    question: 'Are entry-level jobs disappearing?',
    subtitle: null,
    answer_plain: 'Plain answer.',
    answer_expert: 'Expert answer.',
    caveat: null,
    icon: null,
    lens_id: 2,
    theory: null,
    method: null,
    strength: 'suggestive',
    last_reviewed: '2026-08-01',
    lens_name: 'Labour Markets',
    lens_slug: 'labour',
  };

  const reading = (over = {}) => ({
    id: 1,
    title: 'A report',
    publisher: 'Someone',
    published: '2026-01-01',
    url: 'https://example.invalid/a',
    kind: 'report',
    stance: 'agrees',
    takeaway: 'A takeaway.',
    takeaway_source: null,
    takeaway_ref: null,
    scope: 'question',
    ...over,
  });

  function stubQuestion(over = {}) {
    stub([
      ['FROM questions q', [{ ...QUESTION, ...over.question }]],
      ['FROM question_reading', over.reading ?? []],
      ['FROM question_indicators qi', over.indicators ?? []],
      ['FROM questions\n      WHERE lens_id', over.siblings ?? []],
      ['FROM report_figures f', over.figures ?? []],
    ]);
  }

  test('answers 200 with the question and its four attached collections', async () => {
    stubQuestion({
      indicators: [{ indicator_id: 'x', role: 'hero', sort_order: 1, name: 'X' }],
      siblings: [{ slug: 'entry-level', question: 'Are entry-level jobs disappearing?', sort_order: 1 }],
    });

    const response = await get('/api/questions/entry-level');
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.slug, 'entry-level');
    assert.equal(typeof body.question, 'string');
    for (const key of ['indicators', 'reading', 'siblings', 'figures']) {
      assert.ok(Array.isArray(body[key]), `${key} should be an array`);
    }
    assert.equal(body.indicators[0].role, 'hero');
  });

  test('the slug reaches the query as a bound parameter, never interpolated', async () => {
    stubQuestion();
    await get('/api/questions/entry-level');

    const lookup = issued.find((q) => q.text.includes('FROM questions q'));
    assert.deepEqual(lookup.params, ['entry-level']);
    assert.ok(!lookup.text.includes('entry-level'), 'the slug must not appear in the SQL text');
  });

  test('question-scoped sources sort above lens-scoped ones, then newest first', async () => {
    /*
     * The sort is done in JavaScript because DISTINCT ON forces its own ORDER
     * BY, so SQL cannot express the reader-facing order. That makes it a real
     * piece of logic with no gate on it: `(a.scope === 'lens') - (b.scope ===
     * 'lens')` is boolean subtraction, which is the kind of expression that
     * silently inverts when someone tidies it.
     */
    stubQuestion({
      reading: [
        reading({ id: 1, scope: 'lens', published: '2026-05-01', title: 'lens newer' }),
        reading({ id: 2, scope: 'question', published: '2020-01-01', title: 'question older' }),
        reading({ id: 3, scope: 'question', published: '2026-01-01', title: 'question newer' }),
      ],
    });

    const { reading: ordered } = await (await get('/api/questions/entry-level')).json();
    assert.deepEqual(
      ordered.map((r) => r.title),
      ['question newer', 'question older', 'lens newer']
    );
  });

  test('an unknown slug is 404 with a message naming it, not an empty 200', async () => {
    stub([['FROM questions q', []]]);

    const response = await get('/api/questions/no-such-question');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'No question "no-such-question"' });
  });

  test('a question with no rows attached still answers with empty arrays', async () => {
    // A page with nothing on it must render as empty, not throw — the client
    // maps over all four of these unconditionally.
    stubQuestion();
    const body = await (await get('/api/questions/entry-level')).json();
    assert.deepEqual(body.indicators, []);
    assert.deepEqual(body.reading, []);
    assert.deepEqual(body.siblings, []);
    assert.deepEqual(body.figures, []);
  });
});

describe('the 404 paths', () => {
  test('an unknown lens is 404 JSON', async () => {
    stub([['FROM lenses WHERE slug', []]]);
    const response = await get('/api/lenses/nope');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'No lens "nope"' });
  });

  test('an unknown scenario is 404 JSON', async () => {
    stub([['FROM simulation_scenarios', []]]);
    const response = await get('/api/simulations/nope');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'No scenario "nope"' });
  });

  test('an unknown indicator is 404 before any observation is fetched', async () => {
    /*
     * The observations statement is STUBBED even though it must never run, and
     * that is what makes the ordering assertion able to fail on its own. Left
     * unstubbed, a route that fetched observations first would throw inside the
     * stub, 500, and fail on the status line — so the count below would never
     * be reached and the thing this test is named after would go untested. With
     * an answer waiting, a route that asks the question anyway still returns its
     * 404, and the only assertion that notices is the count.
     *
     * The order matters on a table of 75,934 rows behind a slug a caller
     * controls: scanning it to answer "no such indicator" is free work an
     * anonymous request can ask for.
     */
    stub([
      ['FROM indicators WHERE id = $1', []],
      ['FROM observations', [{ period_start: '2020-01-01', value: 1 }]],
    ]);
    const response = await get('/api/indicators/nope/observations');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'No indicator "nope"' });
    assert.equal(
      issued.filter((q) => q.text.includes('FROM observations')).length,
      0,
      'the observations query must not run for an indicator that does not exist'
    );
  });

  test('an endpoint that does not exist is JSON, not the app shell', async () => {
    // Registered after the SPA catch-all on purpose: a mistyped endpoint has to
    // answer JSON, or a `fetch` receives HTML and fails to parse it.
    const response = await get('/api/no-such-endpoint');
    assert.equal(response.status, 404);
    assert.equal(response.headers.get('content-type')?.split(';')[0], 'application/json');
    assert.deepEqual(await response.json(), { error: 'No such endpoint' });
  });

  test('signed out, an unknown endpoint is 401 rather than 404', async () => {
    // The gate is mounted on /api above the 404, so it answers first. Asserted
    // because the opposite — 404 before 401 — would tell an anonymous caller
    // which endpoints exist.
    const response = await get('/api/no-such-endpoint', { signedIn: false });
    assert.equal(response.status, 401);
    assert.equal((await response.json()).signInUrl, '/login');
  });
});

describe('caching headers, which are the gate\'s second line', () => {
  test('a gated GET is private and varies on the cookie', async () => {
    /*
     * One URL answers 401 to an anonymous request and 200 to a signed-in one.
     * A shared cache holding the 200 serves it to anybody — the gate bypassed
     * by a CDN doing its job. `private` plus `Vary: Cookie` is what stops that,
     * and neither is visible in any single file.
     */
    stub([['WITH lead AS', []]]);
    const response = await get('/api/overview');

    assert.equal(response.headers.get('cache-control'), 'private, max-age=300');
    assert.match(response.headers.get('vary') ?? '', /Cookie/i);
  });

  /**
   * The four statements /api/status issues, each named by a phrase that appears
   * in it and in nothing else.
   *
   * `count(*)` and `FROM indicators i` were the fragments here before, and both
   * are in the SOURCE REGISTER statement as well as in the one they were meant
   * for — so the register was answered with the counts row and the assertions
   * below could not have been written at all. The dispatcher now refuses an
   * ambiguous match, and these are the phrases that survive it.
   */
  function stubStatus({ counts = {}, runs = [], stale = [], sources = [] } = {}) {
    stub([
      ['AS sources_registered', [{ observations: 0, documents: 0, indicators: 0, ...counts }]],
      ['FROM ingestion_runs', runs],
      ['AS ingest_gap_days', stale],
      ['WITH catalogued AS', sources],
    ]);
  }

  test('/api/status is the one response allowed into a shared cache', async () => {
    // It sits above the gate and is identical for everybody, which is the only
    // combination under which s-maxage is safe here.
    stubStatus();

    const response = await get('/api/status', { signedIn: false });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') ?? '', /^public, s-maxage=1800/);
  });

  test('the four statements are four separate answers, not one answered four times', async () => {
    /*
     * Written because the previous stub could not tell them apart. Each of the
     * four collections carries a value only its own statement supplied, so a
     * dispatcher that hands the same rows to two of them fails here.
     */
    stubStatus({
      counts: { observations: 75_934, sources_registered: 25 },
      runs: [{ job_name: 'fred', status: 'ok' }],
      stale: [{ id: 'bis.jp', days_behind: 877 }],
      sources: [{ id: 'fred', observations: 61_000 }, { id: 'eurostat', observations: 900 }],
    });

    const body = await (await get('/api/status', { signedIn: false })).json();
    assert.equal(body.counts.observations, 75_934);
    assert.deepEqual(body.recentRuns.map((r) => r.job_name), ['fred']);
    assert.deepEqual(body.staleIndicators.map((r) => r.id), ['bis.jp']);
    assert.deepEqual(body.sources.map((r) => r.id), ['fred', 'eurostat']);
  });

  test('sources_supplying is counted from the register, never queried again', async () => {
    /*
     * The defect this endpoint was rewritten for: the home page printed a
     * hardcoded "24" while /pipeline listed 17 and /data reported 8. The fix is
     * that the figure and the list under it come from one array, so they cannot
     * disagree — `sources_supplying` is `sources.rows.length` and nothing else.
     *
     * The two counts are deliberately different numbers here. `sources_registered`
     * is the row count of the register, several rows of which back no observation
     * and no document at all; `sources_supplying` is what survives the WHERE.
     * Naming an institution while holding none of its data is a credibility
     * claim rather than a coverage one, and these two figures are what keep
     * them apart.
     */
    stubStatus({
      counts: { sources_registered: 25 },
      sources: [{ id: 'fred' }, { id: 'eurostat' }, { id: 'worldbank' }],
    });

    const { counts } = await (await get('/api/status', { signedIn: false })).json();
    assert.equal(counts.sources_supplying, 3);
    assert.equal(counts.sources_registered, 25);
    assert.notEqual(
      counts.sources_supplying,
      counts.sources_registered,
      'a register row that supplies nothing must not be counted as a source of data'
    );
  });
});

describe('/api/me, which answers while signed out', () => {
  test('signed out it is 200 with a null reader, not 401', async () => {
    // If this were gated the client could never discover that sign-in exists.
    const response = await get('/api/me', { signedIn: false });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).reader, null);
  });

  test('signed in it returns the reader without last_seen_at', async () => {
    const response = await get('/api/me');
    assert.equal(response.status, 200);

    const { reader } = await response.json();
    assert.equal(reader.id, READER.id);
    assert.ok(!('last_seen_at' in reader), 'last_seen_at is read to make a decision, not published');
  });

  test('a fresh reader is not written back on every request', async () => {
    /*
     * The regression this guards is named in `currentReader`: an UPDATE here
     * pins the request to the write primary and defeats Neon's read routing,
     * on the one endpoint every page load calls.
     */
    await get('/api/me');
    assert.equal(
      issued.filter((q) => q.text.includes('UPDATE readers')).length,
      0,
      'a reader seen within the hour must not be written back'
    );
  });

  test('a tampered session cookie is treated as signed out', async () => {
    const forged = `${READER.id}.${Date.now() + 3_600_000}.not-a-real-signature`;
    const response = await fetch(`${base}/api/lenses`, {
      headers: { Cookie: `diffusion_session=${forged}` },
    });
    assert.equal(response.status, 401);
  });

  test('an expired session cookie is treated as signed out', async () => {
    const response = await fetch(`${base}/api/lenses`, {
      headers: { Cookie: sessionCookie(READER.id, -1000) },
    });
    assert.equal(response.status, 401);
  });
});

describe('/healthz', () => {
  test('it reports the database it actually reached', async () => {
    stub([['SELECT 1', [{ '?column?': 1 }]]]);

    const response = await get('/healthz', { signedIn: false });
    assert.equal(response.status, 200);

    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.database, 'connected');
    assert.equal(typeof body.latencyMs, 'number');
    // Null locally rather than a placeholder string: an honest "this build does
    // not know which commit it is" is what lets the smoke suite compare it.
    assert.equal(body.commit, process.env.VERCEL_GIT_COMMIT_SHA ?? null);
  });

  test('a database that cannot be reached is a 500, not a green tick', async () => {
    // The whole point of the endpoint: a process that booted but cannot reach
    // Postgres is not healthy, and reporting it healthy ships a broken deploy.
    answers = [];
    // The app logs the failure at error level, correctly — silenced here so a
    // deliberate 500 does not print a stack in the middle of a green run.
    const original = console.error;
    console.error = () => {};
    try {
      const response = await get('/healthz', { signedIn: false });
      assert.equal(response.status, 500);
    } finally {
      console.error = original;
    }
  });
});
