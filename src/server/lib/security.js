/**
 * Response security headers, inbound rate limiting, and the same-origin guard.
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
  return [...hashes].sort();
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

/**
 * WHO IS ASKING, FOR RATE-LIMITING PURPOSES.
 *
 * `req.ip` is not used because it needs `trust proxy`, and turning that on
 * makes Express believe any `X-Forwarded-For` a caller sends. Vercel overwrites
 * `x-forwarded-for` with the real client address at the edge and also sets
 * `x-vercel-forwarded-for`, so the platform headers are preferred and the
 * socket address is the fallback for `npm start` on a plain host.
 *
 * THE HONEST LIMIT OF THIS
 *
 * Behind a proxy that does NOT rewrite the header, a caller can put anything in
 * `X-Forwarded-For` and get a fresh bucket per request. That makes this a brake
 * on casual abuse and on an accidental client loop, not a defence against a
 * determined attacker — the real answer there is a firewall rule at the edge,
 * outside this process. A forged address only ever creates a NEW per-caller
 * bucket; it never fills someone else's.
 *
 * That last point used to be written here as "what it cannot do is lock a real
 * reader out", and that is only true of the per-caller half. The global ceiling
 * below is what actually bounds database writes, and it is immune to the header
 * — but it is shared, so spending it does lock real readers out. Measured, on
 * the /auth limiter: 60 forged addresses exhausted `globalMax: 60` and the next
 * previously-unseen caller was refused. See the note on MAX_TRACKED_CALLERS.
 */
function callerKey(req) {
  const forwarded = req.headers['x-vercel-forwarded-for'] ?? req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  const real = req.headers['x-real-ip'];
  if (typeof real === 'string' && real.length > 0) return real;
  return req.socket?.remoteAddress ?? 'unknown';
}

/**
 * How many distinct callers are tracked per window before per-caller counting
 * stops and everyone shares the global ceiling.
 *
 * A Map keyed on a value the caller controls is itself a memory-exhaustion
 * target, so it needs a ceiling. What happens PAST that ceiling is written out
 * below rather than summarised, because the sentence that used to sit here —
 * "the limiter does not fail open and does not start refusing real readers: it
 * falls back to the global counter, which is the one number an attacker cannot
 * spend around" — is wrong on all three counts, and it is the kind of wrong
 * that reads as reassurance.
 *
 * A caller past the ceiling gets `count = 0`, which is never `> max`. So the
 * per-caller limit is the only thing that stops applying, and what is left
 * depends entirely on whether this limiter was given a `globalMax`:
 *
 *   WITH one (the /auth limiter, globalMax 60)
 *     The global counter does bind. But it is spendable: every request
 *     increments `globalHits`, forged addresses included, so an attacker
 *     reaches the ceiling and then EVERYONE meets the 429 — a real reader
 *     arriving next is refused. Measured: 60 forged addresses exhausted
 *     globalMax=60 in a fresh window and the next previously-unseen caller got
 *     429. That is a denial-of-service ceiling on sign-in, and it is the
 *     deliberate trade — bounding rows written to `readers` matters more than
 *     keeping sign-in available under attack — but it is a trade, not an
 *     absence of one.
 *
 *   WITHOUT one (the /api limiter, which takes the `globalMax = Infinity`
 *   default because reads write nothing and a shared ceiling on reads would let
 *   one caller degrade the site for everybody)
 *     There is no counter to fall back to, and the limiter DOES fail open for
 *     that caller. Measured: after 5000 distinct forged `X-Forwarded-For`
 *     values filled the Map, one further address sent 5000 requests against
 *     `max: 240` and all 5000 were passed through.
 *
 * Neither is a reason to change the limiter here — filling the Map already
 * requires 5000 forged addresses inside one window, and behind Vercel the
 * header is rewritten at the edge so they cannot be forged at all. It is a
 * reason not to read this constant as a guarantee. The real answer for a
 * determined attacker is a rule at the edge, as the note on `callerKey` says.
 */
const MAX_TRACKED_CALLERS = 5000;

