/**
 * The request path, over real HTTP.
 *
 * WHY THIS FILE IS SEPARATE FROM app.test.js
 *
 * That file's contract is that importing `app.js` opens no port — it asserts
 * `app.listening === undefined` — and it never issues a request. Everything
 * here does the opposite: it binds a listener of its own and speaks to the app
 * the way a browser would, because the four defects below are all invisible to
 * a structural test. Each of them shipped, and each of them was found by
 * curling production rather than by anything in the suite.
 *
 * NOTHING HERE TOUCHES THE DATABASE, DELIBERATELY.
 *
 * Every path exercised either fails in `express.json` before routing, is
 * refused by the auth gate before its handler, is rejected by the rate limiter,
 * or is rejected by the email regex in `signInWithEmail` before its INSERT. So
 * this runs against a machine with no database reachable, and — more to the
 * point — it can never write a row while proving that writes are bounded.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

/*
 * Set before importing the app, because `config.js` reads the environment at
 * module load and `dotenv` does not overwrite what is already there. Both gates
 * under test — the auth gate and the CORS allowlist — are switched on by this
 * one variable, so without it the assertions below would pass against a server
 * with no gate at all.
 */
process.env.SESSION_SECRET ??= 'a'.repeat(64);
process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1:5432/unused';

const { app } = await import('./app.js');

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

/** POST a raw body, bypassing anything that would tidy it up first. */
function post(path, body, headers = {}) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

describe('a bad request body is the caller\'s fault, and is answered as one', () => {
  test('malformed JSON is 400, not 500 "Internal error"', async () => {
    const response = await post('/healthz', '{bad');
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Malformed JSON' });
  });

  test('an oversized body is 413', async () => {
    // express.json is capped at 4kb; 6kB is comfortably past it.
    const response = await post('/healthz', JSON.stringify({ pad: 'x'.repeat(6000) }));
    assert.equal(response.status, 413);
    assert.deepEqual(await response.json(), { error: 'Request body too large' });
  });

  test('neither writes an error line to the log', async () => {
    /*
     * The second half of the finding, and the half that costs money: every one
     * of these used to reach `console.error('[http]', error)`, so an anonymous
     * caller controlled how many lines went into the function log — for free,
     * in a process that had no rate limit in front of it either.
     */
    const original = console.error;
    const lines = [];
    console.error = (...args) => lines.push(args);
    try {
      await post('/healthz', '{bad');
      await post('/healthz', JSON.stringify({ pad: 'x'.repeat(6000) }));
    } finally {
      console.error = original;
    }
    assert.deepEqual(lines, []);
  });
});

describe('the provenance endpoint is reachable without an account', () => {
  test('/api/status is registered above the auth gate', async () => {
    /*
     * Structural rather than a request, because /api/status is the one route
     * here that does reach the database. The ordering IS the finding: the route
     * carried a comment calling itself "public rather than admin-only on
     * purpose" while sitting 608 lines below `app.use('/api', requireReader())`,
     * so it answered 401 to every anonymous visitor — someone deciding whether
     * to trust the site had to make an account before they could check where
     * its numbers came from.
     */
    const stack = app._router?.stack ?? [];
    const statusIndex = stack.findIndex((l) => l.route?.path === '/api/status');
    /*
     * Found by NAME, not by mount path. "The first non-route layer mounted on
     * /api" stopped being the gate the moment a rate limiter was mounted there
     * too, and a test that identifies its subject by guessing goes quiet rather
     * than red when the guess breaks. `requireReader` is named in auth.js for
     * exactly this.
     */
    const gateIndex = stack.findIndex((l) => !l.route && l.handle?.name === 'requireReader');

    assert.ok(statusIndex >= 0, '/api/status should be registered');
    assert.ok(gateIndex >= 0, 'the /api auth gate should be registered and named');
    assert.ok(statusIndex < gateIndex, '/api/status must come before the /api auth gate');
  });

  test('the gate is genuinely armed, so that ordering means something', async () => {
    // Without this the test above passes against a server where nothing is
    // gated at all and the ordering is decorative.
    const response = await fetch(`${base}/api/lenses`);
    assert.equal(response.status, 401);
  });
});

describe('a cross-site POST cannot act on a reader', () => {
  test('logout from another site is refused', async () => {
    const response = await post('/auth/logout', '', { 'Sec-Fetch-Site': 'cross-site' });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('set-cookie'), null, 'no session was cleared');
  });

  test('logout from our own page still works', async () => {
    const response = await post('/auth/logout', '', { 'Sec-Fetch-Site': 'same-origin' });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie') ?? '', /diffusion_session=/);
  });
});

describe('sign-in is rate limited', () => {
  test('twenty rapid posts return a mix of 400 and 429', async () => {
    /*
     * The acceptance test for the finding, written as the finding stated it:
     * before this, twenty rapid posts returned twenty identical answers, and
     * every one of them with a well-formed address would have INSERTed a row
     * into `readers` on the production primary.
     *
     * The address is deliberately invalid so `signInWithEmail` throws on the
     * regex before it reaches its INSERT. This test never writes.
     */
    const codes = [];
    for (let i = 0; i < 20; i += 1) {
      const response = await post(
        '/auth/email',
        JSON.stringify({ name: 'Rate Limit Probe', email: 'not-an-email' }),
        { 'Sec-Fetch-Site': 'same-origin' }
      );
      codes.push(response.status);
    }

    assert.ok(codes.includes(400), 'the early requests are answered on their merits');
    assert.ok(codes.includes(429), 'the later ones are refused');
    assert.equal(codes.at(-1), 429);
    // The allowance is 10 per caller per minute; the two logout posts above are
    // on the same bucket, so the crossover is at 8 rather than 10.
    assert.equal(codes.filter((c) => c === 400).length, 8);
  });
});
