/**
 * The failure mode these guard against is silence.
 *
 * A Content-Security-Policy that is too strict does not throw. The browser
 * blocks the resource, reports it to a console nobody is watching, and the page
 * renders slightly wrong — which reads as a design choice rather than a broken
 * security header.
 *
 * That is not hypothetical. From 2026-08-28 to 2026-08-30 this middleware
 * scanned only `public/index.html`, which is Vite output and carries a single
 * `<script src>`. The scan found nothing, the CSP went out as a bare
 * `script-src 'self'`, and it was applied to every response — including the
 * Framer landing page, whose seven executable inline scripts were all blocked.
 * One of them is `animator`, the entrance-animation engine for the entire front
 * door. Nothing failed. The page just sat in its pre-animation state.
 *
 * The previous version of this file had a test called "never allows inline
 * script, and hashes any that exists" which accepted zero hashes and argued in
 * a comment that zero was "the stronger result, not a regression". It was
 * passing green throughout. A test that accepts both branches of the thing it
 * is checking cannot fail, so the assertion below is the opposite shape: it
 * reads the HTML actually being served, finds every script a browser would
 * execute, and requires a matching hash for each one.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { securityHeaders, inlineScriptHashes } from './security.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const LANDING_DIR = path.join(ROOT, 'landing');

/** Minimal Express res/next stand-ins — the middleware only sets headers. */
function run({ publicDir = PUBLIC_DIR, landingDir = LANDING_DIR, isProduction = false } = {}) {
  const headers = {};
  let nexted = false;
  securityHeaders({ publicDir, landingDir, isProduction })(
    {},
    { setHeader: (k, v) => (headers[k] = v) },
    () => (nexted = true)
  );
  return { headers, nexted };
}

/**
 * Independently re-derive what the browser will demand.
 *
 * Deliberately NOT a call into `security.js`: a test that reuses the
 * implementation's own scanner agrees with it by construction, including when
 * both are wrong. This walks the directories itself.
 */
function executableInlineScripts(root, { skipDotDirs = true } = {}) {
  const found = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (skipDotDirs && entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) {
        const html = readFileSync(full, 'utf8');
        for (const [, attrs, body] of html.matchAll(
          /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g
        )) {
          const type = (/\btype\s*=\s*["']?([^"'\s>]+)/.exec(attrs)?.[1] ?? '').toLowerCase();
          // A browser does not execute an unknown script type, so Framer's
          // `framer/appear` keyframe blobs are data and need no hash.
          if (!['', 'text/javascript', 'application/javascript', 'module'].includes(type)) {
            continue;
          }
          found.push({
            file: path.relative(ROOT, full),
            bytes: body.length,
            hash: `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`,
          });
        }
      }
    }
  };
  walk(root);
  return found;
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

  test('never allows inline script wholesale', () => {
    assert.doesNotMatch(run().headers['Content-Security-Policy'], /script-src[^;]*'unsafe-inline'/);
  });

  /**
   * THE ONE THAT WOULD HAVE CAUGHT IT.
   *
   * Not "a hash is present" — "every script the browser will run is permitted".
   * Those differ by exactly the bug: seven scripts, zero hashes, and a CSP that
   * looked perfectly reasonable.
   */
  test('permits every executable inline script that is actually served', () => {
    const scripts = [
      ...executableInlineScripts(PUBLIC_DIR),
      ...executableInlineScripts(LANDING_DIR),
    ];

    // Guard the guard. If the landing mirror is ever rebuilt without inline
    // script this test would silently become vacuous, so make that state loud.
    assert.ok(
      scripts.length > 0,
      'expected the served HTML to contain inline script; if that changed on purpose, this test needs rewriting rather than deleting'
    );

    const csp = run().headers['Content-Security-Policy'];
    const missing = scripts.filter((s) => !csp.includes(s.hash));

    assert.deepEqual(
      missing.map((s) => `${s.file} (${s.bytes} bytes)`),
      [],
      'these inline scripts are served but not permitted by the CSP, so the browser will silently refuse to run them'
    );
  });

  /**
   * The CSP allowlist must contain what is served and nothing more.
   *
   * `landing/.mirror-cache/pages/` holds the original Framer template as
   * downloaded, before the content map and hardening ran. Scanning it added
   * three hashes for script bodies no served page uses — harmless in effect,
   * wrong in principle, and the sort of drift that makes an allowlist stop
   * meaning anything.
   */
  test('does not permit scripts from the un-hardened mirror cache', (t) => {
    // `.mirror-cache` is 19 MB of downloaded Framer original and is gitignored, so a
    // CI checkout does not have it. That is a missing fixture, not a failure — but it
    // must SKIP LOUDLY rather than pass, because a vacuous pass here is exactly the
    // drift this test exists to catch. The presence check below still fails hard when
    // the directory IS there and the scan comes back empty.
    const cacheDir = path.join(LANDING_DIR, '.mirror-cache');
    if (!existsSync(cacheDir)) {
      t.skip(
        'landing/.mirror-cache is absent (gitignored, local-only). This check cannot run ' +
        'here. Run it on a machine that has the mirror, or `python3 landing/docs/mirror.py` first.'
      );
      return;
    }

    const cacheOnly = executableInlineScripts(cacheDir, { skipDotDirs: false });
    assert.ok(
      cacheOnly.length > 0,
      'the mirror cache exists but no inline script was found in it — the scanner has ' +
      'stopped seeing what it is meant to police'
    );

    const served = new Set(
      [...executableInlineScripts(PUBLIC_DIR), ...executableInlineScripts(LANDING_DIR)]
        .map((s) => s.hash)
    );
    const csp = run().headers['Content-Security-Policy'];

    for (const script of cacheOnly) {
      if (served.has(script.hash)) continue; // shared with a real page; fine
      assert.ok(
        !csp.includes(script.hash),
        `CSP permits ${script.file}, which is build cache and is never served`
      );
    }
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
    const { headers } = run({ publicDir: '/nonexistent-build-dir', landingDir: '/nope' });
    // A fresh clone has no public/. Booting must still work.
    assert.match(headers['Content-Security-Policy'], /script-src 'self'/);
  });

  test('deduplicates, since the landing pages share most of their scripts', () => {
    const hashes = inlineScriptHashes([PUBLIC_DIR, LANDING_DIR]);
    assert.equal(new Set(hashes).size, hashes.length);
  });
});

