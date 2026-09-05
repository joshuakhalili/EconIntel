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
 * Which custom-property family each utility prefix draws its name from.
 *
 * WHY THIS IS A TABLE AND NOT THREE PREFIXES
 *
 * This script checked `text-`, `bg-` and `border-` and nothing else, so a
 * class like `ring-border-nope` or `fill-series-nope` — a name that generates
 * no CSS, exactly the failure this file was written for — passed silently.
 * Verified: five such classes added to a component produced
 * `✓ every design token we own is defined`.
 *
 * That gap was not theoretical. The codebase leans on these prefixes: 16 uses
 * of `ring-border-focus-ring`, 5 of `shadow-dropdown`, 3 of
 * `fill-text-tertiary`, 2 of `stroke-border-button-default`. A vanished focus
 * ring is an accessibility regression and a vanished chart stroke is a chart
 * element that stops drawing — both of which look like design decisions.
 *
 * Nearly every colour-taking utility resolves against `--color-*`. `text-` is
 * the one that reads from two families, because the type ramp lives in
 * `--text-*`; `shadow-` is the one that reads from neither.
 */
const PREFIX_FAMILIES = {
  text: ['--text-', '--color-'],
  shadow: ['--shadow-'],
  bg: ['--color-'],
  border: ['--color-'],
  ring: ['--color-'],
  fill: ['--color-'],
  stroke: ['--color-'],
  divide: ['--color-'],
  outline: ['--color-'],
  from: ['--color-'],
  via: ['--color-'],
  to: ['--color-'],
  accent: ['--color-'],
  caret: ['--color-'],
  decoration: ['--color-'],
  placeholder: ['--color-'],
};

// Longest first, so `text-` is never matched as `t` + something by a future
// edit that adds a prefix which is itself a prefix of another.
const PREFIXES = Object.keys(PREFIX_FAMILIES).sort((a, b) => b.length - a.length);
const PREFIXED = new RegExp(`^(${PREFIXES.join('|')})-`);
const PREFIX_SPLIT = new RegExp(`^(${PREFIXES.join('|')})-(.+)$`);

/** Colour keywords every colour-taking utility accepts without a token. */
const COLOR_KEYWORDS = ['transparent', 'current', 'inherit', 'white', 'black'];

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
    ...COLOR_KEYWORDS,
  ]),
  border: new Set([
    'solid', 'dashed', 'dotted', 'double', 'hidden', 'none',
    'collapse', 'separate', 'spacing',
    ...COLOR_KEYWORDS,
  ]),
  bg: new Set([
    'transparent', 'current', 'inherit', 'white', 'black', 'none',
    'fixed', 'local', 'scroll', 'clip', 'origin',
    'center', 'top', 'bottom', 'left', 'right', 'cover', 'contain',
    'repeat', 'no-repeat', 'repeat-x', 'repeat-y', 'repeat-round',
    'repeat-space', 'auto',
  ]),
  // Tailwind ships the whole shadow scale, so `shadow-2xl` needs no project
  // token even though this project defines only some of the steps itself.
  shadow: new Set([
    '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'none', 'inner', 'initial',
  ]),
  ring: new Set(['inset', 'none', ...COLOR_KEYWORDS]),
  outline: new Set([
    'none', 'hidden', 'solid', 'dashed', 'dotted', 'double', ...COLOR_KEYWORDS,
  ]),
  divide: new Set([
    'solid', 'dashed', 'dotted', 'double', 'none', ...COLOR_KEYWORDS,
  ]),
  fill: new Set(['none', ...COLOR_KEYWORDS]),
  stroke: new Set(['none', ...COLOR_KEYWORDS]),
  from: new Set(COLOR_KEYWORDS),
  via: new Set(COLOR_KEYWORDS),
  to: new Set(COLOR_KEYWORDS),
  accent: new Set(['auto', ...COLOR_KEYWORDS]),
  caret: new Set(COLOR_KEYWORDS),
  decoration: new Set([
    'solid', 'double', 'dotted', 'dashed', 'wavy', 'auto', 'from-font', 'none',
    ...COLOR_KEYWORDS,
  ]),
  placeholder: new Set(COLOR_KEYWORDS),
};

