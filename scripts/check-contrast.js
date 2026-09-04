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
 * AND THE PALETTE'S OWN INTEGRITY, WHICH NOTHING USED TO CHECK
 *
 * "Six CVD-validated hues in a fixed order" is a stated non-negotiable, and
 * until 3 September 2026 nothing enforced any part of it. This file listed
 * ['--c1'…'--c6'] by hand, so a `--c7` added to charts.css and appended to
 * SERIES_COLORS was simply not looked at — the contrast run stayed green and
 * `exceedsPalette()`, the runtime guard that makes ChartGroup refuse to draw,
 * silently permitted one more series whose separation was never measured.
 * Swapping two hues passed too: nothing compared them against anything.
 *
 * So the list below is DERIVED from SERIES_COLORS rather than restated, and
 * both the count and the exact hex of every step are asserted against the
 * validated set recorded in charts.css. Reordering repaints every chart on the
 * site — green stops meaning one country and starts meaning another, across
 * pages, with no version marker — which is invisible to a reviewer looking at
 * a green build. It is not invisible to this.
 *
 *     npm run check:contrast
 *
 * Exit code is non-zero on any failure, so it can gate a deploy.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SERIES_COLORS } from '../src/client/lib/format.js';

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

  return { read, css };
}

const { read, css } = tokens();

/**
 * The categorical palette as it was validated, checked in.
 *
 * These are not preferences and they are not derived from the CSS — that would
 * make the check circular, passing whatever charts.css happens to say today.
 * They are the hexes the dataviz validator scored, in the order it scored them
 * in, recorded in the header of styles/charts.css along with the separation
 * numbers (light re-validated 2026-08-26: worst adjacent CVD c6<->c5 dE 10.8
 * deutan; dark needed its own steps for c1, c2 and c4 because BoardUI's dark
 * card is lighter than the surface the originals were measured against).
 *
 * CHANGING ANY OF THESE MEANS RE-RUNNING THE VALIDATOR, not editing this list.
 * Adjacency is what CVD separation is measured on, so a reorder is a real
 * change to what a reader with deuteranopia can tell apart — and it silently
 * repaints every chart on the site, so the same green line means one country
 * on Monday and another on Tuesday.
 */
const VALIDATED_SERIES = [
  { token: '--c1', light: '#1F7A4D', dark: '#2E9160' },
  { token: '--c2', light: '#2563C9', dark: '#4680E0' },
  { token: '--c3', light: '#C2570B', dark: '#C2570B' },
  { token: '--c4', light: '#7C3AED', dark: '#9061F0' },
  { token: '--c5', light: '#0891B2', dark: '#0891B2' },
  { token: '--c6', light: '#C93A6E', dark: '#C93A6E' },
];

/**
 * Six. Not "however many are defined" — the number is the non-negotiable.
 *
 * A seventh hue means a chart can draw a seventh series whose colour-vision
 * separation against the other six was never measured, and every runtime guard
 * that asks `palette.length` quietly permits it.
 */
const REQUIRED_HUES = 6;

const paletteProblems = [];

if (SERIES_COLORS.length !== REQUIRED_HUES) {
  paletteProblems.push(
    `SERIES_COLORS holds ${SERIES_COLORS.length} hues, not ${REQUIRED_HUES} ` +
      `(${SERIES_COLORS.join(', ')}). The palette is six validated hues; a seventh ` +
      'has to be scored by the dataviz validator against all six before it exists.'
  );
}

if (VALIDATED_SERIES.length !== REQUIRED_HUES) {
  paletteProblems.push(
    `VALIDATED_SERIES in this file holds ${VALIDATED_SERIES.length} entries, not ${REQUIRED_HUES}.`
  );
}

for (const [i, expected] of VALIDATED_SERIES.entries()) {
  const actual = SERIES_COLORS[i];
  if (actual !== expected.token) {
    paletteProblems.push(
      `SERIES_COLORS[${i}] is ${actual ?? '(missing)'}, expected ${expected.token}. ` +
        'The hue ORDER is fixed — see the note in styles/charts.css.'
    );
    continue;
  }
  for (const mode of ['light', 'dark']) {
    const hex = read(expected.token, mode);
    if (!hex) {
      paletteProblems.push(`${expected.token} does not resolve to a hex in ${mode} mode.`);
    } else if (hex.toUpperCase() !== expected[mode].toUpperCase()) {
      paletteProblems.push(
        `${expected.token} is ${hex} in ${mode} mode, expected ${expected[mode]}. ` +
          'A hue that moved was not re-scored; two hues that swapped repaint every chart.'
      );
    }
  }
}

/*
 * The other half of the same mistake: a hue defined in the stylesheet but not
 * in SERIES_COLORS. It draws nothing today, and it is one line in format.js
 * away from drawing a seventh series — so it is caught where it is cheap.
 */
const definedHues = [
  ...new Set([...css.matchAll(/(--c\d+)\s*:/g)].map(([, name]) => name)),
].sort();
const allowedHues = VALIDATED_SERIES.map((s) => s.token);
const strayHues = definedHues.filter((name) => !allowedHues.includes(name));
if (strayHues.length > 0) {
  paletteProblems.push(
    `the stylesheets define ${strayHues.join(', ')}, which is not in the validated set ` +
      `(${allowedHues.join(', ')}). Delete it, or score it and add it here.`
  );
}