/**
 * The rate limiter and the same-origin guard.
 *
 * Both replace an absence rather than a weaker version, which is why every
 * assertion below states a number: "some limiting happens" is the shape of test
 * that passes against a middleware that counts and never refuses.
 */

import { rateLimit, sameOriginOnly, __testing } from './security.js';

/** A req/res pair thin enough that the middleware is the only thing under test. */
function call(middleware, { headers = {}, remoteAddress = '203.0.113.1', method = 'POST' } = {}) {
  let nexted = false;
  const result = { status: null, body: null, headers: {} };
  const req = { headers, method, socket: { remoteAddress }, protocol: 'https', get: (h) => headers[h.toLowerCase()] };
  const res = {
    setHeader(name, value) { result.headers[name] = value; },
    status(code) { result.status = code; return res; },
    json(body) { result.body = body; return res; },
  };
  middleware(req, res, () => { nexted = true; });
  return { ...result, nexted };
}

describe('rateLimit', () => {
  test('lets the allowance through and refuses the request after it', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 3 });
    const outcomes = [];
    for (let i = 0; i < 5; i += 1) outcomes.push(call(limiter).nexted);
    assert.deepEqual(outcomes, [true, true, true, false, false]);
  });

  test('answers 429 with Retry-After and no-store', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });
    call(limiter);
    const refused = call(limiter);
    assert.equal(refused.status, 429);
    // Without Retry-After a client has no way to back off except by guessing.
    assert.ok(Number(refused.headers['Retry-After']) >= 1);
    // A cached 429 would refuse every reader behind the same shared cache.
    assert.equal(refused.headers['Cache-Control'], 'no-store');
  });

  test('counts each caller separately', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });
    assert.equal(call(limiter, { remoteAddress: '198.51.100.1' }).nexted, true);
    assert.equal(call(limiter, { remoteAddress: '198.51.100.2' }).nexted, true);
    assert.equal(call(limiter, { remoteAddress: '198.51.100.1' }).nexted, false);
  });

  test('the global ceiling holds even when every request claims a new address', () => {
    // The whole point of the second ceiling: `callerKey` reads a header the
    // caller controls, so per-caller counting alone can be spent around.
    const limiter = rateLimit({ windowMs: 60_000, max: 100, globalMax: 3 });
    const outcomes = [];
    for (let i = 0; i < 5; i += 1) {
      outcomes.push(call(limiter, { headers: { 'x-forwarded-for': `192.0.2.${i}` } }).nexted);
    }
    assert.deepEqual(outcomes, [true, true, true, false, false]);
  });

  test('a new window forgives', async () => {
    const limiter = rateLimit({ windowMs: 15, max: 1 });
    assert.equal(call(limiter).nexted, true);
    assert.equal(call(limiter).nexted, false);
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(call(limiter).nexted, true);
  });

  test('past the tracking ceiling, untracked callers fall to the global limit', () => {
    // The per-caller Map is keyed on caller-controlled input, so it needs a
    // bound — and the bound must not become a way to buy an exemption.
    const limiter = rateLimit({ windowMs: 60_000, max: 1, globalMax: __testing.MAX_TRACKED_CALLERS + 1 });
    for (let i = 0; i < __testing.MAX_TRACKED_CALLERS; i += 1) {
      call(limiter, { headers: { 'x-forwarded-for': `10.0.${Math.floor(i / 256)}.${i % 256}` } });
    }
    const fresh = () => call(limiter, { headers: { 'x-forwarded-for': '172.16.0.1' } });
    assert.equal(fresh().nexted, true, 'still under the global ceiling');
    assert.equal(fresh().nexted, false, 'the global ceiling catches it, not the per-caller map');
  });

  test('reads the address the platform sets, in order', () => {
    assert.equal(
      __testing.callerKey({ headers: { 'x-vercel-forwarded-for': '1.1.1.1', 'x-forwarded-for': '2.2.2.2' }, socket: {} }),
      '1.1.1.1'
    );
    assert.equal(
      __testing.callerKey({ headers: { 'x-forwarded-for': '2.2.2.2, 3.3.3.3' }, socket: {} }),
      '2.2.2.2',
      'the client is the first entry; the rest are proxies'
    );
    assert.equal(__testing.callerKey({ headers: { 'x-real-ip': '4.4.4.4' }, socket: {} }), '4.4.4.4');
    assert.equal(__testing.callerKey({ headers: {}, socket: { remoteAddress: '5.5.5.5' } }), '5.5.5.5');
  });
});

