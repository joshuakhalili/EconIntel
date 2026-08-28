/**
 * Design-token verification.
 *
 * WHY THIS EXISTS
 *
 * A Tailwind class that does not exist does not throw, does not warn, and does
 * not fail the build. It simply generates no CSS. The element renders with
 * whatever it inherits, which usually looks like a styling opinion rather than
 * a mistake.
 *
 * This project shipped exactly that. Seven utility classes were used across
 * sixteen components against token names BoardUI does not define —
 * `border-border-secondary`, `text-caption-regular`, `text-heading-medium` and
 * others. Because Tailwind v4 changed the default border colour from grey to
 * `currentColor`, `border border-border-secondary` applied a 1px border with no
 * colour rule, so every card, drawer and tooltip in the app drew a near-black
 * outline in light mode and a white one in dark. At the same time the whole
 * type ramp collapsed to the inherited size. The app looked broken for weeks
 * and nothing anywhere reported an error.
 *
 * The same hazard exists for CSS custom properties read at runtime: LineChart
 * passed `var(--color-border-secondary)` to Recharts for its grid and axis
 * strokes, and an undefined variable there paints nothing.
 *
 * So this script asserts the invariant that neither Tailwind nor the bundler
 * will: every design token referenced in `src/client` is actually defined in
 * the stylesheets. Run it before a build:
 *
 *     npm run check:tokens
 *
 * Exit code is non-zero if any token is undefined, so it can gate a deploy.
 *
 * NOTE ON @theme inline: only names re-exported inside theme.css's
 * `@theme inline {}` block generate utilities. A semantic token defined in
 * `:root` but missing from that block resolves as a variable yet produces no
 * class — so utilities are checked against the inline block, while `var()`
 * references are checked against every definition.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLIENT = join(ROOT, 'src/client');
const STYLES = join(CLIENT, 'styles');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/**
 * Tailwind's own keywords, which are valid without any project token.
 *
 * Anything matching these is skipped rather than looked up. The lists are
 * deliberately generous: a false negative here costs nothing, while a false
 * positive trains people to ignore the script.
 */
const BUILTIN = {
  text: new Set([
    'left', 'center', 'right', 'justify', 'start', 'end',
    'wrap', 'nowrap', 'balance', 'pretty', 'ellipsis', 'clip',
    'xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl',
    '7xl', '8xl', '9xl',
    'white', 'black', 'transparent', 'current', 'inherit',
  ]),
  border: new Set([
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'none',
    'collapse', 'separate', 'spacing',
    'white', 'black', 'transparent', 'current', 'inherit',
  ]),
  bg: new Set([
    'transparent', 'current', 'inherit', 'white', 'black', 'none',
    'fixed', 'local', 'scroll', 'clip', 'origin',
    'center', 'top', 'bottom', 'left', 'right', 'cover', 'contain',
    'repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'repeat-round',
    'repeat-space', 'auto',
  ]),
};

/**
 * Tailwind ships its own colour palette, so `bg-lime-400` needs no project
 * token. Matching the shape rather than enumerating 250 names.
 */
const TAILWIND_PALETTE =
  /^(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(?:50|100|200|300|400|500|600|700|800|900|950)$/;

/** v4 gradient utilities: bg-linear-to-br, bg-radial, bg-conic-180. */
const GRADIENT = /^(?:linear|radial|conic)(?:-|$)/;

/** Numeric border widths and side-scoped variants: border-2, border-t, border-x-4. */
const BORDER_GEOMETRY = /^(?:[trblxyse](?:-\d+)?|\d+)$/;

/**
 * BoardUI's generated components are vendored so that `npx boardui@latest init`
 * stays re-runnable, which means their faults are not ours to edit. They are
 * reported separately and do not fail the run — `bg-button-primary` in
 * base/buttons/button.tsx is a real one, and it is still upstream's to fix.
 */
const VENDORED = /^src\/client\/(?:components\/(?:base|application|foundations)|utils)\//;

function walk(dir, test, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, test, found);
    else if (test(path)) found.push(path);
  }
  return found;
}

/**
 * Custom properties the stylesheets define.
 *
 * `utility` holds only what @theme / @theme inline export, because that is what
 * decides whether a class exists. `declared` holds every definition anywhere,
 * which is the correct test for a runtime var() lookup.
 */
