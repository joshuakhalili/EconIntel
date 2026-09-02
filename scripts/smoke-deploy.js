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
 * declares, that the API is reachable and talking to Postgres, that the build
 * pipeline is not being served to the public — and that the build answering
 * is the one that just shipped, which is the only assertion here that a stale
 * production alias cannot satisfy.
 *
 *     node scripts/smoke-deploy.js https://…vercel.app
 *     node scripts/smoke-deploy.js http://localhost:3000
 *
 * On a protected Vercel preview, pass a bypass token:
 *     VERCEL_BYPASS=<token> node scripts/smoke-deploy.js <url>
 *
 * To assert WHICH commit is live, pass the SHA that was expected to ship.
 * Without it the comparison reports itself skipped rather than passing:
 *     EXPECT_COMMIT=<sha> node scripts/smoke-deploy.js <url>
 */

import { APP_ROUTES } from './vercel-config.js';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

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

/*
 * A third state, because two are not enough for the commit check below.
 *
 * That check cannot always run — a build outside CI has no SHA to report, and
 * a scheduled run has no deploy to compare against — and both of the states
 * this file had would lie about it. Failing would go red for a condition that
 * is not a fault; passing would put a tick next to a comparison that never
 * happened, which is the exact disease the rest of this file is being treated
 * for. A skip that prints its reason is the only honest third answer.
 *
 * Skips do not count towards the failure total, and they are counted out of
 * the pass total at the bottom so "N checks passed" stays a true statement
 * about assertions that actually ran.
 */
