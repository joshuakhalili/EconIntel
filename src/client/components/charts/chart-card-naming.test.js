/**
 * Every chart card is a named figure.
 *
 * WHY THIS IS A SOURCE CHECK AND NOT A RENDER
 *
 * The thing being asserted is an accessible name, and node has no accessibility
 * tree. It was measured instead, in Chrome 141 headless, reading the name back
 * out over CDP (`Accessibility.getPartialAXTree`) from the real component's
 * `renderToStaticMarkup` output:
 *
 *   <figure><figcaption>A plain visible caption</figcaption>…      name ""
 *   ChartCard with a title, before this change                     name ""
 *   ChartCard label + caption, aria-labelledby the figcaption       name "Japan
 *                                                                   — Employed
 *                                                                   Persons A
 *                                                                   placement
 *                                                                   caption…"
 *   ChartCard label only, no stored caption                        name "US
 *                                                                   Industrial
 *                                                                   Production"
 *
 * Two things follow from that first line, and only one of them is obvious.
 * HTML-AAM says a `<figure>` is named by its `<figcaption>`; Chrome does not
 * implement it, so every chart on this site was an unnamed region in the
 * browser most readers arrive in — not only `/data/:id`, which had lost its
 * figcaption entirely. The attribute is the mechanism, not a belt-and-braces.
 *
 * So what a test can hold in place is the wiring that produced those names, and
 * that is what is below.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.resolve(HERE, '../..');

const read = (relative) => readFileSync(path.join(CLIENT, relative), 'utf8');

/** Comments describe the intent; the assertions are about the code. */
const withoutComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('ChartCard — the figure carries its own name', () => {
  const source = withoutComments(read('components/charts/ChartCard.jsx'));

  test('the figure points at its figcaption', () => {
    assert.match(source, /<figure\b[\s\S]{0,120}aria-labelledby=\{/);
    assert.match(source, /<figcaption\b[^>]*\bid=\{captionId\}/);
  });

  test('the id is generated per instance', () => {
    // A hard-coded id would collide on /q/adoption, which renders several
    // cards, and aria-labelledby would resolve every figure to the first one.
    assert.match(source, /import \{ useId \} from 'react'/);
    assert.match(source, /const captionId = useId\(\)/);
  });

  test('a card with no visible title is still named', () => {
    // `label` is the name for a card that must not emit a heading; sr-only
    // keeps it out of the layout and in the name computation.
    assert.match(source, /className="sr-only"[^>]*>\{label\}|>\{label\}<\/span>/);
    assert.match(source, /const named = title \|\| label \|\| caption/);
  });
});

describe('/data/:id — named without a second heading', () => {
  const source = withoutComments(read('routes/IndicatorPage.jsx'));

  test('the card is given a label', () => {
    assert.match(source, /<ChartCard[\s\S]{0,120}label=\{indicator\.name\}/);
  });

  test('the card is not given a title', () => {
    // ChartCard emits an h3 for a title, and the h1 already says the same
    // words — see first-figures.test.js, which asserts the same thing from the
    // heading-outline side.
    assert.doesNotMatch(source, /<ChartCard[\s\S]{0,120}title=/);
  });

  test('the editorial caption is the figure caption, not a footer line', () => {
    assert.match(source, /<ChartCard[\s\S]{0,160}caption=\{caption\}/);
    assert.match(source, /footer=\{indicator\.source_name\}/);
  });
});
