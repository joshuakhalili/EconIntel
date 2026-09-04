/**
 * The app's route table and the deploy's rewrite list must agree.
 *
 * On Express, an unknown path falls through to a catch-all that hands back the
 * React shell, so adding a route to `App.jsx` is enough — deep links work
 * immediately. On Vercel there is no catch-all, because `/` belongs to the
 * landing page and a catch-all would take it. Every app route is named
 * explicitly in `vercel.json`.
 *
 * That difference is a trap: add a route, test it locally, ship it, and the
 * deep link 404s in production while working perfectly on your machine. The
 * failure appears only on a hard load or a refresh — click through from inside
 * the app and the client router handles it, so the route looks fine right up
 * until someone shares the URL.
 *
 * So this compares the two lists and fails when they diverge.
 *
 *     node scripts/check-routes.js
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_ROUTES } from './vercel-config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_JSX = path.join(ROOT, 'src/client/App.jsx');

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const RESET = '[0m';

const source = readFileSync(APP_JSX, 'utf8');

/*
 * Read the paths straight out of the router literal. Deliberately a regex over
 * source rather than an import: importing App.jsx pulls in React, every route
 * component and the whole client bundle, which a build gate has no business
 * doing.
 *
 * ALL THREE QUOTE STYLES, and that is not decoration.
 *
 * This matched `'([^']+)'` — single quotes only — for its whole life, which
 * meant the one thing it exists to catch was invisible to it in the form it is
 * most likely to arrive in. A route written `{ path: "methodology" }` was not
 * read out of App.jsx at all, so it could not be compared against the rewrite
 * list, so the gate printed a tick and the deep link 404d in production.
 * Verified: with a double-quoted route inserted, the old regex still reported
 * `✓ every app route has a deploy rewrite (10 routes)`.
 *
 * Which quote a route is written with is a formatting accident — a paste, a
 * different editor, a Prettier config — not a decision anyone makes, so a gate
 * that depends on it is a gate that fails at random.
 *
 * The capture group is back-referenced so the closing quote must match the
 * opening one; a template literal carrying `${…}` is captured verbatim and
 * will not match any rewrite, which fails the gate loudly rather than
 * silently ignoring a route nobody can resolve statically.
 */
const declared = [...source.matchAll(/\bpath:\s*(['"`])([^'"`\n]+)\1/g)]
  .map(([, , value]) => value)
  // `*` is the client-side not-found redirect. It cannot be a rewrite: naming
  // it would claim every path on the domain, landing page included.
  //
  // `/` is the AppShell layout route. Its `index: true` child renders the
  // overview, but only ever after a client-side navigation — on a hard load `/`
  // is the landing page, served static, and the React app is not running. That
  // is why `/overview` exists as a second path for the same component, and it
  // is the one that needs a rewrite. Claiming `/` here would hand the front
  // door to the app shell.
  .filter((value) => value !== '*' && value !== '/')
  // Nested route paths are relative; the deploy needs them absolute.
  .map((value) => (value.startsWith('/') ? value : `/${value}`))
  // React Router writes `:slug`; Vercel's matcher uses the same syntax.
  .sort();

const configured = [...APP_ROUTES].sort();

const missing = declared.filter((r) => !configured.includes(r));
const extra = configured.filter((r) => !declared.includes(r));

if (missing.length === 0 && extra.length === 0) {
  console.log(
    `${GREEN}✓${RESET} every app route has a deploy rewrite ` +
      `${DIM}(${declared.length} routes)${RESET}`
  );
  process.exit(0);
}

console.error(`\n${RED}✗ App.jsx and vercel.json disagree about routes${RESET}`);
if (missing.length > 0) {
  console.error(
    `\n  in App.jsx but NOT in vercel.json — these will 404 on a hard load ` +
      `in production:\n    ${missing.join('\n    ')}`
  );
}
if (extra.length > 0) {
  console.error(
    `\n  in vercel.json but NOT in App.jsx — these serve the shell, which then ` +
      `redirects to the landing page:\n    ${extra.join('\n    ')}`
  );
}
console.error(
  `\n${DIM}Fix APP_ROUTES in scripts/vercel-config.js, then run ` +
    `node scripts/vercel-config.js --write${RESET}`
);
process.exit(1);
