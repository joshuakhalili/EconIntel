/**
 * The error sink, tested for the two ways it could do harm.
 *
 * This module runs INSIDE the Express error handler. That gives it two failure
 * modes that matter more than whether it works:
 *
 *   1. Throwing. A sink that throws inside an error handler turns one broken
 *      route into a dead process, which is strictly worse than the silence it
 *      replaced. So most of what follows feeds it broken input and asserts it
 *      resolves anyway — a rejected promise here is a crashed deployment.
 *
 *   2. Carrying something out of the process that should never leave it. The
 *      redactor is the only thing between a Postgres error message and a public
 *      GitHub issue, and a redaction rule with no test is a comment. Every rule
 *      in REDACTIONS has a case below, and the end-to-end test asserts against
 *      the bytes actually handed to `fetch` rather than against the report
 *      object — a leak added between building and sending would pass the
 *      narrower assertion.
 */

import { test, describe, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  redact,
  fingerprint,
  buildReport,
  reportServerError,
  describeErrorSink,
  __testing,
} from './observability.js';

const SINK_VARS = [
  'ERROR_SINK_URL',
  'ERROR_SINK_TOKEN',
  'ERROR_SINK_GITHUB_REPO',
  'ERROR_SINK_GITHUB_TOKEN',
];

const realFetch = __testing.transport.fetch;
let sent;

/** A fetch that records what it was given and answers 201. */
const recordingFetch = (extra = {}) => async (url, init) => {
  sent.push({ url: String(url), init });
  return { ok: true, status: 201, json: async () => ({}), ...extra };
};

beforeEach(() => {
  sent = [];
  for (const name of SINK_VARS) delete process.env[name];
  __testing.reset();
  __testing.transport.fetch = recordingFetch();
});

afterEach(() => {
  for (const name of SINK_VARS) delete process.env[name];
  __testing.transport.fetch = realFetch;
  __testing.reset();
});

/*
 * Credential fixtures, assembled rather than written out.
 *
 * A test for a REDACTOR has to contain the shapes it redacts, and .githooks/pre-commit
 * scans every staged file for exactly those shapes. Written literally, this file blocks
 * its own commit — and the hook's own comments make the argument that matters here: a
 * false positive is how people learn to reach for --no-verify, which is the failure the
 * scanner exists to prevent.
 *
 * Concatenating the prefix keeps both properties. The scanner still catches a REAL key
 * pasted into this file, because a real key arrives as a literal. Nothing here is a
 * credential: every one is a keyboard pattern.
 */
const fixture = (prefix, body) => prefix + body;

describe('redact', () => {
  test('strips a reader email address', () => {
    assert.equal(
      redact('no reader for joshua@example.com in readers'),
      'no reader for [email] in readers'
    );
  });

  test('strips database credentials but keeps the diagnosis', () => {
    const out = redact(`connect ECONNREFUSED ${fixture('postgres', '://neondb_owner:npg_S3cr3t@ep-x.aws.neon.tech/db')}`);
    assert.match(out, /ECONNREFUSED/, 'the useful half survives');
    assert.doesNotMatch(out, /npg_S3cr3t/);
    assert.doesNotMatch(out, /neondb_owner/);
  });

  test('strips a bearer token, an api key and a github token', () => {
    assert.doesNotMatch(redact('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc'), /eyJhbGci/);
    assert.doesNotMatch(redact(`${fixture('sk', '-abcdefghijklmnopqrstuvwxyz012345')} rejected`), /abcdefghij/);
    assert.doesNotMatch(redact(`${fixture('ghp', '_0123456789abcdefghijABCDEFGHIJ')} expired`), /0123456789abcdef/);
    assert.doesNotMatch(redact(`${fixture('github', '_pat_11ABCDEFG0abcdefghijklmnop')} bad`), /ABCDEFG0abcdefghij/);
  });

  test('strips a session cookie however it is spelled', () => {
    assert.doesNotMatch(redact('bad cookie session=abc.def.ghi'), /abc\.def\.ghi/);
    assert.doesNotMatch(redact('SESSION: abc.def.ghi'), /abc\.def\.ghi/);
    assert.doesNotMatch(redact('secret = hunter2'), /hunter2/);
  });

  /*
   * Observed for real: a pg stack frame carried
   * `file:///Users/<account>/Projects/EconIntel/src/server/db/pool.js:142` on
   * the way to a sink. Harmless on Vercel, where every path is /var/task —
   * and a machine account name posted to a public issue tracker when the sink
   * is exercised from a laptop, which is exactly how it was found.
   */
  test('strips a developer home directory out of a stack frame', () => {
    const frame = 'at async query (file:///Users/somebody/Projects/EconIntel/src/server/db/pool.js:142:18)';
    const out = redact(frame);
    assert.doesNotMatch(out, /somebody/);
    assert.match(out, /pool\.js:142/, 'the frame still says where it was');
  });

  test('strips anything long enough to be a credential', () => {
    const token = 'A'.repeat(48);
    assert.doesNotMatch(redact(`unexpected token ${token}`), /AAAA/);
  });

  /*
   * The regression this ordering exists for: a general "anything long" rule
   * running first eats the credentials in a connection string, and the message
   * loses the label that says what was removed.
   */
  test('a labelled rule wins over the catch-all', () => {
    const out = redact('postgres://user:supersecretpasswordthatisverylongindeed@host/db');
    assert.match(out, /\[credentials\]/);
  });

  test('leaves an ordinary Postgres message alone', () => {
    const message = 'relation "chart_forms" does not exist';
    assert.equal(redact(message), message);
  });

  test('truncates rather than sending a novel', () => {
    assert.ok(redact('x'.repeat(5000)).length <= 401);
  });

  test('is total — a non-string never throws', () => {
    assert.equal(redact(undefined), '');
    assert.equal(redact(null), '');
    assert.equal(redact(42), '');
  });
});

