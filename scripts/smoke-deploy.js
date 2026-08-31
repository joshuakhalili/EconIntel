/**
 * Check a DEPLOYED url actually serves what it should.
 *
 * WHY THIS EXISTS
 *
 * Two deploys in a row went out with every local gate green — 106 tests,
 * tokens, contrast, routes, vercel config, a clean production build — and
 * were broken in ways no local check could see:
 *
 *   1. A syntax error in `app.js`, because nothing imported it. Fixed, and
 *      `app.test.js` now guards it.
 *   2. Every app route returning the landing page's 404, because
 *      `cleanUrls: true` strips `.html` and the rewrites pointed at
 *      `/app.html`. The build was green, the function was healthy, the
 *      database was connected, and `/overview` said "Page not found".
 *
 * The second could not have been caught locally at all. Express resolves
 * those paths with a catch-all; the CDN resolves them with a rewrite table.
 * They are different systems, and only one of them is what readers get.
 *
 * So this asserts the things that are only true of a deployment: that the
 * landing page owns `/`, that the app shell answers every route the router
 * declares, that the API is reachable and talking to Postgres, and that the
 * build pipeline is not being served to the public.
 *
 *     node scripts/smoke-deploy.js https://…vercel.app
 *     node scripts/smoke-deploy.js http://localhost:3000
 *
 * On a protected Vercel preview, pass a bypass token:
 *     VERCEL_BYPASS=<token> node scripts/smoke-deploy.js <url>
 */

import { APP_ROUTES } from './vercel-config.js';

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const RESET = '[0m';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!base) {
  console.error('usage: node scripts/smoke-deploy.js <base-url>');
  process.exit(2);
}

const headers = process.env.VERCEL_BYPASS
  ? { 'x-vercel-protection-bypass': process.env.VERCEL_BYPASS }
  : {};

async function get(path) {
  const response = await fetch(`${base}${path}`, {
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  });
  const body = response.status < 400 || response.status === 404 ? await response.text() : '';
  return { status: response.status, body, location: response.headers.get('location') };
}

const title = (html) => (/<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? '').trim();

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`} ${name}${detail ? ` ${DIM}${detail}${RESET}` : ''}`);
};

console.log(`${DIM}${base}${RESET}\n`);

// ── The API, and whether it can reach the database ──────────────────────────
const health = await get('/healthz');
let healthJson = {};
try { healthJson = JSON.parse(health.body); } catch { /* not json */ }
check(
  'healthz reaches Postgres',
  health.status === 200 && healthJson.database === 'connected',
  healthJson.latencyMs != null ? `${healthJson.latencyMs}ms` : `status ${health.status}`
);

// `/api/me` must answer while signed OUT — it is how the client discovers that
// sign-in exists at all, which is why it is registered before the auth gate.
const me = await get('/api/me');
check('/api/me answers signed out', me.status === 200, `status ${me.status}`);

// ── The landing page owns the front door ────────────────────────────────────
const root = await get('/');
check(
  'landing page serves /',
  root.status === 200 && /framer/i.test(root.body),
  title(root.body)
);

// ── Every app route resolves to the shell, not to a 404 ─────────────────────
// This is the one that only a deployment can prove.
for (const route of APP_ROUTES) {
  // `:slug` is a pattern; substitute something real so the CDN matches it.
  const path = route
    .replace(':slug', route.startsWith('/lens') ? 'investment' : 'adoption')
    .replace(':id', 'fred.GDPC1');
  const page = await get(path);
  const t = title(page.body);
  const isShell = page.status === 200 && !/not found/i.test(t);
  check(`${path} serves the app`, isShell, t || `status ${page.status}`);
}

// ── Retired and internal paths ──────────────────────────────────────────────
const waitlist = await get('/waitlist');
check(
  '/waitlist redirects to /login',
  [301, 302, 307, 308].includes(waitlist.status) && /\/login/.test(waitlist.location ?? ''),
  `${waitlist.status} → ${waitlist.location ?? 'nowhere'}`
);

for (const secret of ['/docs/mirror.py', '/docs/build-diffusion.py', '/.mirror-cache/pages/index.html']) {
  const page = await get(secret);
  // A 404 is fine; serving the file is not. The landing 404 page returns 200
  // on some hosts, so the test is on CONTENT rather than status alone.
  const leaked = /^\s*(import |#!|def |from )/m.test(page.body) || /framer\.com/i.test(page.body) === false && page.body.includes('mirror');
  check(`${secret} is not served`, !leaked, `status ${page.status}`);
}

// ── Security headers, which only exist on the real host ─────────────────────
const headed = await fetch(`${base}/`, { headers, signal: AbortSignal.timeout(20_000) });
const csp = headed.headers.get('content-security-policy') ?? '';
check('CSP present on the landing page', csp.includes("script-src"), '');
check(
  'CSP permits the landing page inline scripts',
  (csp.match(/sha256-/g) ?? []).length >= 7,
  `${(csp.match(/sha256-/g) ?? []).length} hashes`
);

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length === 0
    ? `\n${GREEN}✓ ${results.length} checks passed${RESET}`
    : `\n${RED}✗ ${failed.length} of ${results.length} failed${RESET}`
);
process.exit(failed.length === 0 ? 0 : 1);