/**
 * Shapes that are geometry or position rather than a colour name.
 *
 * `ring-2`, `divide-y`, `outline-offset-2`, `decoration-2`, `from-40%` and the
 * gradient direction words all name no token and must not be looked up as one.
 * `offset-` is allowed wholesale for ring and outline: `ring-offset-white` is a
 * real colour utility, but nothing here uses one, and the generous-allowlist
 * rule above says a missed check costs less than a wrong alarm.
 */
const GEOMETRY = {
  // Numeric border widths and side-scoped variants: border-2, border-t, border-x-4.
  border: /^(?:[trblxyse](?:-\d+)?|\d+)$/,
  ring: /^(?:\d+|offset-.+)$/,
  outline: /^(?:\d+|offset-.+)$/,
  divide: /^(?:[xy](?:-(?:\d+|reverse))?|\d+)$/,
  decoration: /^\d+$/,
  // Gradient stop positions (`from-40%`) and the direction words that show up
  // on their own when a comment quotes one, e.g. `to-t` in switch.tsx.
  from: /^(?:\d{1,3}%|[trbl]|t[rl]|b[rl])$/,
  via: /^(?:\d{1,3}%|[trbl]|t[rl]|b[rl])$/,
  to: /^(?:\d{1,3}%|[trbl]|t[rl]|b[rl])$/,
};

/**
 * Tailwind ships its own colour palette, so `bg-lime-400` needs no project
 * token. Matching the shape rather than enumerating 250 names.
 */
const TAILWIND_PALETTE =
  /^(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-(?:50|100|200|300|400|500|600|700|800|900|950)$/;

/** v4 gradient utilities: bg-linear-to-br, bg-radial, bg-conic-180. */
const GRADIENT = /^(?:linear|radial|conic)(?:-|$)/;

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

/**
 * Leading Tailwind variants, stripped before the utility is read.
 *
 * This used to be a fixed list — hover, focus, active, dark, group-hover,
 * disabled, aria-*, and the breakpoints — which meant any utility behind a
 * variant nobody had thought of was skipped rather than checked.
 * `focus-within:ring-signal` in ExplorePage.jsx is a live example: it was
 * invisible to this gate for the same reason an undefined token is invisible
 * to Tailwind.
 *
 * Matching the SHAPE of a variant instead — one or more `word:` segments,
 * each optionally carrying an arbitrary `[…]` value — covers every variant
 * that exists and every one that will be added.
 */
const VARIANTS = /^(?:[a-z0-9][a-z0-9-]*(?:\[[^\]]*\])?:)+/;

function checkUtility(cls, tokens) {
  const [, prefix, rest] = cls.match(PREFIX_SPLIT) ?? [];
  if (!prefix) return null;
  if (rest.startsWith('[')) return null; // arbitrary value — Tailwind handles it
  if (BUILTIN[prefix].has(rest)) return null;
  if (prefix !== 'shadow' && TAILWIND_PALETTE.test(rest)) return null;
  if (prefix === 'bg' && GRADIENT.test(rest)) return null;
  if (GEOMETRY[prefix]?.test(rest)) return null;

  // `text-body-regular` comes from --text-*; `text-text-primary` from --color-*;
  // `shadow-dropdown` from --shadow-*; everything else from --color-*.
  const candidates = PREFIX_FAMILIES[prefix].map((family) => `${family}${rest}`);

  return candidates.some((c) => tokens.utility.has(c)) ? null : { cls, candidates };
}

const { utility, declared } = readTokens();
const sources = walk(CLIENT, (p) => /\.(jsx?|tsx?)$/.test(p));