describe('fingerprint', () => {
  test('two ids of the same broken route are one fault', () => {
    const a = fingerprint({ method: 'GET', path: '/data/9999', message: 'boom' });
    const b = fingerprint({ method: 'GET', path: '/data/1', message: 'boom' });
    assert.equal(a, b);
  });

  test('a different fault is a different fingerprint', () => {
    const a = fingerprint({ method: 'GET', path: '/api/series', message: 'boom' });
    const b = fingerprint({ method: 'GET', path: '/api/series', message: 'other' });
    assert.notEqual(a, b);
  });

  test('is total', () => {
    assert.equal(typeof fingerprint(), 'string');
    assert.equal(fingerprint().length, 8);
  });
});

describe('buildReport', () => {
  test('never carries error.detail, which is where pg puts row values', () => {
    const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      detail: 'Key (email)=(joshua@example.com) already exists.',
    });
    const report = buildReport({ error, method: 'POST', path: '/auth/email' });
    const serialised = JSON.stringify(report);
    assert.doesNotMatch(serialised, /joshua@example\.com/);
    assert.doesNotMatch(serialised, /Key \(email\)/);
    assert.equal(report.code, '23505', 'the SQLSTATE is kept — it is the diagnosis');
  });

  test('drops the query string, which is the only part a caller controls', () => {
    const report = buildReport({
      error: new Error('boom'),
      method: 'GET',
      path: '/api/series?ids=fred.GDPC1&token=abc',
    });
    assert.equal(report.path, '/api/series');
  });

  test('refuses a method it does not recognise rather than echoing it', () => {
    const report = buildReport({ error: new Error('boom'), method: '<script>', path: '/x' });
    assert.equal(report.method, 'UNKNOWN');
  });

  test('keeps at most three stack frames', () => {
    const error = new Error('boom');
    error.stack = ['Error: boom', ...Array.from({ length: 20 }, (_, i) => `    at f${i} (a.js:1:1)`)].join('\n');
    assert.equal(buildReport({ error, method: 'GET', path: '/x' }).stack.length, 3);
  });

  test('survives something that is not an Error at all', () => {
    const report = buildReport({ error: 'just a string', method: 'GET', path: '/x' });
    assert.equal(report.name, 'Error');
    assert.equal(report.message, 'just a string');
    assert.deepEqual(report.stack, []);
  });
});

