/**
 * The one number that decides whether the site is readable.
 *
 * WHY THIS TEST EXISTS
 *
 * `secret()` refused any SESSION_SECRET under 32 characters. `isConfigured()`
 * only asked whether the variable was truthy. Set SESSION_SECRET to "dev" and
 * the two disagreed, which produced the worst shape a failure can have: a site
 * that reports itself completely healthy and cannot be entered. /healthz green,
 * because it only touches Postgres. The smoke suite green, because it never
 * signs in. The `/api` gate ARMED, because `isConfigured()` said yes. And every
 * sign-in attempt throwing a 500 out of `sign()`, because `secret()` said no.
 * Sealed shut, silently, with nothing in the logs naming the cause.
 *
 * `usableSecret()` now answers both questions, so the two cannot drift again by
 * accident — but a shared helper is a convention, and a convention is exactly
 * the kind of thing a later edit undoes without noticing. So the assertion below
 * is not "isConfigured returns false for a short secret". It is the invariant
 * itself: WHENEVER `isConfigured()` SAYS SIGN-IN IS ON, SIGNING SOMETHING MUST
 * ACTUALLY WORK. Those two facts are checked independently, against the exported
 * API only, and compared. A future refactor that reintroduces the gap fails here
 * whatever shape it takes.
 *
 * WHY EACH CASE RUNS IN ITS OWN PROCESS
 *
 * `config.js` reads `process.env` once at import and `Object.freeze`s the
 * result. Mutating `process.env` afterwards does nothing, and a cache-busted
 * `import('./auth.js?v=2')` does not help either: the fresh copy of auth.js
 * still resolves `'../config.js'` to the URL already in the module cache, so it
 * gets the same frozen config the first import produced. One environment per
 * process is the only honest way to test a module that freezes its environment,
 * and spawning four short-lived children costs less than a second.
 *
 * The child is given the parent's environment with SESSION_SECRET overridden,
 * because `config.js` still requires DATABASE_URL to boot. `dotenv` does not
 * overwrite a variable that is already set, so the value passed here wins over
 * whatever is in the developer's `.env` — including the empty string.
 *
 * Run with: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AUTH_MODULE = new URL('./auth.js', import.meta.url).href;

/**
 * Load auth.js in a fresh process under a given SESSION_SECRET and report two
 * things about it: what it CLAIMS, and what it can actually DO.
 *
 * `beginLogin` is the cheapest exported path that reaches `sign()`, and it takes
 * a stub `res` because all it does with one is set a cookie and redirect. That
 * makes "can this server sign anything" observable without a running server, a
 * database, or a GitHub app — a null client id lands in the redirect URL as a
 * query parameter and nothing here follows the redirect.
 */
function inspect(sessionSecret) {
  const script = `
    const auth = await import(${JSON.stringify(AUTH_MODULE)});
    const out = { configured: auth.isConfigured(), signs: false, error: null };
    try {
      const cookies = {};
      auth.beginLogin(
        { headers: {}, protocol: 'https', get: () => 'diffusion.test' },
        { cookie: (name, value) => { cookies[name] = value; }, redirect: () => {} }
      );
      // A sealed cookie is \`value.expiry.hmac\`. Three parts means sign() ran.
      out.signs = String(cookies.diffusion_oauth_state ?? '').split('.').length === 3;
    } catch (error) {
      out.error = error.message;
    }
    console.log(JSON.stringify(out));
  `;

  const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    env: { ...process.env, SESSION_SECRET: sessionSecret },
    cwd: fileURLToPath(new URL('../../..', import.meta.url)),
  });

  assert.equal(
    child.status,
    0,
    `loading auth.js with a ${sessionSecret.length}-character secret crashed the process:\n${child.stderr}`
  );
  return JSON.parse(child.stdout);
}

/*
 * 64 hex characters is what `openssl rand -hex 32` prints — the command in
 * auth.js's own error message, and so the value an operator following the
 * instructions will actually paste in.
 */
const REAL_SECRET = 'a'.repeat(64);

describe('isConfigured', () => {
  test('an absent secret means sign-in is off, not broken', () => {
    const { configured, signs } = inspect('');
    assert.equal(configured, false, 'no secret cannot mean sign-in is available');
    assert.equal(signs, false);
  });

  /*
   * The boundary, from both sides. 32 is not a taste: an HMAC-SHA256 key
   * shorter than the 256-bit digest it produces adds no strength, which is
   * where MIN_SECRET_LENGTH comes from.
   */
  test('31 characters is one short, and reports itself off', () => {
    const { configured, signs, error } = inspect('b'.repeat(31));
    assert.equal(
      configured,
      false,
      'a secret too short to sign with must never report the API gate as armed'
    );
    assert.equal(signs, false);
    assert.match(
      error ?? '',
      /at least 32 characters/,
      'the failure must name the length, since the whole bug was that nothing did'
    );
  });

  test('32 characters is exactly enough, and reports itself on', () => {
    const { configured, signs, error } = inspect('c'.repeat(32));
    assert.equal(configured, true);
    assert.equal(signs, true, `signing failed at the length that is supposed to work: ${error}`);
  });

  test('a real `openssl rand -hex 32` secret works', () => {
    const { configured, signs } = inspect(REAL_SECRET);
    assert.equal(configured, true);
    assert.equal(signs, true);
  });
});

describe('the invariant that was violated', () => {
  /**
   * THE ONE THAT WOULD HAVE CAUGHT IT.
   *
   * Not "short secrets are rejected" — the broken version rejected them too,
   * inside `sign()`, at request time, with a 500. What it did not do was say so
   * at the gate. There are exactly two legitimate states here, "sign-in works"
   * and "sign-in is off and the site is open", and the third state the bug
   * created — gate armed, door broken — is precisely `configured && !signs`.
   */
  test('claiming to be configured always means the server can sign', () => {
    for (const secret of ['', 'dev', 'd'.repeat(31), 'e'.repeat(32), REAL_SECRET]) {
      const { configured, signs, error } = inspect(secret);
      assert.equal(
        configured,
        signs,
        `SESSION_SECRET of ${secret.length} characters: isConfigured() said ${configured} ` +
          `while signing ${signs ? 'worked' : `failed (${error})`}. ` +
          'A server that reports sign-in as available must be able to sign a cookie.'
      );
    }
  });
});