const classProblems = new Map();
const varProblems = new Map();

for (const file of sources) {
  const src = readFileSync(file, 'utf8');
  const where = relative(ROOT, file);

  // Class names live inside quoted strings and template literals. Splitting every
  // string on whitespace over-collects — and that stopped being harmless when the
  // prefix table grew past text/bg/border. `to`, `from`, `via`, `to` and friends are
  // ordinary English words, so the prose string "add a to-do item" was being read as
  // the utility `to-do` and looked up as `--color-do`. Reproduced before this guard
  // existed; a gate that fires on prose is a gate people learn to ignore.
  //
  // So a string is only read as a class list when we have a reason to believe it is
  // one. Two reasons count:
  //   1. It sits inside className=... or cx(...), the only two class-bearing
  //      constructs in this codebase (756 and 87 uses).
  //   2. It carries at least one token that RESOLVES — a real utility naming a token
  //      we define. A broken class almost never travels alone, so this keeps the class
  //      lists that live in variables while prose, which resolves nothing, is skipped.
  // Anything else is left alone. A false negative here costs nothing; a false positive
  // costs the gate its credibility.
  const classRegions = [];
  for (const [, region] of src.matchAll(/className\s*=\s*(\{(?:[^{}]|\{[^{}]*\})*\}|"[^"]*"|'[^']*')/g)) {
    classRegions.push(region);
  }
  for (const [, region] of src.matchAll(/\bcx\(((?:[^()]|\([^()]*\))*)\)/g)) {
    classRegions.push(region);
  }
  const inClassContext = classRegions.join('\n');

  /**
   * Does this string carry evidence that it is a class list rather than prose?
   *
   * Either a PREFIXED utility that actually resolves to a token we define, or a
   * bare Tailwind utility of a shape English prose does not produce. The shapes
   * below all require a digit or a Tailwind keyword after the hyphen, so "space-time"
   * and "to-do" are not mistaken for `space-` and `to-` utilities.
   *
   * KNOWN LIMIT, stated rather than hidden: a class list held in a variable in which
   * EVERY token is broken and none is a bare utility is not scanned. That is a false
   * negative, which this file's policy prefers to a false positive.
   */
  const BARE_UTILITY = new RegExp(
    '^(?:' +
      'flex|grid|block|inline|hidden|contents|absolute|relative|fixed|sticky|isolate|truncate' +
      '|[mp][xytrbl]?-(?:\\d|px|auto)' +
      '|(?:w|h|size|gap|gap-x|gap-y|space-x|space-y)-(?:\\d|px|full|auto|screen|min|max|fit)' +
      '|(?:items|justify|self|content|place|align)-\\w+' +
      '|(?:max|min)-[wh]-\\w+' +
      '|(?:rounded|opacity|z|order|col|row|basis|grow|shrink)-\\w+' +
      '|(?:text|font)-(?:xs|sm|base|lg|xl|[2-9]xl|medium|semibold|bold|normal)' +
    ')$'
  );

  const carriesRealUtility = (s) =>
    s.split(/\s+/).some((raw) => {
      const cls = baseOf(raw.replace(VARIANTS, ''));
      if (BARE_UTILITY.test(cls)) return true;
      return PREFIXED.test(cls) && !checkUtility(cls, { utility });
    });

  const scanClassString = (quoted, where) => {
    for (const raw of quoted.split(/\s+/)) {
      const cls = baseOf(raw.replace(VARIANTS, ''));
      if (!PREFIXED.test(cls)) continue;
      const problem = checkUtility(cls, { utility });
      if (problem) {
        if (!classProblems.has(cls)) classProblems.set(cls, new Set());
        classProblems.get(cls).add(where);
      }
    }
  };

  for (const [, quoted] of inClassContext.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
    scanClassString(quoted, where);
  }
  for (const [, quoted] of src.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
    if (carriesRealUtility(quoted)) scanClassString(quoted, where);
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
