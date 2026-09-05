/**
 * The Vercel entry point.
 *
 * Everything that decides how the application behaves lives in
 * `src/server/app.js`, and every host imports that same file — because the
 * alternative, which Vercel's own documentation encourages, is one function
 * per endpoint, and that would break this app.
 *
 * WHY ONE FUNCTION AND NOT ONE PER ROUTE
 *
 * The routes here are order-dependent in ways that are invisible if you look
 * at any single one:
 *
 *   /api/me      is registered BEFORE `app.use('/api', requireReader())`, so a
 *                signed-out reader can ask whether they are signed in. Move it
 *                after the gate and it 401s, and the client can never discover
 *                that sign-in exists.
 *   /healthz     sits outside the gate for the same reason — a health check
 *                that requires a session reports a healthy service as broken.
 *   /waitlist    is answered before `express.static`, or the static handler
 *                serves the retired page first.
 *
 * Split into files, that ordering becomes a property of a directory listing.
 * One app, one function, and the order is the order in the source.
 *
 * The cost is that a request for `/api/status` boots the module that also
 * defines the news routes. That module is a few hundred lines of route
 * definitions over a shared pool; it is not the cold start worth optimising.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS FILE IS NO LONGER THREE LINES: THE STATUS CODE FOR A SLUG THAT
 * DOES NOT EXIST
 *
 * Measured on production, 2026-09-04:
 *
 *     /q/does-not-exist   200   /lens/nope   200
 *     /data/9999          200   /simulate/nope 200
 *     /nonsense           404
 *
 * Unknown STATIC paths were handled correctly and unknown DYNAMIC ones were
 * not. The rewrite in `vercel.json` matches the SHAPE of the path, serves the
 * app shell, and the client then shows an error panel — so every link checker,
 * search engine and archive is told that a dead page is live, and a reader
 * following a stale link reaches a dead end with no redirect and nothing that
 * says the address was wrong.
 *
 * The decision has to be made HERE rather than in `app.js` alone, because on
 * Vercel the CDN rewrite fires before Express sees anything.
 *
 * HOW IT IS ORDERED, AND WHY THE FUNCTION IS THE FALLBACK AND NOT THE PATH
 *
 * `scripts/build-static.js` writes a prerendered shell per question, lens,
 * series and scenario, so every address that EXISTS at deploy time is a real
 * file and is served by the CDN without waking this function at all. What
 * reaches the resolver below is therefore an address that is either wrong —
 * answered 404 — or newer than the deploy, because seeds are applied to the
 * live database without a rebuild. That second case is why the resolver asks
 * the database rather than reading the list of files.
 *
 * It fails OPEN. A database that cannot be reached returns the shell with a
 * 200, exactly as before: "I cannot tell" must never be answered "gone".
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from '../src/server/app.js';
import { query } from '../src/server/db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The dynamic app routes, and what makes each one real.
 *
 * The conditions are copied from the API handlers that back these pages so the
 * shell and the data agree about existence — `getQuestion` and `getLens`
 * require `is_active`, `getScenario` requires `status = 'published'`, and
 * `/api/indicators/:id` looks the row up with no activity filter at all. A
 * resolver that were stricter than its API would 404 a page that renders.
 */
const DYNAMIC_ROUTES = [
  { prefix: '/q/', sql: 'SELECT 1 FROM questions WHERE slug = $1 AND is_active' },
  { prefix: '/lens/', sql: 'SELECT 1 FROM lenses WHERE slug = $1 AND is_active' },
  { prefix: '/data/', sql: 'SELECT 1 FROM indicators WHERE id = $1' },
  {
    prefix: '/simulate/',
    sql: "SELECT 1 FROM simulation_scenarios WHERE slug = $1 AND status = 'published'",
  },
];

/** The five lenses, for the page below. Chrome, not data — see NotFoundPage.jsx. */
const LENSES = [
  ['investment', 'Investment &amp; Capital'],
  ['growth', 'Growth &amp; Productivity'],
  ['labour', 'Labour Markets'],
  ['prices', 'Prices &amp; Markets'],
  ['regulation', 'Policy &amp; Regulation'],
];

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The 404 body.
 *
 * Written out here rather than served as the app shell on purpose. The reader
 * most likely to meet this page is following a link and has no session, and
 * the shell would bounce them through sign-in before it could tell them the
 * address was wrong. This says so immediately, needs no session and no
 * JavaScript, and still offers somewhere to go.
 *
 * No inline <script>: the CSP in vercel.json allows only the hashed scripts
 * found in the HTML at generation time, and one written here would be blocked
 * silently. Inline <style> is allowed.
 */
