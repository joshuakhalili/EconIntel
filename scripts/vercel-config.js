/**
 * Generate and verify `vercel.json`.
 *
 * WHY THIS IS GENERATED RATHER THAN HAND-WRITTEN
 *
 * On a long-lived Express host, `lib/security.js` builds the CSP at boot by
 * hashing the inline scripts in the HTML it is about to serve. That is the
 * whole reason the header cannot drift: it is derived from the files, every
 * time the process starts.
 *
 * On Vercel the static HTML is served by the CDN and never reaches Express, so
 * a header written into `vercel.json` is the only CSP those pages get — and a
 * hash pasted into a config file is exactly the drift this project already
 * paid for once. From 2026-08-28 to 2026-08-30 the CSP silently blocked all
 * seven of the landing page's inline scripts, including its animation engine,
 * because a scan looked at the wrong directory. Nothing failed; the page just
 * stopped animating.
 *
 * Vercel reads `vercel.json` BEFORE running the build, so a file written
 * during the build is read too late. Hence: `--write` regenerates it and
 * `--check` fails the build when the committed file no longer matches the
 * HTML. Same guarantee, enforced at a different moment.
 *
 *     node scripts/vercel-config.js --write   # regenerate after a landing rebuild
 *     node scripts/vercel-config.js --check   # gate; runs as part of npm run build
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inlineScriptHashes } from '../src/server/lib/security.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'vercel.json');

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const RESET = '[0m';

/**
 * Everything the React app owns, as Vercel route patterns.
 *
 * Kept in step with the table in `src/client/App.jsx` by hand, and that is a
 * real risk, so `scripts/check-routes.js` compares the two and fails if they
 * diverge. The alternative — a catch-all rewrite to the app shell — cannot
 * work here, because `/` belongs to the landing page and a catch-all would
 * take it.
 */
export const APP_ROUTES = [
  '/overview',
  '/login',
  '/lens/:slug',
  '/q/:slug',
  '/explore',
  '/data',
  '/data/:id',
  '/news',
  '/pipeline',
  '/simulate/:slug',
];

/** Paths the Express function answers. Everything else is static. */
const FUNCTION_ROUTES = ['/api/:path*', '/auth/:path*', '/healthz'];

