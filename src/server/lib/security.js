/**
 * Response security headers.
 *
 * WHY THIS EXISTS
 *
 * This dashboard is public, open-source, and links out to several hundred
 * third-party sources. That combination makes a handful of headers worth more
 * than they cost:
 *
 *   - Referrer-Policy, because every outbound click on a news item would
 *     otherwise hand the destination the full URL the reader came from.
 *   - X-Content-Type-Options, because the app serves user-supplied-ish content
 *     (RSS headlines) and MIME sniffing turns a mislabelled response into a
 *     script execution.
 *   - frame-ancestors, because a dashboard of economic claims is exactly the
 *     sort of thing worth framing inside someone else's page and passing off
 *     as their own.
 *   - HSTS in production only, since local development is plain http and
 *     pinning localhost to https breaks it for months.
 *
 * WHY THE CSP HASH IS COMPUTED, NOT WRITTEN DOWN
 *
 * An inline script needs either 'unsafe-inline' — which defeats the point of a
 * script CSP — or a hash of its exact bytes. A hash pasted into source drifts
 * the moment anyone edits that script, and it fails silently: the CSP blocks
 * the script and nothing reports an error to the server. So the hashes are
 * computed at boot from the files actually being served, and cannot disagree
 * with reality.
 *
 * THIS SCANS THE LANDING PAGE TOO, AND THAT WAS NOT ALWAYS TRUE
 *
 * It read only `public/index.html` until 2026-08-30. That file is Vite output
 * and carries a single `<script src>`, so the scan returned nothing, the CSP
 * went out as a bare `script-src 'self'` — and it was applied to EVERY
 * response, including the Framer landing page, which carries seven executable
 * inline scripts totalling ~20 kB.
 *
 * Every one of them was blocked, in every environment, from the day the CSP
 * shipped. That included `animator`, the entrance-animation engine for the
 * whole front door. Proven rather than assumed: the scripts were present in
 * the DOM while `window.animator` and `window.process` — top-level globals set
 * by two different inline scripts — were both `undefined`.
 *
 * Nothing caught it because a blocked inline script reports to the browser
 * console and never to the server, and the page still renders: it just sits
 * there in its pre-animation state, which looks like a design choice.
 *
 * So the scan takes a LIST of roots and walks each for .html. If a root does
 * not exist it is skipped, which is what keeps this working before the first
 * `npm run build`.
 *
 * NON-EXECUTABLE SCRIPT TYPES ARE SKIPPED ON PURPOSE
 *
 * Framer stores its animation keyframes and CMS handover data in
 * `<script type="framer/appear">` and `<script type="framer/handover">`. A
 * browser does not execute an unknown script type, so CSP never evaluates them
 * and a hash for one is pure header weight — and these are the two biggest
 * blocks on the page. Only types a browser will actually run are hashed.
 *
 * WHAT IS DELIBERATELY PERMISSIVE
 *
 * style-src keeps 'unsafe-inline'. Recharts renders through React's `style`
 * prop, so every chart element carries a style attribute; blocking those does
 * not harden anything meaningful here and does break every chart. Inline style
 * is a far weaker vector than inline script, and script is locked down.
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** Script types a browser will actually execute. Anything else is a data block. */
const EXECUTABLE_TYPES = new Set([
  '',
  'text/javascript',
  'application/javascript',
  'module',
]);

/**
 * Every .html under `root`, recursively. Missing roots yield nothing.
 *
 * Dot-directories are skipped, and that is a security property rather than
 * tidiness: `landing/.mirror-cache/pages/` holds the ORIGINAL Framer template
 * as downloaded, before the content map and the hardening pass ran. Its inline
 * scripts differ slightly from the shipped ones, so scanning it added three
 * hashes that allowlist bodies no served page uses — a CSP allowlist should
 * contain exactly what is served and nothing else.
 */
function htmlFilesUnder(root) {
  let entries;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    if (entry.name.startsWith('.')) return [];
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return htmlFilesUnder(full);
    return entry.isFile() && entry.name.endsWith('.html') ? [full] : [];
  });
}

/**
 * CSP `sha256-` sources for every executable inline script across `roots`.
 *
 * Deduplicated: the landing page's eight HTML files share most of their inline
 * scripts, so the raw list is 38 entries for 7 distinct bodies.
 */
export function inlineScriptHashes(roots) {
  const tag = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g;
  const typeAttr = /\btype\s*=\s*["']?([^"'\s>]+)/;
  const hashes = new Set();

  for (const root of roots) {
    for (const file of htmlFilesUnder(root)) {
      let html;
      try {
        html = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const [, attrs, body] of html.matchAll(tag)) {
        const declared = (typeAttr.exec(attrs)?.[1] ?? '').toLowerCase();
        if (!EXECUTABLE_TYPES.has(declared)) continue;
        hashes.add(
          `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`
        );
      }
    }
  }
  return [...hashes];
}

export function securityHeaders({ publicDir, landingDir, isProduction }) {
  const roots = [publicDir, landingDir].filter(Boolean);
  const scriptHashes = inlineScriptHashes(roots).join(' ');

  const csp = [
    "default-src 'self'",
    `script-src 'self' ${scriptHashes}`.trim(),
    // Google Fonts serves the stylesheet from googleapis and the font files
    // from gstatic; both are needed or the whole type ramp falls back.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // data: covers the inline SVG favicon.
    // GitHub avatars, for the signed-in reader in the nav. Nothing else
    // external is permitted — a wildcard here is how a tracking pixel gets in.
    "img-src 'self' data: https://avatars.githubusercontent.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return function applySecurityHeaders(_req, res, next) {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Nothing here uses these, and naming them is what stops a future
    // dependency quietly asking a reader for their location or camera.
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()'
    );
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}