describe('sameOriginOnly', () => {
  const guard = sameOriginOnly(() => ['https://research.example']);

  test('accepts a request the browser says came from our own page', () => {
    assert.equal(call(guard, { headers: { 'sec-fetch-site': 'same-origin' } }).nexted, true);
    assert.equal(call(guard, { headers: { 'sec-fetch-site': 'same-site' } }).nexted, true);
  });

  test('refuses a cross-site form POST — the logout CSRF', () => {
    const refused = call(guard, { headers: { 'sec-fetch-site': 'cross-site' } });
    assert.equal(refused.nexted, false);
    assert.equal(refused.status, 403);
  });

  test("refuses 'none', which is a top-level navigation rather than our page", () => {
    assert.equal(call(guard, { headers: { 'sec-fetch-site': 'none' } }).status, 403);
  });

  test('falls back to Origin for browsers that omit Sec-Fetch-Site', () => {
    const self = { origin: 'https://diffusion.example', host: 'diffusion.example', 'x-forwarded-proto': 'https' };
    assert.equal(call(guard, { headers: self }).nexted, true);

    const foreign = { origin: 'https://evil.example', host: 'diffusion.example', 'x-forwarded-proto': 'https' };
    assert.equal(call(guard, { headers: foreign }).status, 403);

    const allowlisted = { origin: 'https://research.example', host: 'diffusion.example', 'x-forwarded-proto': 'https' };
    assert.equal(call(guard, { headers: allowlisted }).nexted, true, 'ALLOWED_ORIGINS still works');
  });

  test('lets curl through, which has no ambient cookie to abuse', () => {
    // Neither header: not a browser, so there is no session riding along and
    // nothing for CSRF to exploit. Refusing here would break command-line
    // access without closing anything.
    assert.equal(call(guard, { headers: {} }).nexted, true);
  });
});