export function buildConfig() {
  const hashes = inlineScriptHashes([
    path.join(ROOT, 'public'),
    path.join(ROOT, 'landing'),
  ]);

  if (hashes.length === 0) {
    throw new Error(
      'No inline script hashes found. Either the landing mirror is missing or ' +
        'the scan is looking in the wrong place — the second is the bug that ' +
        'killed the front page once already. Run `npm run build` first.'
    );
  }

  const csp = [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https://avatars.githubusercontent.com",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');

  return {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    /* Generated. See scripts/vercel-config.js — do not hand-edit; `npm run
       build` fails when this file disagrees with the HTML being served. */
    buildCommand: 'npm run build:vercel',
    outputDirectory: 'dist',
    framework: null,
    /* London, because the database is in London.
       Every request here is database-bound, so the function belongs in the
       same region as Postgres — anywhere else adds a round trip to the
       slowest part of the page, on every query.
       This said `fra1` while the database was Render's Frankfurt instance.
       The Neon project (`hidden-rice-12425013`) is `aws-eu-west-2`, so the
       compute moved to the data rather than the reverse: one config line
       against recreating a database that already holds 76,106 rows. */
    regions: ['lhr1'],
    /* The mirror's own links are slash-less (/legal/privacy-policy), and the
       canonical tags detach.py wrote point at the slash-less form. These two
       flags redirect toward those rather than away from them, replacing the
       hand-written resolver in app.js exactly. */
    cleanUrls: true,
    trailingSlash: false,
    functions: {
      'api/index.js': {
        /* Comfortably above the 8s DB_STATEMENT_TIMEOUT_MS, so a slow query is
           cancelled by Postgres with a real error rather than by the platform
           with a 504 that says nothing. */
        maxDuration: 15,
      },
    },
    redirects: [
      /* The template's waitlist flow. One of these pages renders an invented
         "1,200+ people on the waitlist" — a fabricated number on a site whose
         first rule is to invent nothing — so neither is deployed at all and
         these redirects catch anyone with the old URL. 307, not 308: this is a
         decision about content, and a cached permanent redirect is very hard
         to take back. */
      { source: '/waitlist', destination: '/login', permanent: false },
      { source: '/thanks', destination: '/login', permanent: false },
    ],
    rewrites: [
      ...FUNCTION_ROUTES.map((source) => ({ source, destination: '/api/index' })),
      /* The app shell, under its own name.
         `public/index.html` and `landing/index.html` cannot both be
         `/index.html`: Express resolves that collision by trying landing first
         and falling through, but a CDN has no ordering to fall through. So the
         assembly step writes the app shell to `app.html` and the landing page
         keeps `/`. Every app route rewrites to it.

         DESTINATION IS `/app`, NOT `/app.html`. `cleanUrls: true` above
         strips the extension, so `/app.html` is not a path this deployment
         serves — a rewrite pointing at it resolves to nothing and every app
         route returns the landing page's 404. Which is exactly what shipped:
         the build was green, the function was healthy, the database was
         connected, and /overview said "Page not found". */
      ...APP_ROUTES.map((source) => ({ source, destination: '/app' })),
    ],
    headers: [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value:
              'geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
      {
        /* Content-hashed filenames from both builders (Framer hashes, Vite
           emits index-<hash>), so these are immutable by construction. */
        source: '/assets/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ],
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

/*
 * Only when run directly. `check-routes.js` imports APP_ROUTES from here, and
 * without this guard that import executed the CLI, which printed a usage error
 * and exited 2 before the caller ran a single assertion — a gate that always
 * "passed" by never running.
 */
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

const mode = invokedDirectly ? process.argv[2] : null;
const serialise = (config) => `${JSON.stringify(config, null, 2)}\n`;

if (!invokedDirectly) {
  // Imported for APP_ROUTES / buildConfig. Nothing to do.
} else if (mode === '--write') {
  const config = buildConfig();
  writeFileSync(TARGET, serialise(config));
  const count = config.headers[0].headers[0].value.match(/sha256-/g).length;
  console.log(
    `${GREEN}✓${RESET} wrote vercel.json ${DIM}(${count} inline-script hashes, ` +
      `${APP_ROUTES.length} app routes)${RESET}`
  );
} else if (mode === '--check') {
  let committed;
  try {
    committed = readFileSync(TARGET, 'utf8');
  } catch {
    console.error(
      `${RED}✗ vercel.json is missing${RESET}\n` +
        `${DIM}Run: node scripts/vercel-config.js --write${RESET}`
    );
    process.exit(1);
  }

  const expected = serialise(buildConfig());

  // Vercel's own build step writes `name` and `version` into vercel.json
  // before running buildCommand — that's the CLI linking the deployment to
  // the project, not drift in what we generate. Ignore those two keys.
  const normalise = (json) => {
    const { name, version, ...rest } = JSON.parse(json);
    return rest;
  };
  const matches =
    committed === expected ||
    JSON.stringify(normalise(committed)) === JSON.stringify(normalise(expected));

  if (matches) {
    const count = expected.match(/sha256-/g).length;
    console.log(
      `${GREEN}✓${RESET} vercel.json matches the HTML being served ` +
        `${DIM}(${count} inline-script hashes)${RESET}`
    );
    process.exit(0);
  }

  console.error(
    `\n${RED}✗ vercel.json is stale${RESET}\n` +
      `${DIM}The committed config no longer matches the inline scripts in the ` +
      `HTML. On Vercel the CDN serves that HTML and this file is the only CSP ` +
      `it gets, so shipping it would block scripts silently — which has ` +
      `happened here before.\n\nRun: node scripts/vercel-config.js --write${RESET}`
  );
  process.exit(1);
} else {
  console.error('usage: node scripts/vercel-config.js --write | --check');
  process.exit(2);
}
