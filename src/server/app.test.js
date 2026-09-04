/**
 * Does the server actually load?
 *
 * WHY THIS TEST EXISTS
 *
 * On 2026-08-31 `app.js` was committed, pushed and deployed with a syntax
 * error in it. 102 tests passed. Every gate — tokens, contrast, routes,
 * vercel, the full production build — passed. The break was found by a
 * serverless function crashing in London with
 * `SyntaxError: missing ) after argument list` and no filename in the stack.
 *
 * Nothing caught it because nothing imported the file. The unit tests cover
 * `lib/` and `repositories/`; `app.js` was only ever executed by starting the
 * server, and the local server happened to still be running the previous
 * build. The whole suite was green against a server that could not parse.
 *
 * The cause was a comment placed INSIDE a SQL template literal, using
 * backticks to quote an identifier — a backtick inside a template literal
 * ends the string. A plausible enough mistake that the defence has to be
 * mechanical rather than a rule to remember.
 *
 * WHAT THIS DOES AND DOES NOT PROVE
 *
 * Importing the module parses every file it reaches and runs everything at
 * module scope: the route table is built, `securityHeaders` scans the HTML,
 * the pool is constructed. That is the whole class of "the server is broken
 * before it serves anything" — syntax errors, bad imports, a throw at load.
 *
 * It does not touch the database. `pg` connects lazily, on the first query,
 * and no query runs here. It does not start a listener either: that is the
 * entire reason `app.js` and `index.js` were split, and this test is the
 * thing that split paying for itself.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('app module', () => {
  test('parses and loads without throwing', async () => {
    const module = await import('./app.js');
    assert.equal(typeof module.app, 'function', 'app should be an Express handler');
    assert.equal(module.default, module.app, 'default export is the same app');
  });

  test('importing it does not open a port', async () => {
    // If `app.listen` ever creeps back into app.js, this file would leave a
    // socket open and the test runner would hang rather than exit. Asserting
    // the handler has no `.listening` is a cheap direct statement of it.
    const { app } = await import('./app.js');
    assert.equal(app.listening, undefined);
  });

  test('registers the routes the deploy config rewrites to', async () => {
    const { app } = await import('./app.js');

    /* Express 4 keeps the registered layers on the router. Reading them is
       reaching into an internal, which is acceptable here because the
       alternative is booting a server, and the assertion is about wiring
       rather than behaviour. */
    const paths = (app._router?.stack ?? [])
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path)
      .flat();

    for (const required of ['/healthz', '/api/me', '/api/lenses', '/api/financing']) {
      assert.ok(paths.includes(required), `${required} should be registered`);
    }
  });

  test('/api/me is registered before the auth gate', async () => {
    const { app } = await import('./app.js');
    const stack = app._router?.stack ?? [];

    const meIndex = stack.findIndex((l) => l.route?.path === '/api/me');

    /*
     * The gate is found by NAME, not by guessing at a mount path.
     *
     * This used to take "the first non-route layer whose regexp mentions api",
     * which stopped being the gate the moment a rate limiter was mounted on
     * /api in front of it — `app.use('/api', apiLimiter)` is registered first,
     * so the index below pointed at the limiter and the assertion compared
     * /api/me against the wrong layer while still reporting a tick. Worse, the
     * whole check sat behind `if (gateIndex >= 0)`, so a guess that found
     * nothing at all skipped the assertion silently rather than failing.
     *
     * `requireReader` is a named function in lib/auth.js for exactly this
     * reason, and the name is asserted so that renaming it fails here rather
     * than turning this test off.
     */
    const gateIndex = stack.findIndex((l) => !l.route && l.handle?.name === 'requireReader');

    assert.ok(meIndex >= 0, '/api/me should be registered');
    assert.ok(gateIndex >= 0, 'the /api auth gate should be registered and named requireReader');
    // The ordering is load-bearing and invisible in any single file: behind
    // the gate, /api/me 401s and the client can never discover that sign-in
    // exists. It is also the reason the Vercel deploy is one function rather
    // than one per route.
    assert.ok(meIndex < gateIndex, '/api/me must come before the /api auth gate');
  });
});