function readTokens() {
  const utility = new Set();
  const declared = new Set();

  for (const file of walk(STYLES, (p) => p.endsWith('.css'))) {
    const css = readFileSync(file, 'utf8');

    for (const [, name] of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) {
      // Drop Tailwind's paired modifiers (--text-body--line-height); the base
      // name is what forms the utility.
      if (!name.includes('--', 2)) declared.add(name);
    }

    // Only @theme and @theme inline blocks generate utilities.
    for (const [, body] of css.matchAll(/@theme[^{]*\{([\s\S]*?)\n\}/g)) {
      for (const [, name] of body.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) {
        if (!name.includes('--', 2)) utility.add(name);
      }
    }
  }
  return { utility, declared };
}

/** Strip an opacity modifier (`border-warn/40`) and arbitrary values. */
function baseOf(cls) {
  return cls.split('/')[0];
}

function checkUtility(cls, tokens) {
  const [, prefix, rest] = cls.match(/^(text|bg|border)-(.+)$/) ?? [];
  if (!prefix) return null;
  if (rest.startsWith('[')) return null; // arbitrary value — Tailwind handles it
  if (BUILTIN[prefix].has(rest)) return null;
  if (TAILWIND_PALETTE.test(rest)) return null;
  if (prefix === 'bg' && GRADIENT.test(rest)) return null;
  if (prefix === 'border' && BORDER_GEOMETRY.test(rest)) return null;

  // `text-body-regular` comes from --text-*; `text-text-primary` from --color-*.
  const candidates =
    prefix === 'text'
      ? [`--text-${rest}`, `--color-${rest}`]
      : [`--color-${rest}`];

  return candidates.some((c) => tokens.utility.has(c)) ? null : { cls, candidates };
}

const { utility, declared } = readTokens();
const sources = walk(CLIENT, (p) => /\.(jsx?|tsx?)$/.test(p));

const classProblems = new Map();
const varProblems = new Map();

for (const file of sources) {
  const src = readFileSync(file, 'utf8');
  const where = relative(ROOT, file);

  // Class names live inside quoted strings and template literals. Splitting
  // every string on whitespace over-collects, which is fine — anything that is
  // not a token-shaped utility is ignored below.
  for (const [, quoted] of src.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
    for (const raw of quoted.split(/\s+/)) {
      const cls = baseOf(raw.replace(/^(?:hover|focus|active|dark|group-hover|disabled|aria-\w+|sm|md|lg|xl|2xl):/g, ''));
      if (!/^(text|bg|border)-/.test(cls)) continue;
      const problem = checkUtility(cls, { utility });
      if (problem) {
        if (!classProblems.has(cls)) classProblems.set(cls, new Set());
        classProblems.get(cls).add(where);
      }
    }
  }

  // Runtime var() lookups — these bypass Tailwind entirely.
  for (const [, name] of src.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    if (declared.has(name)) continue;
    if (!varProblems.has(name)) varProblems.set(name, new Set());
    varProblems.get(name).add(where);
  }
}

/** Split by whether we own the file, since vendored faults are not ours to fix. */
function partition(problems) {
  const ours = new Map();
  const vendored = new Map();
  for (const [key, files] of problems) {
    const mine = [...files].filter((f) => !VENDORED.test(f));
    if (mine.length) ours.set(key, mine);
    else vendored.set(key, [...files]);
  }
  return { ours, vendored };
}

const classes = partition(classProblems);
const vars = partition(varProblems);
const failures = classes.ours.size + vars.ours.size;
const notices = classes.vendored.size + vars.vendored.size;

for (const [cls, files] of classes.ours) {
  console.error(`  ${RED}${cls}${RESET} — no such utility`);
  console.error(`    ${DIM}looked for: ${checkUtility(cls, { utility }).candidates.join(' or ')}${RESET}`);
  console.error(`    ${DIM}used in: ${files.join(', ')}${RESET}`);
}

for (const [name, files] of vars.ours) {
  console.error(`  ${RED}var(${name})${RESET} — not defined in any stylesheet`);
  console.error(`    ${DIM}used in: ${files.join(', ')}${RESET}`);
}

if (notices) {
  const names = [...classes.vendored.keys(), ...vars.vendored.keys()];
  console.log(
    `${DIM}note: ${notices} undefined token(s) in vendored BoardUI components ` +
      `(${names.join(', ')}) — upstream's to fix, not edited here so ` +
      `\`boardui init\` stays re-runnable.${RESET}`
  );
}

if (failures === 0) {
  console.log(
    `${GREEN}✓${RESET} every design token we own is defined ` +
      `${DIM}(${utility.size} utility tokens, ${sources.length} files scanned)${RESET}`
  );
  process.exit(0);
}

console.error(
  `\n${RED}✗ ${failures} undefined design token(s)${RESET}` +
    `\n${DIM}A missing utility generates no CSS and never throws. See the note ` +
    `at the top of this file.${RESET}`
);
process.exit(1);