/**
 * A fixed-window rate limiter, in memory.
 *
 * WHY IN MEMORY, AND WHAT THAT COSTS
 *
 * Nothing here can add a Redis. On a long-lived host this is exact. On Vercel
 * each function instance has its own counters, so the effective limit is
 * `max × instances` — looser than it reads, and still several orders of
 * magnitude tighter than the nothing that was here before. Stated rather than
 * discovered: a limiter whose real ceiling is unclear is worse than one whose
 * arithmetic is written down.
 *
 * FIXED WINDOW RATHER THAN A TOKEN BUCKET
 *
 * A token bucket needs a timestamp per caller and a refill calculation; a fixed
 * window needs a counter and one `Map.clear()` when the window rolls. The
 * classic objection — twice the allowance across a window boundary — does not
 * matter for a limit that exists to stop a loop, and the cleared Map is what
 * bounds memory without a sweep timer.
 *
 * @param {object} options
 * @param {number} options.windowMs      length of the window
 * @param {number} options.max           requests per caller per window
 * @param {number} [options.globalMax]   requests from ALL callers per window;
 *                                       omit where there is no write to bound
 * @param {string} [options.message]     body text for the 429
 */
export function rateLimit({ windowMs, max, globalMax = Infinity, message = 'Too many requests' }) {
  let windowStart = Date.now();
  let hits = new Map();
  let globalHits = 0;

  return function applyRateLimit(req, res, next) {
    const now = Date.now();
    if (now - windowStart >= windowMs) {
      windowStart = now;
      hits = new Map();
      globalHits = 0;
    }

    globalHits += 1;

    const key = callerKey(req);
    const tracked = hits.has(key) || hits.size < MAX_TRACKED_CALLERS;
    const count = tracked ? (hits.get(key) ?? 0) + 1 : 0;
    if (tracked) hits.set(key, count);

    if (count > max || globalHits > globalMax) {
      const retryAfter = Math.ceil((windowStart + windowMs - now) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfter, 1)));
      // Never cached: a 429 is about this caller at this second, and a shared
      // cache holding one would refuse everybody behind it.
      res.setHeader('Cache-Control', 'no-store');
      return res.status(429).json({ error: message });
    }

    return next();
  };
}

/**
 * Refuse a state-changing POST that a browser started on somebody else's page.
 *
 * WHAT THIS IS FOR
 *
 * `POST /auth/logout` takes no body, no token and no state, so a form on any
 * site could sign a reader out. That is a nuisance rather than a breach. The
 * reason it is worth closing is the neighbouring route: forced LOGIN — landing
 * a victim in an attacker's account — is blocked today only by two accidents.
 * `express.json` parses `application/json` and a plain cross-site form cannot
 * send that, and the CORS allowlist refuses the preflight a `fetch` would need.
 * Adding `express.urlencoded` for any reason, or widening ALLOWED_ORIGINS so
 * researchers can query the API — which this project states as a goal — removes
 * one of them. Neither accident is a decision, so this is the decision.
 *
 * HOW IT DECIDES, IN ORDER
 *
 *   Sec-Fetch-Site present   the browser is telling us where the request came
 *                            from and cannot be talked out of it: same-origin
 *                            and same-site pass, cross-site and none do not.
 *                            Sent by every Chrome since 76, Firefox since 90
 *                            and Safari since 16.4.
 *
 *   Origin present           the fallback for older Safari, which omits
 *                            Sec-Fetch-Site but does send Origin on a POST.
 *                            It must match this deployment's own origin or sit
 *                            in the CORS allowlist.
 *
 *   neither                  allowed. That is `curl` and server-to-server,
 *                            which is not a browser and therefore has no
 *                            ambient cookie to ride on — the whole mechanism
 *                            CSRF depends on. Refusing here would break the
 *                            command-line access the project intends without
 *                            closing anything.
 *
 * @param {() => string[]} allowedOrigins  read lazily, so config changes apply
 */
export function sameOriginOnly(allowedOrigins) {
  return function requireSameOrigin(req, res, next) {
    const site = req.headers['sec-fetch-site'];
    if (typeof site === 'string') {
      if (site === 'same-origin' || site === 'same-site') return next();
      return res.status(403).json({ error: 'Cross-site request refused' });
    }

    const origin = req.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      const proto = req.headers['x-forwarded-proto'] ?? req.protocol;
      const self = `${proto}://${req.get('host')}`;
      if (origin === self || allowedOrigins().includes(origin)) return next();
      return res.status(403).json({ error: 'Cross-site request refused' });
    }

    return next();
  };
}

export const __testing = { callerKey, MAX_TRACKED_CALLERS };
