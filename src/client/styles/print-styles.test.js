/**
 * What actually reaches paper.
 *
 * WHY THIS EXISTS
 *
 * The print block in globals.css is the only stylesheet in this project that
 * nobody ever looks at. It renders on a surface no screenshot shows, in a mode
 * no test opened, under a setting ("Background graphics") most readers leave
 * off — and the site's readers are economists, whose first instinct with a
 * well-argued page is to print it or save it as a PDF.
 *
 * It shipped three faults at once, and every one of them was invisible on
 * screen:
 *
 *   .opacity-0 { opacity: 1 }   forced the reveal bands on, correctly, and also
 *                               forced on the hover-only external-link arrows
 *                               in NewsList and Reading — an arrow beside every
 *                               headline promising an interaction paper cannot
 *                               honour
 *   .bg-white + .text-page      a white pill labelled in the colour of the page
 *                               behind it. Print makes the page white. Measured
 *                               in Chrome under @media print: rgb(255,255,255)
 *                               on rgb(255,255,255), 1.00:1 — the label was
 *                               gone on /login and on the error screen
 *   --color-on-fill: #000000    right when the fill is dropped (21:1 on paper),
 *                               wrong at 4.17:1 for the reader who prints
 *                               backgrounds, unless the fill is repointed too
 *
 * So the tests below re-derive the composites rather than reading the CSS for
 * reassurance: each one resolves the ink and the surface a reader would
 * actually see and computes the ratio between them, with the same WCAG
 * arithmetic `scripts/check-contrast.js` uses on the screen palette.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STYLES = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(STYLES, '..');

const globals = readFileSync(path.join(STYLES, 'globals.css'), 'utf8');
const atmos = readFileSync(path.join(STYLES, 'atmos.css'), 'utf8');

/**
 * The body of the `@media print` block.
 *
 * Matched by scanning braces rather than by a lazy regex: the block contains
 * nested rules, and `/@media print \{[\s\S]*?\}/` stops at the first inner
 * closing brace and silently checks the first four declarations only.
 */
function printBlock(css) {
  const start = css.indexOf('@media print');
  assert.notEqual(start, -1, 'globals.css has no @media print block at all');
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  throw new Error('the @media print block is not closed');
}

const PRINT = printBlock(globals);

/** WCAG 2.1 relative luminance and contrast — the arithmetic check-contrast.js uses. */
const channel = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
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

/** The last value a token is given inside `css`, or null. */
function tokenIn(css, name) {
  const found = [...css.matchAll(new RegExp(`${name}\\s*:\\s*(#[0-9a-f]{3,8})\\s*;`, 'gi'))];
  return found.length > 0 ? found[found.length - 1][1] : null;
}

/** What a token resolves to when printing: the print override, else the screen value. */
const printValue = (name) => tokenIn(PRINT, name) ?? tokenIn(atmos, name);

/**
 * Tailwind's own `--color-white`, which `bg-white` resolves through.
 *
 * It is not defined anywhere in this project — it is Tailwind's built-in — so
 * it is written here rather than read, and the test below asserts that the
 * print block does not repoint it, which is what would make this line a lie.
 */
const TAILWIND_WHITE = '#ffffff';

/** WCAG 2.1: 4.5:1 for body text. */
const TEXT = 4.5;

describe('@media print — the reveal, and only the reveal', () => {
  test('the forced opacity excludes svg', () => {
    assert.match(
      PRINT,
      /:not\(svg\)\.opacity-0\s*\{\s*opacity:\s*1\s*!important/,
      'the print block must force the reveal bands on without forcing on the ' +
        'hover-only icons that share the class'
    );
  });

  test('nothing forces every .opacity-0 on', () => {
    assert.doesNotMatch(
      PRINT,
      /(^|[\s,>+~])\.opacity-0\s*\{/m,
      'an unscoped .opacity-0 rule catches the hover-only external-link arrows too'
    );
  });

  test('the hover icons this is scoped around are still svg', () => {
    // If either of these stops being an icon component — a <span> with a glyph,
    // say — the `:not(svg)` scope silently stops protecting it and the arrows
    // come back. This is the assertion that notices.
    for (const file of ['components/NewsList.jsx', 'components/Reading.jsx']) {
      const source = readFileSync(path.join(CLIENT, file), 'utf8');
      assert.match(
        source,
        /<Ri[A-Za-z]+\s+className="[^"]*\bopacity-0\b[^"]*group-hover:opacity-100/,
        `${file} no longer hides its external-link icon with opacity-0 on a remixicon <svg>`
      );
    }
  });
});

describe('@media print — no ink the same colour as what is under it', () => {
  test('the inverted-ink pill buttons are legible on paper', () => {
    // `.bg-white.text-page`: a white pill whose label is the page colour. On
    // paper --color-page IS the paper, so the utility has to move instead.
    const repointed = PRINT.match(/\.text-page\s*\{[^}]*?color:\s*(#[0-9a-f]{3,8})/i);
    const ink = repointed ? repointed[1] : printValue('--color-page');
    assert.ok(ink, '.text-page resolves to nothing at all when printing');
    const ratio = contrast(ink, TAILWIND_WHITE);
    assert.ok(
      ratio >= TEXT,
      `.text-page on .bg-white prints ${ink} on ${TAILWIND_WHITE} — ${ratio.toFixed(2)}:1, under ${TEXT}`
    );
  });

  test('the print block does not repoint Tailwind\'s own white', () => {
    assert.doesNotMatch(
      PRINT,
      /--color-white\s*:/,
      'the pill surface above is asserted against Tailwind\'s #ffffff; repointing it makes that assertion wrong'
    );
  });

  test('text on a filled card is legible whether or not the fill prints', () => {
    const ink = printValue('--color-on-fill');
    const fill = printValue('--color-electric');
    assert.ok(ink && fill, 'either --color-on-fill or --color-electric resolves to nothing');

    // Backgrounds off (the default): the card is bare paper.
    const onPaper = contrast(ink, TAILWIND_WHITE);
    assert.ok(onPaper >= TEXT, `on-fill text prints ${ink} on paper — ${onPaper.toFixed(2)}:1`);

    // Backgrounds on: the card survives, and so must the text on it.
    const onCard = contrast(ink, fill);
    assert.ok(
      onCard >= TEXT,
      `on-fill text prints ${ink} on ${fill} when the reader prints backgrounds — ` +
        `${onCard.toFixed(2)}:1, under ${TEXT}`
    );
  });

  test('body text and the accent still clear the floor on white paper', () => {
    for (const token of ['--color-text-primary', '--color-text-secondary', '--color-text-tertiary', '--color-signal']) {
      const ink = printValue(token);
      assert.ok(ink, `${token} resolves to nothing when printing`);
      const ratio = contrast(ink, TAILWIND_WHITE);
      assert.ok(ratio >= TEXT, `${token} prints ${ink} on white — ${ratio.toFixed(2)}:1`);
    }
  });
});