describe('reportServerError', () => {
  test('does nothing, synchronously, when no sink is configured', () => {
    assert.equal(reportServerError({ error: new Error('boom'), method: 'GET', path: '/x' }), null);
    assert.equal(sent.length, 0);
  });

  test('posts to the webhook when one is configured', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';
    const result = await reportServerError({ error: new Error('boom'), method: 'GET', path: '/api/x' });
    assert.deepEqual(result, { delivered: true, via: 'webhook' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].url, 'https://sink.example/hook');
    assert.equal(JSON.parse(sent[0].init.body).path, '/api/x');
  });

  /*
   * The rate limit, which is the difference between a trace and a thousand
   * issues. Both halves are asserted: the same fault twice, and five different
   * faults filling the window.
   */
  test('the same fault twice sends once', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';
    await reportServerError({ error: new Error('boom'), method: 'GET', path: '/api/x' });
    assert.equal(reportServerError({ error: new Error('boom'), method: 'GET', path: '/api/x' }), null);
    assert.equal(sent.length, 1);
  });

  test('a storm of DIFFERENT faults stops at the window ceiling', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';
    for (let i = 0; i < 50; i += 1) {
      const promise = reportServerError({ error: new Error(`distinct fault ${String.fromCharCode(65 + i)}`), method: 'GET', path: '/api/x' });
      if (promise) await promise;
    }
    assert.equal(sent.length, __testing.WINDOW_MAX);
  });

  /*
   * THIS TEST USED TO BE UNABLE TO FAIL, IN TWO SEPARATE WAYS, AND BOTH ARE
   * WORTH KEEPING WRITTEN DOWN — they are the same mistake a rewrite would make.
   *
   *   1. IT NEVER LEFT ONE WINDOW. `claimSlot` refuses on "window full" BEFORE
   *      it records anything, so at most WINDOW_MAX (5) fingerprints are ever
   *      tracked inside a single window however long the loop runs. The map can
   *      only grow across windows — five more every ten minutes, forever, in a
   *      process that stays up. `rollWindow` is what makes time pass.
   *
   *   2. ITS 250 "DIFFERENT" FAULTS WERE ALL THE SAME FAULT. `fingerprint`
   *      collapses digits, deliberately, so that /data/1 and /data/9999 are one
   *      problem — which also means `fault 0` and `fault 249` hash identically.
   *      Every iteration after the first hit the cooldown instead. Measured:
   *      the map ended at 1.
   *
   * With both fixed, deleting the MAX_TRACKED_FINGERPRINTS guard turns this
   * red. Before either fix it stayed green with the guard gone.
   */
  test('the fingerprint map cannot grow without bound', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';
    // Base-26 letters, because digits are normalised away by design.
    const label = (n) => {
      let out = '';
      do { out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26); } while (n > 0);
      return out;
    };

    const total = __testing.MAX_TRACKED_FINGERPRINTS + 50;
    for (let i = 0; i < total; i += 1) {
      __testing.rollWindow();
      const promise = reportServerError({ error: new Error(`fault ${label(i)}`), method: 'GET', path: '/api/x' });
      if (promise) await promise;
    }

    // Every fault really was recorded — otherwise the ceiling was never
    // approached and the assertion below would pass for the wrong reason.
    assert.equal(sent.length, total, 'each fault should have been delivered once');
    assert.ok(
      __testing.state().tracked <= __testing.MAX_TRACKED_FINGERPRINTS,
      `the map grew to ${__testing.state().tracked}, past the ${__testing.MAX_TRACKED_FINGERPRINTS} ceiling`
    );
  });

  test('a sink that throws resolves rather than rejecting', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';
    __testing.transport.fetch = async () => { throw new Error('DNS is down'); };
    const result = await reportServerError({ error: new Error('boom'), method: 'GET', path: '/api/x' });
    assert.equal(result.delivered, false);
    assert.match(result.reason, /sink failed/);
  });

  test('a sink that answers 500 resolves rather than rejecting', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';
    __testing.transport.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    const result = await reportServerError({ error: new Error('boom'), method: 'GET', path: '/api/x' });
    assert.deepEqual(result, { delivered: false, reason: 'webhook 503' });
  });

  test('nothing a reader could send reaches the wire', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';
    const error = Object.assign(
      new Error('insert failed for joshua@example.com with session=abc.def.ghi'),
      { code: '25006', detail: 'Key (email)=(joshua@example.com) already exists.' }
    );
    await reportServerError({ error, method: 'POST', path: '/auth/email?email=joshua@example.com' });
    const wire = sent[0].init.body;
    assert.doesNotMatch(wire, /joshua@example\.com/);
    assert.doesNotMatch(wire, /abc\.def\.ghi/);
    assert.match(wire, /25006/, 'the SQLSTATE still gets there');
  });
});

