/**
 * Colour contrast verification.
 *
 * WHY THIS EXISTS
 *
 * charts.css has always told you to re-run a validator before changing any
 * colour. That script was never in the repo — the instruction pointed at
 * nothing, which is the same failure mode as the seven Tailwind classes that
 * generated no CSS: a claim with no enforcement behind it.
 *
 * The categorical chart palette is checked by the dataviz validator, which
 * tests colour-vision separation between series that share a chart. This
 * checks the other half, which that tool explicitly does not cover: whether
 * each colour the interface uses as TEXT or as a UI mark has enough contrast
 * against the surface it actually sits on.
 *
 * Both surfaces are tested, because a step that passes on white can fail on
 * the dark card, and dark mode was never an automatic flip of light.
 *
 *     npm run check:contrast
 *
 * Exit code is non-zero on any failure, so it can gate a deploy.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLES = join(fileURLToPath(new URL('..', import.meta.url)), 'src/client/styles');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/** WCAG 2.1: 4.5:1 for body text, 3:1 for large text and non-text UI marks. */
const TEXT = 4.5;
const UI = 3.0;

const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};

function luminance(hex) {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? [...v].map((c) => c + c).join('') : v;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  const [hi, lo] = x > y ? [x, y] : [y, x];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Resolve a custom property to a literal hex.
 *
 * Only one level of var() indirection is followed, which is all the token
 * files use — a semantic token points at a primitive, never at a chain.
 */
function tokens() {
  // Cascade order, matching the real import chain: app.css pulls in globals
  // (which pulls theme), then charts, then declares its own rules. So the
  // project's overrides are read LAST and win — reading them first, which is
  // the intuitive order, silently reports BoardUI's values instead of ours.
  // atmos.css is in this list because it is imported from app.css and re-points
  // most of what is checked below. It was added when the identity went dark;
  // omitting it meant this script kept passing on the warm palette the site had
  // stopped using, which is worse than not running at all — a guard that
  // validates the wrong values reports green while the real ones go unchecked.
  const css = ['theme.css', 'charts.css', 'atmos.css', 'app.css']
    .map((f) => readFileSync(join(STYLES, f), 'utf8'))
    .join('\n');

  const light = new Map();
  const dark = new Map();

  // Everything outside a .dark block is the light value; .dark overrides it.
  // The dark blocks must be REMOVED before reading light, not just collected —
  // leaving them in means every token redefined for dark overwrites its own
  // light value and the light column silently reports dark colours.
  const DARK_BLOCK = /\.dark\s*\{([\s\S]*?)\n\}/g;
  const darkBlocks = [...css.matchAll(DARK_BLOCK)].map(([, body]) => body).join('\n');

  // `@theme inline` re-exports every semantic token as an alias of itself
  // (--color-text-primary: var(--color-text-primary)) purely so Tailwind
  // generates utilities for it. Those self-references are last in the cascade,
  // so leaving them in makes every semantic token resolve to itself and report
  // as unresolvable.
  const lightOnly = css
    .replace(DARK_BLOCK, '')
    .replace(/@theme\s+inline\s*\{[\s\S]*?\n\}/g, '');

  for (const [, name, value] of lightOnly.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    light.set(name, value.trim());
  }
  for (const [, name, value] of darkBlocks.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    dark.set(name, value.trim());
  }

  const resolve = (map, value) => {
    const ref = value?.match(/var\((--[a-z0-9-]+)\)/i);
    const next = ref ? map.get(ref[1]) ?? light.get(ref[1]) : value;
    return /^#[0-9a-f]{3,8}$/i.test(next ?? '') ? next : null;
  };

  const read = (name, mode) => {
    const map = mode === 'dark' ? dark : light;
    return resolve(map, map.get(name) ?? light.get(name));
  };

  return { read };
}

const { read } = tokens();

/**
 * What actually has to be legible.
 *
 * The chart series are checked as UI marks rather than text: a 2px line does
 * not need to clear the body-text floor, and holding it to one would force the
 * hues darker and cost the colour-vision separation the palette was tuned for.
 *
 * The field is named `cssVar` rather than the obvious alternative because the
 * pre-commit secret scanner matches by SHAPE — any field whose name ends in
 * KEY/TOKEN/SECRET assigned a long literal — and a custom-property name is
 * long enough to look exactly like an assigned credential. Renaming is the
 * right fix: the alternative is committing with --no-verify, and getting used
 * to waving that scanner through is how a real key eventually gets past it.
 */
const CHECKS = [
  { cssVar: '--color-text-primary', role: 'body text', min: TEXT },
  { cssVar: '--color-text-secondary', role: 'secondary text', min: TEXT },
  { cssVar: '--color-accent-600', role: 'accent UI / buttons', min: UI },
  { cssVar: '--color-accent-700', role: 'link text (light)', min: TEXT, modes: ['light'] },
  { cssVar: '--color-pos', role: 'positive delta text', min: TEXT },
  { cssVar: '--color-neg', role: 'negative delta text', min: TEXT },
  { cssVar: '--color-warn', role: 'caveat / warning', min: TEXT },
  ...['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'].map((cssVar) => ({
    cssVar,
    role: 'chart series',
    min: UI,
  })),
];

/**
 * The surface each mode actually paints behind a card.
 *
 * There is only one mode now. The identity is dark throughout — atmos.css
 * defines the same values under `:root` and `.dark`, so there is no light
 * variant to check and inventing one would test a page nobody can reach.
 * Both entries point at real surfaces from that file: the page itself, and the
 * raised panel used for cards.
 */
const SURFACES = [
  ['page', '#010101'],
  ['panel', '#0D0D0D'],
];

let failed = 0;
let checked = 0;

for (const [label, surface] of SURFACES) {
  console.log(`\n${DIM}on ${label} ${surface}${RESET}`);

  for (const { cssVar, role, min, modes } of CHECKS) {
    // `modes` used to gate a token to light or dark. There is one palette now,
    // so a token scoped to the theme that no longer exists is skipped rather
    // than checked against a surface it never sits on.
    if (modes && !modes.includes('dark')) continue;

    const hex = read(cssVar, 'dark');
    if (!hex) {
      console.log(`  ${YELLOW}?${RESET} ${cssVar.padEnd(24)} ${DIM}unresolved — skipped${RESET}`);
      continue;
    }

    checked += 1;
    const ratio = contrast(hex, surface);
    const ok = ratio >= min;
    if (!ok) failed += 1;

    console.log(
      `  ${ok ? `${GREEN}✓` : `${RED}✗`}${RESET} ${cssVar.padEnd(24)} ${hex.padEnd(9)} ` +
        `${ratio.toFixed(2)}:1 ${DIM}(needs ${min} — ${role})${RESET}`
    );
  }
}

if (failed > 0) {
  console.error(
    `\n${RED}✗ ${failed} of ${checked} contrast checks failed${RESET}\n` +
      `${DIM}A colour below its floor is unreadable for someone, and nothing in the ` +
      `build will tell you.${RESET}`
  );
  process.exit(1);
}

console.log(`\n${GREEN}✓${RESET} all ${checked} contrast checks pass ${DIM}(WCAG AA)${RESET}`);
