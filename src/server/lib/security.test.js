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
import { readdirSync, readFileSync } from 'node:fs';
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
  test('does not permit scripts from the un-hardened mirror cache', () => {
    const cacheOnly = executableInlineScripts(
      path.join(LANDING_DIR, '.mirror-cache'),
      { skipDotDirs: false }
    );
    assert.ok(cacheOnly.length > 0, 'expected the mirror cache to exist with inline script');

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