const skip = (name, reason) => {
  results.push({ name, ok: true, skipped: true, detail: reason });
  console.log(`  ${YELLOW}–${RESET} ${name} ${DIM}SKIPPED: ${reason}${RESET}`);
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

/*
 * ── WHICH BUILD IS ANSWERING ────────────────────────────────────────────────
 *
 * Every other check in this file would pass identically against a deploy from
 * last week. That is not hypothetical here: smoke.yml deliberately targets the
 * stable production alias rather than the immutable per-deployment URL, and
 * says so — Vercel marks a deployment ready and assigns aliases a moment
 * later, so there is a window in which this suite tests the PREVIOUS version
 * and reports green. The 20-second settle wait narrows that window; it cannot
 * close it.
 *
 * `/healthz` carries the git SHA of the build that is answering, and the
 * workflow passes in the SHA it expected to ship as EXPECT_COMMIT. Comparing
 * the two is the only assertion in this file capable of telling today's deploy
 * from a stale alias, and a mismatch is a real finding rather than noise: it
 * means the address readers use is not serving the commit that just built.
 *
 * The field being absent is a failure — it is meant to be there, and a
 * /healthz that has stopped reporting it has lost the only thing that dates a
 * deploy. A null value is a skip: the build genuinely may not know its own SHA
 * when it was run locally or built outside CI. A missing EXPECT_COMMIT is a
 * skip for the same reason — it is the normal state of the daily scheduled
 * run, which carries no deployment context at all.
 */
const hasCommitField = Object.hasOwn(healthJson, 'commit');
const deployedCommit = healthJson.commit;
check(
  '/healthz reports a commit',
  health.status === 200 && hasCommitField,
  // Absent and null are worth telling apart in the log: one is a /healthz that
  // has lost the field, the other is a build that did not know its own SHA.
  !hasCommitField ? 'field missing' : deployedCommit == null ? 'field null' : String(deployedCommit).slice(0, 7)
);

// Trimmed because a shell heredoc or a `${{ }}` substitution that resolves to
// nothing leaves whitespace, not an empty string, and ' ' is truthy.
const expectedCommit = (process.env.EXPECT_COMMIT ?? '').trim();
if (deployedCommit == null) {
  skip('deployed commit matches the build', 'the deployment did not report a commit');
} else if (!expectedCommit) {
  skip('deployed commit matches the build', 'no EXPECT_COMMIT — nothing to compare against');
} else {
  // Compared by prefix, case-insensitively: one side may be a short SHA. Seven
  // characters is git's own abbreviation floor, and refusing to compare below
  // it stops a truncated or placeholder value matching everything.
  const a = String(deployedCommit).toLowerCase();
  const b = expectedCommit.toLowerCase();
  const n = Math.min(a.length, b.length);
  check(
    'deployed commit matches the build',
    n >= 7 && a.slice(0, n) === b.slice(0, n),
    `serving ${a.slice(0, 7)}, expected ${b.slice(0, 7)}`
  );
}

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
/*
 * WHAT COUNTS AS THE APP SHELL, AND WHY THE OLD TEST DID NOT
 *
 * This asserted `status === 200 && !/not found/i.test(title)`, which is a test
 * that the title is not the 404 page's title. The landing page's title is not
 * the 404 page's title either — and it is not merely similar, it is byte-for-
 * byte the app shell's own:
 *
 *   dist/app.html    <title>Diffusion — Is AI changing the economy?</title>
 *   dist/index.html  <title>Diffusion — Is AI changing the economy?</title>
 *   dist/404.html    <title>Page not found — Diffusion</title>
 *
 * So the failure this whole file was written for — every app route serving the
 * landing page instead of the SPA — passed green in every form except the one
 * where the CDN happened to route to the 404 page. Half the bug was invisible
 * to its own regression test.
 *
 * Counted in the built output before picking a marker:
 *
 *                    id="root"   skip-link   data-framer-
 *   dist/app.html        1           1            0
 *   dist/index.html      0           0          582
 *   dist/404.html        0           0          197
 *
 * Hence both halves below. `#root` alone is a generic Vite mount point and
 * would start passing the day a landing rebuild happened to contain one;
 * "not Framer" alone passes on an empty body, a JSON error, or a plain-text
 * gateway page. Together they say: React has somewhere to mount, and the
 * Framer-built marketing site is not what came back.
 */
const APP_MOUNT = /<div[^>]+id=["']root["']/i;
const FRAMER_MARKUP = /data-framer-/i;
for (const route of APP_ROUTES) {
  // `:slug` is a pattern; substitute something real so the CDN matches it.
  const path = route
    .replace(':slug', route.startsWith('/lens') ? 'investment' : 'adoption')
    .replace(':id', 'fred.GDPC1');
  const page = await get(path);
  const t = title(page.body);
  const servedFramer = FRAMER_MARKUP.test(page.body);
  const isShell = page.status === 200
    && APP_MOUNT.test(page.body)
    && !servedFramer
    // Kept from the original assertion rather than replaced by it: a 404 title
    // on a 200 shell would still be a fault worth seeing.
    && !/not found/i.test(t);
  check(
    `${path} serves the app`,
    isShell,
    isShell
      ? t
      : `${t || `status ${page.status}`} — ${servedFramer ? 'served the landing page' : 'no #root mount point'}`
  );
}

// ── Retired and internal paths ──────────────────────────────────────────────
const waitlist = await get('/waitlist');
check(
  '/waitlist redirects to /login',
  [301, 302, 307, 308].includes(waitlist.status) && /\/login/.test(waitlist.location ?? ''),
  `${waitlist.status} → ${waitlist.location ?? 'nowhere'}`
);

/*
 * A 404 is fine; serving the file is not. The landing 404 page returns 200 on
 * some hosts, so each test below is on CONTENT rather than status alone.
 *
 * WHY THERE IS NOW ONE RULE PER PATH
 *
 * There used to be a single predicate for all three:
 *
 *   /^\s*(import |#!|def |from )/m.test(body)
 *     || /framer\.com/i.test(body) === false && body.includes('mirror')
 *
 * `&&` binds tighter than `||`, so JavaScript parses that as `a || (b && c)`,
 * not `(a || b) && c`. The grouping barely mattered, because the third path
 * could not trip either branch in any case. `/.mirror-cache/pages/index.html`
 * is the un-hardened Framer mirror — the source template, with the template
 * author's text, served off our own domain. Leaked, it returns Framer HTML,
 * so `/framer\.com/` matches, so `b` is false and the whole second clause
 * dies; and Framer HTML matches no Python-source regex, so `a` is false too.
 * The check could only ever catch the two .py files. It has never once been
 * able to fire on the path it was mainly there for.
 *
 * So: explicit parentheses, and a rule chosen for what each path would
 * actually return if it leaked.
 */

// Python source, at the start of a line. Verified not to match any HTML this
// site serves: zero hits against dist/index.html, dist/404.html and
// dist/app.html, so the landing 404 body these paths normally return cannot
// trip it.
const PYTHON_SOURCE = /^\s*(import |#!|def |from )/m;

/*
 * The mirror cache holds the pages exactly as they came off
 * https://atmos-system.framer.website (dist/clone.json), before hardening.
 * Hardening's main job is rewriting every absolute Framer asset URL — images,
 * fonts, JS modules, all of which a published Framer page loads from
 * framerusercontent.com — down to a local /assets path. The shipped pages
 * therefore contain none of these hosts: grep counts zero occurrences of
 * framerusercontent.com, .framer.website and .framer.app across
 * dist/index.html and dist/404.html.
 *
 * That contrast is the whole signal. `data-framer-*` attribute names survive
 * hardening and appear in their hundreds on the pages we serve on purpose, so
 * they say nothing. An absolute URL pointing back at Framer's own hosts is
 * something only an un-hardened page carries, which makes it the one marker
 * that separates "the cache leaked" from "the 404 page answered".
 */
const UNHARDENED_MIRROR = /framerusercontent\.com|\.framer\.(?:website|app)/i;

const PRIVATE_PATHS = [
  { path: '/docs/mirror.py', leaked: (body) => PYTHON_SOURCE.test(body) },
  { path: '/docs/build-diffusion.py', leaked: (body) => PYTHON_SOURCE.test(body) },
  { path: '/.mirror-cache/pages/index.html', leaked: (body) => UNHARDENED_MIRROR.test(body) },
];

for (const { path: secret, leaked: isLeak } of PRIVATE_PATHS) {
  let page = await get(secret);
  /*
   * Follow one hop, because these rules read the BODY and a redirect has none.
   *
   * Live, `/.mirror-cache/pages/index.html` answers 308 — `cleanUrls: true`
   * strips the `.html` and bounces the request. `get()` is deliberately
   * `redirect: 'manual'` (the /waitlist check above needs the Location header),
   * so the body was empty and the rule had nothing to look at: a second way
   * this check could not fire, on the same path as the first. Following the
   * hop tests what a browser asking for that URL would actually receive.
   *
   * One hop only, and only when there is somewhere to go. A redirect chain
   * here would itself be worth noticing rather than chasing.
   */
  const hops = [];
  if ([301, 302, 307, 308].includes(page.status) && page.location) {
    hops.push(`${page.status} → ${page.location}`);
    page = await get(new URL(page.location, `${base}/`).pathname);
  }
  check(
    `${secret} is not served`,
    !isLeak(page.body),
    [...hops, `status ${page.status}`].join(', ')
  );
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
const skipped = results.filter((r) => r.skipped);
const tail = skipped.length ? `, ${skipped.length} skipped` : '';
console.log(
  failed.length === 0
    ? `\n${GREEN}✓ ${results.length - skipped.length} checks passed${RESET}${skipped.length ? `${DIM}${tail}${RESET}` : ''}`
    : `\n${RED}✗ ${failed.length} of ${results.length - skipped.length} failed${RESET}${skipped.length ? `${DIM}${tail}${RESET}` : ''}`
);
process.exit(failed.length === 0 ? 0 : 1);
