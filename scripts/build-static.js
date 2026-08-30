/**
 * Assemble the two halves of the site into one static directory.
 *
 * Express serves this site from two roots and resolves the overlap by ORDER:
 * try `landing/`, fall through to `public/`. A CDN has no fall-through, so the
 * deploy needs a single directory where every path is already decided.
 *
 * Three things that ordering was quietly handling, which have to become
 * explicit here:
 *
 * 1. BOTH HALVES HAVE AN index.html. `landing/index.html` is the front door;
 *    `public/index.html` is the React shell. Express tries landing first and
 *    wins. Here the shell is written to `app.html` and every app route is
 *    rewritten to it in vercel.json.
 *
 * 2. `landing/` CONTAINS MORE THAN THE SITE. `docs/` is the clone pipeline and
 *    `.mirror-cache/` is the original Framer template as downloaded, before the
 *    content map replaced its copy with Diffusion's. Both were being served to
 *    anyone who asked until 2026-08-30. Neither is deployed.
 *
 * 3. THE WAITLIST PAGES ARE NOT SHIPPED AT ALL. `/waitlist` renders an invented
 *    "1,200+ people on the waitlist" — a fabricated number on a site whose
 *    first rule is to invent nothing. Express redirects them; here they are
 *    simply absent, and vercel.json redirects the URLs.
 *
 * The two `assets/` directories merge safely and that is not luck: Framer
 * content-hashes its filenames and Vite emits `index-<hash>`, so a collision
 * would require a hash collision. The check below asserts it anyway, because
 * "cannot collide" is the kind of claim that stops being true silently.
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = path.join(ROOT, 'landing');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

const GREEN = '[32m';
const RED = '[31m';
const DIM = '[2m';
const RESET = '[0m';

/** Never deployed: build tooling, the un-hardened original, the fabricated page. */
const EXCLUDE_FROM_LANDING = new Set([
  'docs',
  '.mirror-cache',
  'waitlist',
  'thanks',
]);

function fail(message) {
  console.error(`\n${RED}✗ ${message}${RESET}`);
  process.exit(1);
}

/** Every file under `dir`, as paths relative to it. */
function filesUnder(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory()
      ? filesUnder(full, base)
      : [path.relative(base, full)];
  });
}

if (!existsSync(PUBLIC) || !existsSync(path.join(PUBLIC, 'index.html'))) {
  fail('public/index.html is missing — run `vite build` before this script.');
}
if (!existsSync(path.join(LANDING, 'index.html'))) {
  fail('landing/index.html is missing — the landing mirror is not checked out.');
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// ── The landing half, minus everything that is not the site ──────────────────
for (const entry of readdirSync(LANDING, { withFileTypes: true })) {
  if (EXCLUDE_FROM_LANDING.has(entry.name)) continue;
  cpSync(path.join(LANDING, entry.name), path.join(OUT, entry.name), {
    recursive: true,
  });
}

// ── Collision check, before the app half can overwrite anything ───────────────
const landingFiles = new Set(filesUnder(OUT));
const appFiles = filesUnder(PUBLIC);
const collisions = appFiles.filter(
  (f) => landingFiles.has(f) && f !== 'index.html'
);
if (collisions.length > 0) {
  fail(
    `${collisions.length} file(s) exist in both halves and one would silently ` +
      `overwrite the other:\n  ${collisions.join('\n  ')}\n` +
      `${DIM}Both builders content-hash their output, so this should be ` +
      `impossible. Something has changed about how one of them names files.${RESET}`
  );
}

/*
 * ── The app half ────────────────────────────────────────────────────────────
 *
 * Entry by entry, with the shell redirected to `app.html` as it is copied.
 *
 * Copying the directory wholesale and renaming afterwards does NOT work, and
 * the way it fails is quiet: `cpSync(PUBLIC, OUT)` writes the React shell over
 * the landing page's `index.html` first, so the subsequent rename moves the
 * shell to `app.html` and leaves no `/` at all. The front door would simply be
 * missing from the deploy. The assertions below catch it, which is why they
 * are there.
 *
 * The shell keeps `app.html` so the landing page keeps `/`. Every app route is
 * rewritten to it in vercel.json; the two lists are kept in step by
 * scripts/check-routes.js.
 */
for (const entry of readdirSync(PUBLIC, { withFileTypes: true })) {
  const destination =
    entry.name === 'index.html' ? 'app.html' : entry.name;
  cpSync(path.join(PUBLIC, entry.name), path.join(OUT, destination), {
    recursive: true,
  });
}

// ── Report, and assert the result is actually usable ─────────────────────────
for (const required of ['index.html', 'app.html']) {
  if (!existsSync(path.join(OUT, required))) fail(`dist/${required} was not produced`);
}
for (const forbidden of [...EXCLUDE_FROM_LANDING]) {
  if (existsSync(path.join(OUT, forbidden))) fail(`dist/${forbidden} should not exist`);
}

const all = filesUnder(OUT);
const bytes = all.reduce((sum, f) => sum + statSync(path.join(OUT, f)).size, 0);
console.log(
  `${GREEN}✓${RESET} dist/ assembled ${DIM}(${all.length} files, ` +
    `${(bytes / 1024 / 1024).toFixed(1)} MB — landing at /, app shell at ` +
    `/app.html)${RESET}`
);