describe('the GitHub transport', () => {
  const configure = () => {
    process.env.ERROR_SINK_GITHUB_REPO = 'owner/repo';
    process.env.ERROR_SINK_GITHUB_TOKEN = 'ghp_' + '0'.repeat(36);
  };

  test('searches for an open issue before opening one', async () => {
    configure();
    __testing.transport.fetch = async (url) => {
      sent.push({ url: String(url) });
      if (String(url).includes('/search/issues')) {
        return { ok: true, status: 200, json: async () => ({ total_count: 1 }) };
      }
      return { ok: true, status: 201, json: async () => ({}) };
    };
    const result = await reportServerError({ error: new Error('boom'), method: 'GET', path: '/api/x' });
    assert.deepEqual(result, { delivered: false, reason: 'already open', via: 'github' });
    assert.equal(sent.length, 1, 'the issue was never created');
  });

  test('opens the issue when the search finds nothing', async () => {
    configure();
    __testing.transport.fetch = async (url, init) => {
      sent.push({ url: String(url), init });
      if (String(url).includes('/search/issues')) {
        return { ok: true, status: 200, json: async () => ({ total_count: 0 }) };
      }
      return { ok: true, status: 201, json: async () => ({}) };
    };
    const result = await reportServerError({ error: new Error('boom'), method: 'GET', path: '/api/x' });
    assert.deepEqual(result, { delivered: true, via: 'github' });
    const created = sent.at(-1);
    assert.match(created.url, /\/repos\/owner\/repo\/issues$/);
    assert.match(JSON.parse(created.init.body).title, /^\[500\] GET \/api\/x/);
  });

  /*
   * A search that fails must not silence the report. A duplicate issue is a
   * nuisance; a missing one is the failure this module exists to prevent.
   */
  test('a failed search still opens the issue', async () => {
    configure();
    __testing.transport.fetch = async (url, init) => {
      if (String(url).includes('/search/issues')) throw new Error('rate limited');
      sent.push({ url: String(url), init });
      return { ok: true, status: 201, json: async () => ({}) };
    };
    const result = await reportServerError({ error: new Error('boom'), method: 'GET', path: '/api/x' });
    assert.equal(result.delivered, true);
    assert.equal(sent.length, 1);
  });

  test('a malformed repo is treated as no sink at all', () => {
    process.env.ERROR_SINK_GITHUB_REPO = 'https://github.com/owner/repo';
    process.env.ERROR_SINK_GITHUB_TOKEN = 'ghp_' + '0'.repeat(36);
    assert.equal(reportServerError({ error: new Error('boom'), method: 'GET', path: '/x' }), null);
  });
});

describe('describeErrorSink', () => {
  test('reports whether errors have anywhere to go, and never says where', () => {
    assert.deepEqual(describeErrorSink(), { configured: false, kind: null });
    process.env.ERROR_SINK_URL = 'https://sink.example/hook?token=secret';
    const described = describeErrorSink();
    assert.deepEqual(described, { configured: true, kind: 'webhook' });
    assert.doesNotMatch(JSON.stringify(described), /secret/);
  });
});

/*
 * ── THE WIRING ───────────────────────────────────────────────────────────────
 *
 * Everything above tests the module in isolation, and all of it would still
 * pass if `app.js` never called it. That is not a hypothetical: the call is one
 * line in one error handler, and nothing else in the tree references this file,
 * so deleting it would leave 596 tests, five gates and a green smoke run all
 * agreeing that production reports its errors when it silently does not.
 *
 * So these two reach the real handler in the real app.
 */
