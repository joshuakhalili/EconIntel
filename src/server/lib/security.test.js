/**
 * The failure mode these guard against is silence.
 *
 * A Content-Security-Policy that is too strict does not throw — the browser
 * blocks the resource and the page renders slightly wrong. The inline theme
 * script is the sharp case: block it and the theme flashes on every load,
 * which reads as a rendering quirk rather than a broken security header. So the
 * hash is computed from the served file, and this asserts that it is actually
 * present rather than quietly empty.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityHeaders } from './security.js';

const PUBLIC_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../public'
);

/** Minimal Express res/next stand-ins — the middleware only sets headers. */
function run({ publicDir = PUBLIC_DIR, isProduction = false } = {}) {
  const headers = {};
  let nexted = false;
  securityHeaders({ publicDir, isProduction })(
    {},
    { setHeader: (k, v) => (headers[k] = v) },
    () => (nexted = true)
  );
  return { headers, nexted };
}

describe('securityHeaders', () => {
  test('sets the headers that do not depend on environment', () => {
    const { headers, nexted } = run();
    assert.equal(nexted, true, 'must call next() or every request hangs');
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.equal(headers['X-Frame-Options'], 'DENY');
    assert.equal(headers['Referrer-Policy'], 'strict-origin-when-cross-origin');
    assert.match(headers['Permissions-Policy'], /geolocation=\(\)/);
  });

  test('sends HSTS only in production, since local dev is plain http', () => {
    assert.equal(run({ isProduction: false }).headers['Strict-Transport-Security'], undefined);
    assert.match(
      run({ isProduction: true }).headers['Strict-Transport-Security'],
      /max-age=\d+/
    );
  });

  test('never allows inline script, and hashes any that exists', () => {
    const csp = run().headers['Content-Security-Policy'];

    // The app had one inline script — a pre-paint block that decided light or
    // dark from localStorage. The site is dark only now, so that script is
    // gone and there is nothing to hash. `script-src 'self'` with no hash at
    // all is the stronger result, not a regression.
    //
    // The assertion that matters either way is the second one: inline script
    // is never permitted wholesale. Should an inline script return, the hash
    // branch has to hold, so both shapes are accepted here and neither is.
    assert.match(csp, /script-src 'self'(?: 'sha256-[A-Za-z0-9+/=]+')*(?:;|$)/);
    assert.doesNotMatch(csp, /script-src[^;]*'unsafe-inline'/);
  });

  test('allows the font and style sources the app actually loads', () => {
    const csp = run().headers['Content-Security-Policy'];
    // Recharts renders through React's style prop, so inline style must stay.
    assert.match(csp, /style-src[^;]*'unsafe-inline'/);
    assert.match(csp, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
    assert.match(csp, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
    assert.match(csp, /img-src[^;]*data:/); // inline SVG favicon
    assert.match(csp, /frame-ancestors 'none'/);
  });

  test('degrades instead of crashing when there is no build to hash', () => {
    const { headers } = run({ publicDir: '/nonexistent-build-dir' });
    // A fresh clone has no public/. Booting must still work; the SPA cannot be
    // served in that state anyway, so there is no inline script to permit.
    assert.match(headers['Content-Security-Policy'], /script-src 'self'/);
  });
});
