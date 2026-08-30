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
 * index.html carries one inline script: the theme is applied before first
 * paint, because reading localStorage from React would flash the wrong theme
 * on every load. An inline script needs either 'unsafe-inline' — which defeats
 * the point of a script CSP — or a hash of its exact bytes.
 *
 * A hash pasted into source drifts the moment anyone edits that script, and it
 * fails silently: the CSP blocks the script, the theme flashes, and nothing
 * reports an error. So the hash is computed at boot from the file actually
 * being served. It cannot disagree with reality.
 *
 * WHAT IS DELIBERATELY PERMISSIVE
 *
 * style-src keeps 'unsafe-inline'. Recharts renders through React's `style`
 * prop, so every chart element carries a style attribute; blocking those does
 * not harden anything meaningful here and does break every chart. Inline style
 * is a far weaker vector than inline script, and script is locked down.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Hashes of every inline <script> in the served index.html, as CSP sources. */
function inlineScriptHashes(publicDir) {
  let html;
  try {
    html = readFileSync(path.join(publicDir, 'index.html'), 'utf8');
  } catch {
    // No build yet. The SPA cannot be served either, so there is nothing to
    // protect — return empty rather than crashing the process on boot.
    return [];
  }

  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(([, body]) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`);
}

export function securityHeaders({ publicDir, isProduction }) {
  const scriptHashes = inlineScriptHashes(publicDir).join(' ');

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