console.log(`\n${DIM}categorical palette${RESET}`);
if (paletteProblems.length === 0) {
  console.log(
    `  ${GREEN}✓${RESET} ${SERIES_COLORS.length} hues, in order, at their validated values ` +
      `${DIM}(${SERIES_COLORS.join(' ')})${RESET}`
  );
} else {
  for (const problem of paletteProblems) console.log(`  ${RED}✗${RESET} ${problem}`);
}

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
  // Derived, never restated. A seventh hue appended to SERIES_COLORS is
  // checked here the moment it exists — and rejected by the palette
  // integrity block above, which is where the count is the point.
  ...SERIES_COLORS.map((cssVar) => ({
    cssVar,
    role: 'chart series',
    min: UI,
  })),

  /*
   * Text on a filled card.
   *
   * Question cards and the price sheet are painted in the electric blue rather
   * than the panel grey, and white on that blue is 5.03:1 — over the 4.5 floor
   * by half a point and no more. That headroom is entirely spent, which has
   * three consequences that are all counter-intuitive and all get reintroduced
   * by someone who does not know the number:
   *
   *   - `text-white/90` composites to 4.38:1 and FAILS. There is no dimmed
   *     white on this card; hierarchy comes from size, weight and leading.
   *   - A `bg-white/10` pill under white text is 4.23:1 and fails. Badges on
   *     the fill are transparent with a white border.
   *   - Brightening the fill on hover fails too (`#4573ff` is 4.08:1), which
   *     is why the hover moves the card rather than lightening it.
   *
   * Checked here rather than written in a comment, so changing the fill hex
   * turns the build red instead of turning the card unreadable.
   */
  { cssVar: '--color-on-fill', role: 'text on a filled card', min: TEXT, surfaces: ['fill', 'fill-hover', 'band'] },
];

/**
 * Which surfaces a check runs against.
 *
 * Defaults to the two a card can sit on. The filled surfaces are opt-in
 * because nothing else goes there — running the chart hues or the direction
 * trio against the blue would fail correctly and uselessly, since none of them
 * is ever painted on it.
 */
const DEFAULT_SURFACES = ['page', 'panel'];

/**
 * The surface each mode actually paints behind text.
 *
 * There is only one mode now. The identity is dark throughout — atmos.css
 * defines the same values under `:root` and `.dark`, so there is no light
 * variant to check and inventing one would test a page nobody can reach.
 *
 * `fill` and `fill-hover` are the question card and the price sheet. They are
 * literals rather than resolved tokens because they are what the components
 * paint: if the two ever disagree, this file is the one that should win.
 */
const SURFACES = [
  ['page', '#010101'],
  ['panel', '#0D0D0D'],
  ['fill', '#2F61F7'],
  ['fill-hover', '#2B59E3'],
  // `.gradient-band` (atmos.css) sits behind every lens, question and login hero.
  // It composites a radial gradient over a linear one, and its BRIGHTEST point is
  // the radial centre at 50% 100%, where #2f61f7 is fully opaque — so the band
  // peaks at exactly the same colour as the question card, and inherits exactly
  // the same zero headroom. Measured against the real tokens:
  //     --color-on-fill        #ffffff   5.03:1   passes
  //     --color-text-secondary #d1d1d1   3.29:1   FAILS
  //     text-white/90          #e6ebfd   4.23:1   FAILS
  // Only pure white is permitted on this band. It is listed separately from
  // `fill` even though the literal is identical, because the failure it guards
  // against is a different one: nobody puts secondary text on a question card,
  // and everybody is tempted to put it on a hero.
  ['band', '#2F61F7'],
];

let failed = 0;
let checked = 0;

for (const [label, surface] of SURFACES) {
  console.log(`\n${DIM}on ${label} ${surface}${RESET}`);

  for (const { cssVar, role, min, modes, surfaces } of CHECKS) {
    // `modes` used to gate a token to light or dark. There is one palette now,
    // so a token scoped to the theme that no longer exists is skipped rather
    // than checked against a surface it never sits on.
    if (modes && !modes.includes('dark')) continue;
    if (!(surfaces ?? DEFAULT_SURFACES).includes(label)) continue;

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

if (failed > 0 || paletteProblems.length > 0) {
  if (failed > 0) {
    console.error(
      `\n${RED}✗ ${failed} of ${checked} contrast checks failed${RESET}\n` +
        `${DIM}A colour below its floor is unreadable for someone, and nothing in the ` +
        `build will tell you.${RESET}`
    );
  }
  if (paletteProblems.length > 0) {
    console.error(
      `\n${RED}✗ ${paletteProblems.length} palette integrity problem(s)${RESET}\n` +
        `${DIM}Six CVD-validated hues in a fixed order is a non-negotiable. Re-run the ` +
        `dataviz validator before changing any of them — see styles/charts.css.${RESET}`
    );
  }
  process.exit(1);
}

console.log(
  `\n${GREEN}✓${RESET} all ${checked} contrast checks pass ${DIM}(WCAG AA)${RESET}, ` +
    `and the palette is its ${SERIES_COLORS.length} validated hues in order`
);
