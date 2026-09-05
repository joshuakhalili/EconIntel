/**
 * What a prerendered shell is allowed to say about its page.
 *
 * WHY THIS EXISTS
 *
 * `scripts/build-static.js` writes the `<meta name="description">` and
 * `og:description` for 170 pages. Nobody reads those in review — they are one
 * attribute on line 6 of a 4KB shell — and they are the only version of the
 * page a search result, a social card or an archive ever shows. Two rounds of
 * this project shipped descriptions that were wrong in ways nothing could
 * catch:
 *
 *   a character-count cut  ended a description "…is 3.8% — both well" and
 *                          published the fragment
 *   a clean full stop      ended /q/entry-level one sentence before "But
 *                          several studies … say otherwise" and /q/vacancies
 *                          one sentence before "The OECD … finds the opposite",
 *                          so both cards asserted the opposite of their page
 *   an empty string        three of the 140 series shells shipped
 *                          `content=""`, a page claiming it has nothing to say
 *
 * Every test below fixes one of those in place. The prose fixtures are short
 * and synthetic on purpose: the real editorial text changes with every seed
 * run, and a test that has to be edited when the copy changes stops being run.
 * The shapes are the shapes the real text has.
 *
 * WHY IT LIVES UNDER src/server RATHER THAN NEXT TO THE SCRIPT
 *
 * `npm test` runs `node --test "src/**\/*.test.js"`, so a test file outside
 * `src` would not run — the same reason `gate-scripts.test.js` sits here.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  describe as metaDescription,
  describeIndicator,
  shellFor,
} from '../../scripts/build-static.js';

const SHELL = '<html><head><title>Diffusion</title>\n</head><body></body></html>';

describe('a description is made of whole sentences', () => {
  test('the lead is punctuated, because a subtitle is a label and not a sentence', () => {
    assert.equal(
      metaDescription('Vacancies in the most exposed sector', null),
      'Vacancies in the most exposed sector.'
    );
  });

  test('a sentence that does not fit is dropped, not cut', () => {
    const out = metaDescription('Lead', 'Short one. This second sentence is far too long to fit.', 20);
    assert.equal(out, 'Lead. Short one.');
  });

  test('a decimal is not a sentence end', () => {
    const out = metaDescription(null, 'Unemployment is 3.8% today. It was 8.5% in 2020.', 40);
    assert.equal(out, 'Unemployment is 3.8% today.');
  });

  test('the lead survives even when it is longer than the budget', () => {
    // Losing the lead would leave the page with no description at all, which is
    // the failure this whole file exists to stop.
    const out = metaDescription('A subtitle longer than the budget it is given', 'Ignored.', 10);
    assert.equal(out, 'A subtitle longer than the budget it is given.');
  });
});

describe('a description never stops one sentence before its own reversal', () => {
  // The shape of /q/entry-level: an answer, its evidence, then the sentence
  // that overturns both.
  const REVERSED =
    'These series say not yet. Youth unemployment is well below its 2020 peak. ' +
    'But several studies measuring at a finer grain say otherwise.';

  test('the prose is dropped whole when what was cut reverses what was kept', () => {
    const out = metaDescription('Youth and graduate employment', REVERSED, 90);
    assert.equal(out, 'Youth and graduate employment.');
  });

  test('nothing is dropped when the whole reversal fits', () => {
    const out = metaDescription('Youth and graduate employment', REVERSED, 400);
    assert.match(out, /But several studies/);
  });

  // /q/vacancies reverses without a connective: "The OECD … finds the opposite".
  test('a reversal that does not open the sentence is caught too', () => {
    const out = metaDescription(
      'Vacancies in the most exposed sector',
      'This is where the clearest signal is. The OECD finds the opposite across its members.',
      // Wide enough that the first sentence fits: without the reversal check
      // this returns the subtitle AND the claim the next sentence overturns.
      100
    );
    assert.equal(out, 'Vacancies in the most exposed sector.');
  });

  test('a continued negation is not a reversal', () => {
    // /q/clerical ends "Both show a long decline … Neither shows one
    // accelerating" — agreement, not contradiction, and the description that
    // stops before it is accurate.
    const out = metaDescription(
      'Counted two ways',
      'Not on this evidence. Both show a long decline that began well before AI. Neither shows one accelerating.',
      60
    );
    assert.equal(out, 'Counted two ways. Not on this evidence.');
  });
});

describe('a series description is never empty', () => {
  test('a single stored sentence longer than the budget falls back to name and unit', () => {
    // Three of the 140 series are exactly this: one sentence, no full stop
    // until the end of it, longer than the budget — so no whole sentence of it
    // can be quoted and the shells shipped `content=""`.
    const out = describeIndicator(
      {
        name: 'Japan — Employed Persons',
        unit: 'Tens of thousands of persons',
        description: `${'A single unbroken sentence about this series, '.repeat(8)}and then it ends.`,
      },
      120
    );
    assert.equal(out, 'Japan — Employed Persons. Unit: Tens of thousands of persons.');
  });

  test('a build note is not published as the page summary', () => {
    // `readerDescription` already does this on screen; without it here, one
    // shipped shell told anyone who shared the link that the series "renders on
    // a diverging palette".
    const out = describeIndicator({
      name: 'GDP growth',
      unit: 'percent',
      description:
        'Annual percentage growth of real GDP. A change-type series, so it renders on a diverging palette.',
    });
    assert.equal(out, 'Annual percentage growth of real GDP. Unit: percent.');
  });

  test('the unit trails the prose rather than leading it', () => {
    const out = describeIndicator({ name: 'Copper', unit: 'USD per tonne', description: 'The price of copper.' });
    assert.equal(out, 'The price of copper. Unit: USD per tonne.');
  });
});

describe('the shell never claims to have nothing to say', () => {
  test('a description is written when there is one', () => {
    const html = shellFor(SHELL, {
      title: 'A page',
      description: 'What it is about.',
      url: 'https://example.test/x',
      type: 'article',
    });
    assert.match(html, /<meta name="description" content="What it is about\.">/);
    assert.match(html, /<meta property="og:description" content="What it is about\.">/);
    assert.match(html, /<meta name="twitter:description" content="What it is about\.">/);
  });

  test('all three description tags are absent rather than empty', () => {
    const html = shellFor(SHELL, {
      title: 'A page',
      description: '',
      url: 'https://example.test/x',
      type: 'article',
    });
    assert.doesNotMatch(html, /name="description"/);
    assert.doesNotMatch(html, /og:description/);
    assert.doesNotMatch(html, /twitter:description/);
    // The rest of the head is still written — an absent description is not an
    // excuse to ship a page with no title or canonical either.
    assert.match(html, /<title>A page<\/title>/);
    assert.match(html, /<link rel="canonical" href="https:\/\/example\.test\/x">/);
  });

  test('a description containing $& is written literally, not as a backreference', () => {
    // `String.replace` reads `$&` in a replacement string as "the whole match",
    // so a description containing it used to splice `</head>` into the page.
    const html = shellFor(SHELL, {
      title: 'T',
      description: 'Costs $& rising.',
      url: 'https://example.test/x',
      type: 'website',
    });
    assert.match(html, /content="Costs \$&amp; rising\.">/);
    assert.doesNotMatch(html, /content="Costs <\/head>/);
  });
});