function notFoundPage(pathname) {
  const lenses = LENSES.map(
    ([slug, name]) => `<li><a href="/lens/${slug}">${name}</a></li>`
  ).join('');

  return `<!doctype html>
<html lang="en" class="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>There is no page at that address — Diffusion</title>
<meta name="description" content="This address does not match a question, a lens or a series on Diffusion.">
<meta name="robots" content="noindex">
<link rel="icon" href="/icon-180.png">
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 4rem 1.5rem; background: #010101; color: #f5f5f7;
         font: 400 16px/1.6 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  main { max-width: 40rem; margin: 0 auto; }
  p.eyebrow { margin: 0; color: #7da0ff; font-size: 0.75rem; letter-spacing: 0.08em;
              text-transform: uppercase; }
  h1 { margin: 0.75rem 0 0; font-size: clamp(1.75rem, 4vw, 2.5rem); line-height: 1.15;
       font-weight: 500; }
  code { display: inline-block; margin-top: 1rem; padding: 0.15rem 0.4rem; border-radius: 4px;
         background: #1a1a1c; color: #c9c9ce; word-break: break-all;
         font-family: ui-monospace, SFMono-Regular, monospace; font-size: 0.9rem; }
  p.lede { color: #a1a1a8; }
  h2 { margin: 2.5rem 0 0.5rem; font-size: 1rem; font-weight: 500; }
  ul { margin: 0; padding: 0; list-style: none; }
  li + li { margin-top: 0.25rem; }
  a { color: #f5f5f7; }
  a:hover { color: #7da0ff; }
</style>
</head>
<body>
<main>
  <p class="eyebrow">Not found</p>
  <h1>There is no page at that address</h1>
  <code>${escapeHtml(pathname)}</code>
  <p class="lede">Either the address was mistyped, or the page it points at has been
  renamed since the link was made. Nothing here has been deleted to hide it; the
  writing on this site is kept with its corrections attached.</p>
  <h2>The five lenses</h2>
  <ul>${lenses}</ul>
  <h2>Or start from</h2>
  <ul>
    <li><a href="/overview">The overview</a></li>
    <li><a href="/data">Every series, with its source</a></li>
  </ul>
</main>
</body>
</html>
`;
}

/**
 * The built app shell, for an address that is real but newer than the deploy.
 *
 * Read once, lazily, and remembered — including the failure, so a missing file
 * is not re-stat'd on every request. `public/index.html` reaches the function
 * bundle through `includeFiles` in vercel.json; nothing traces it, because
 * nothing imports it.
 */
let shellCache;
function appShell() {
  if (shellCache === undefined) {
    try {
      shellCache = readFileSync(path.resolve(here, '../public/index.html'), 'utf8');
    } catch (error) {
      console.error('[404-resolver] app shell unreadable, falling through to Express', error);
      shellCache = null;
    }
  }
  return shellCache;
}

/** `/q/entry-level` → `{ route, slug }`; anything else, including `/q/a/b`, → null. */
function dynamicTarget(pathname) {
  for (const route of DYNAMIC_ROUTES) {
    if (!pathname.startsWith(route.prefix)) continue;
    const rest = pathname.slice(route.prefix.length);
    if (rest === '' || rest.includes('/')) return null;
    try {
      return { route, slug: decodeURIComponent(rest) };
    } catch {
      // A malformed escape cannot name a row, so it names nothing.
      return { route, slug: null };
    }
  }
  return null;
}

export default async function handler(req, res) {
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
  const target = dynamicTarget(pathname);

  if (!target) return app(req, res);

  let exists;
  try {
    exists = target.slug !== null && (await query(target.route.sql, [target.slug])).rows.length > 0;
  } catch (error) {
    // Fail open. An unreachable database is not evidence that a page is gone.
    console.error('[404-resolver] lookup failed, serving the shell', error);
    return app(req, res);
  }

  if (!exists) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(notFoundPage(pathname));
  }

  const shell = appShell();
  if (shell === null) return app(req, res);

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.end(shell);
}

/* Exported so the resolution rules can be exercised on their own, without the
   request plumbing around them. */
export { dynamicTarget, DYNAMIC_ROUTES };