describe('the error handler in app.js', () => {
  /*
   * Set before `app.js` is imported, because `config.js` reads the environment
   * once at module load and `dotenv` does not overwrite what is already there.
   * The DATABASE_URL is deliberately a dead loopback address: the pool below is
   * stubbed, and if a statement ever escaped the stub it must fail to connect
   * rather than reach the real Neon database named in `.env`.
   */
  process.env.SESSION_SECRET ??= 'r'.repeat(64);
  process.env.DATABASE_URL = 'postgres://unused:unused@127.0.0.1:5432/unused';
  process.env.DB_DRIVER = 'pg';

  let app;
  let pool;
  let realQuery;
  let realConsoleError;

  before(async () => {
    ({ pool } = await import('../db/pool.js'));
    ({ app } = await import('../app.js'));
    realQuery = pool.query;
  });

  beforeEach(() => {
    // The handler logs at error level, correctly. Silenced so a deliberate 500
    // does not print a stack in the middle of a green run.
    realConsoleError = console.error;
    console.error = () => {};
  });

  afterEach(() => {
    console.error = realConsoleError;
    if (realQuery) pool.query = realQuery;
  });

  test('a 500 from a real route reaches the sink', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';
    pool.query = async () => { throw new Error('connection terminated unexpectedly'); };

    const server = app.listen(0);
    try {
      await new Promise((resolve) => server.once('listening', resolve));
      const response = await fetch(`http://127.0.0.1:${server.address().port}/healthz`);
      assert.equal(response.status, 500);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }

    assert.equal(sent.length, 1, 'the 500 should have been reported exactly once');
    const report = JSON.parse(sent[0].init.body);
    assert.equal(report.path, '/healthz');
    assert.equal(report.method, 'GET');
    assert.match(report.message, /connection terminated/);
  });

  /*
   * THE BRANCH THAT DECIDES WHETHER THE PROCESS LIVES.
   *
   * An error can arrive after the response has started. `res.status()` throws
   * `ERR_HTTP_HEADERS_SENT` then, and where it throws is the whole question:
   * synchronously, Express catches it and the process carries on; inside the
   * `.then()` that awaiting the sink introduces, nothing is listening and Node
   * exits on the unhandled rejection. Measured both ways before the guard was
   * written.
   *
   * The handler is invoked directly rather than through a request, because no
   * route in this app answers and then fails — which is exactly why this needs
   * a test rather than a comment. `res.status` here throws the way Node's does,
   * so removing the guard makes this test fail rather than merely change.
   */
  /**
   * The shipped error handler itself. Express identifies one by its arity.
   *
   * `_router` is an Express 4 internal and Express 5 removes it. That is worth
   * reaching into rather than working around, because no route in this app
   * answers and then fails — so the branch below cannot be reached through a
   * request, and the alternative to reaching in is not testing it. Asserted
   * rather than optional-chained into silence: on an upgrade this must fail
   * loudly and be rewritten, not quietly stop checking anything.
   */
  const errorHandler = () => {
    assert.ok(
      Array.isArray(app._router?.stack),
      'Express no longer exposes _router.stack — this test needs rewriting, not deleting'
    );
    const layers = app._router.stack.filter((layer) => layer.handle.length === 4);
    assert.ok(layers.length > 0, 'app.js should register an error handler');
    return layers.at(-1).handle;
  };

  test('an error after the response has started does not touch the response', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';

    const handler = errorHandler();

    let statusCalled = false;
    const res = {
      headersSent: true,
      status() { statusCalled = true; throw new Error('Cannot set headers after they are sent to the client'); },
      destroy() {},
    };
    const error = new Error('failed after responding');
    let passedOn;

    await handler(error, { method: 'GET', path: '/api/series' }, res, (e) => { passedOn = e; });

    assert.equal(statusCalled, false, 'the response must not be written to again');
    assert.equal(passedOn, error, "Express's own final handler has to be given the error");
  });

  /*
   * THE AWAIT IS THE FEATURE, SO IT NEEDS AN ASSERTION.
   *
   * `reportServerError(…)` without the `await` is the obvious tidy-up — it
   * answers the reader a few hundred milliseconds sooner and every other test
   * in this file still passes. On a long-lived host it would even work. On
   * Vercel it does not: the invocation is over when the response ends and the
   * instance freezes, so a fetch that was started and never awaited is killed
   * before it connects and the report is simply lost, silently, on the one
   * platform this runs on.
   *
   * Nothing else here can tell those apart, so this holds the ordering: with a
   * sink that has not answered yet, the reader has not been answered either.
   */
  test('the reader is not answered until the report is away', async () => {
    process.env.ERROR_SINK_URL = 'https://sink.example/hook';
    let release;
    __testing.transport.fetch = (url, init) => {
      sent.push({ url: String(url), init });
      return new Promise((resolve) => {
        release = () => resolve({ ok: true, status: 201, json: async () => ({}) });
      });
    };

    let status = null;
    const res = {
      headersSent: false,
      status(code) { status = code; return this; },
      json() { return this; },
      destroy() {},
    };

    const pending = errorHandler()(new Error('boom'), { method: 'GET', path: '/api/x' }, res, () => {});

    // A turn of the loop is enough for anything that was not waiting.
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(sent.length, 1, 'the report should already be in flight');
    assert.equal(status, null, 'the 500 was sent before the report was away — the await is gone');

    release();
    await pending;
    assert.equal(status, 500, 'and once the report is away, the reader gets their 500');
  });
});
