/**
 * The reader-facing pages: /explore, /news, /lens/:slug and /simulate/:slug.
 *
 * WHY THIS FILE EXISTS
 *
 * Four defects on these routes were the same defect: a rule this project
 * already enforces somewhere was not enforced here, and nothing would ever have
 * gone red about it. The palette ceiling was guarded in `ChartGroup` and not on
 * the one page whose whole purpose is composing a chart. The catalogue was
 * truncated at 40 rows next to a placeholder offering to search 134. The
 * country picker described a per-country model that is two thirds panel
 * averages. The simulation page told a reader "the charts underneath are
 * measured" and drew none of them.
 *
 * WHAT IS AND IS NOT COVERED, READ THIS BEFORE TRUSTING A GREEN RUN
 *
 * This repo has no DOM test runner — `npm test` is bare `node --test`, no jsdom
 * — so nothing here renders a component. Two techniques are used instead, both
 * borrowed from `components/charts/honesty.test.js`:
 *
 *   1. PURE DECISIONS are exported from the route files and evaluated out of
 *      their own source, so the test cannot drift into holding its own copy of
 *      the logic. These are real tests.
 *   2. WORDS A READER SEES are asserted by reading the source for a phrase.
 *      That catches a deletion and not a mistake — a source-check proves the
 *      sentence is still in the file, never that it renders or that it is true.
 *      Every one below is labelled `source-check` in its name.
 *
 * A test that has never failed has proved nothing, so each of these was written
 * by reintroducing the defect first and watching it go red.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const source = (path) => readFileSync(join(ROOT, path), 'utf8');

/**
 * The file with its comments removed.
 *
 * Needed for the "this sentence is gone" checks, which would otherwise pass or
 * fail on the note explaining why it went. Every fix in this package carries a
 * comment quoting the copy it replaced — that is the house style and it is
 * worth keeping — so the assertion has to look at what actually renders.
 *
 * Block comments only, plus line comments that own their whole line: a `//`
 * anywhere else could be inside a URL.
 */
function withoutComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const EXPLORE = 'src/client/routes/ExplorePage.jsx';
const NEWS_PAGE = 'src/client/routes/NewsPage.jsx';
const NEWS_LIST = 'src/client/components/NewsList.jsx';
const LENS = 'src/client/routes/LensPage.jsx';
const SIMULATION = 'src/client/routes/SimulationPage.jsx';

/**
 * Pull named `export function`s out of a .jsx file and evaluate them.
 *
 * Node cannot import JSX, and these functions are the decisions the pages are
 * accused of getting wrong. Reading them out of the file means a change to one
 * is caught here rather than passing against a copy kept in the test.
 *
 * Only functions with no imports in their bodies can travel this way, which is
 * why the exported ones are written that way deliberately.
 */
function evaluateExports(src, names, where) {
  const bodies = names.map((name) => {
    const match = src.match(new RegExp(`export function ${name}\\([\\s\\S]*?\\n\\}`));
    assert.ok(match, `${where} no longer exports a function called ${name}`);
    return match[0].replace('export ', '');
  });
  // eslint-disable-next-line no-new-func
  return new Function(`${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)();
}

const { seriesCap, nextChosen, pickMatches } = evaluateExports(
  source(EXPLORE),
  ['seriesCap', 'nextChosen', 'pickMatches'],
  EXPLORE
);

const { scenariosForLens } = evaluateExports(source(LENS), ['scenariosForLens'], LENS);

const {
  parameterSplit,
  paramMeta,
  paramValueText,
  flagOptions,
  drawnRows,
  deviationText,
  windowSlice,
  evidencePayload,
} = evaluateExports(
  source(SIMULATION),
  [
    'parameterSplit',
    'paramMeta',
    'paramValueText',
    'flagOptions',
    'drawnRows',
    'deviationText',
    'windowSlice',
    'evidencePayload',
  ],
  SIMULATION
);

// ---------------------------------------------------------------------------
// /explore — the palette ceiling, and the truncated catalogue
// ---------------------------------------------------------------------------

describe('/explore refuses to draw more series than there are validated hues', () => {
  test('the cap is the palette, not the endpoint — six, not twelve', () => {
    assert.equal(
      seriesCap(6, 12),
      6,
      'With six validated hues the honest maximum is six. Twelve is the number of ids ' +
        'the series endpoint will accept in one request, which is a fact about the API ' +
        'and not about whether the result can be read.'
    );
  });

  test('the lower of the two ceilings always wins', () => {
    assert.equal(seriesCap(6, 4), 4, 'a smaller server cap has to bind too');
    assert.equal(seriesCap(1, 12), 1, 'a palette of one draws one series');
  });

  test('the seventh series is refused', () => {
    const cap = seriesCap(6, 12);
    let chosen = [];
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f']) chosen = nextChosen(chosen, id, cap);
    assert.equal(chosen.length, 6);

    const after = nextChosen(chosen, 'g', cap);
    assert.deepEqual(
      after,
      chosen,
      'A seventh indicator would be drawn in the first one’s colour, with a legend ' +
        'showing two identical swatches for two different indicators. That is the ' +
        'exact failure ChartGroup was built to refuse after ISSUE-008.'
    );
    assert.ok(!after.includes('g'));
  });

  test('removing one always works, even at the cap', () => {
    const cap = seriesCap(6, 12);
    const full = ['a', 'b', 'c', 'd', 'e', 'f'];
    assert.deepEqual(nextChosen(full, 'c', cap), ['a', 'b', 'd', 'e', 'f']);
  });

  test('source-check: the refusal says why, in the words ChartGroup uses', () => {
    const src = source(EXPLORE);
    assert.match(src, /Not drawn: \{chosen\.length\} series on one pair of axes/);
    assert.match(src, /give different series\s*\n?\s*the same colour and a legend that says otherwise/);
    /*
     * The CALL, not the name. This asserted `/exceedsPalette/` against the whole
     * file, which the import line and the comment above it both satisfy — so
     * replacing the call with a hand-written `chosen.length > 6` left the test
     * green while the page stopped asking the shared question. A literal ceiling
     * here is the exact defect: it does not move when the palette does.
     */
    assert.match(
      withoutComments(src),
      /const tooManySeries = exceedsPalette\(chosen\.length, palette\);/,
      'ExplorePage has to ask the same question ChartGroup asks, from the same helper ' +
        'and against the same palette — not a number typed into this file'
    );
  });

  test('source-check: the doomed request is never sent', () => {
    assert.match(
      source(EXPLORE),
      /\{ enabled: !tooManySeries \}/,
      'A request the server will refuse spends a round trip to arrive at an error ' +
        'message written for an API caller rather than for a reader.'
    );
  });
});

/**
 * THE SENTENCE A READER GETS INSTEAD OF A CHART.
 *
 * `seriesCap` and `nextChosen` above prove the seventh series is refused. They
 * say nothing about the reader being TOLD, and the refusal copy was asserted
 * nowhere — rewriting all four lines of it, or deleting the paragraph outright,
 * left this file green.
 *
 * It is not decoration. A chart that cannot be drawn honestly refuses and says
 * why is one of this project's fixed rules, and at the picker the "says why" is
 * this paragraph and nothing else: the reader has clicked a seventh row, the
 * row has not responded, and every other row in the list has gone dead at the
 * same moment. Without the sentence that reads as a broken page, and the
 * obvious repair for a broken page is to remove the ceiling.
 *
 * Whitespace is flattened before matching because the copy is JSX and wraps
 * wherever the formatter puts it; the words and the interpolations are the
 * assertion, not the line breaks.
 */
describe('/explore tells the reader why the seventh row stopped responding', () => {
  const rendered = withoutComments(source(EXPLORE));
  const flat = rendered.replace(/\s+/g, ' ');

  /** The refusal paragraph itself, from the `atCap` guard to its close. */
  const atCapBlock = flat.match(/\{atCap && \(.*?\)\}/)?.[0];
  /* Styling stripped: `mt-4` and `p-3` are spacing, not figures, and the
     "nothing is typed" assertion below is about the sentence. */
  const atCapCopy = (atCapBlock ?? '').replace(/className="[^"]*"/g, '');

  test('source-check: there is a refusal at the picker, not only at the chart', () => {
    assert.ok(
      atCapBlock,
      'ExplorePage must render something when `atCap` is true. The refusal lower ' +
        'down covers a state the picker makes unreachable; this one covers the state ' +
        'a reader actually arrives in by clicking.'
    );
    assert.match(
      flat,
      /const atCap = chosen\.length >= maxSeries;/,
      'the condition has to be the cap the picker enforces, not a second opinion'
    );
  });

  test('source-check: the rows really do stop responding, so the sentence explains something', () => {
    // Without this the paragraph could be describing a limit that is not applied,
    // which is worse than no paragraph: it tells the reader a true thing about a
    // page that is doing something else.
    assert.match(flat, /disabled=\{atCap && !isChosen\}/);
  });

  test('source-check: it states the ceiling and the reason in one breath', () => {
    assert.match(
      atCapBlock ?? '',
      /\{maxSeries\} is the most this chart can carry: there are \{palette\.length\}\{' '\} colourblind-validated colours and they are never repeated/,
      'The number and the reason travel together. "Up to 6" on its own reads as an ' +
        'arbitrary product limit, which invites someone to raise it.'
    );
  });

  test('source-check: it says what drawing it anyway would do to the chart', () => {
    assert.match(
      atCapBlock ?? '',
      /because two indicators drawn in one colour with a legend claiming otherwise is a chart that lies about which line is which/,
      'This is the whole argument. ChartGroup, FigureChart and the chart-level ' +
        'refusal below all make it; the picker is where the reader meets it first.'
    );
  });

  test('source-check: it tells the reader the way out', () => {
    assert.match(
      atCapBlock ?? '',
      /Remove one to add another\./,
      'A refusal with no next action is indistinguishable from a bug.'
    );
  });

  test('source-check: both figures in it are read from the code, never typed', () => {
    /*
     * The defect this forecloses is the one already caught twice on this page:
     * "Search 110 indicators…" was a literal while the catalogue held 128, and
     * "Sources 24" was a literal on the front page. A hardcoded 6 here rots the
     * first time the palette changes, and it rots into a sentence claiming a
     * ceiling the code is not applying.
     */
    assert.doesNotMatch(
      atCapCopy,
      /\d/,
      'every number in the refusal must be an interpolation — {maxSeries} and {palette.length}'
    );
    assert.match(
      flat,
      /Up to \{maxSeries\} at once — one for each colourblind-validated hue\./,
      'the same promise, made before the reader reaches the ceiling'
    );
  });
});

describe('/explore says how much of the catalogue it is showing', () => {
  const catalogue = Array.from({ length: 134 }, (_, i) => ({
    id: `ind.${i}`,
    name: `Indicator ${i}`,
    pillar: i % 2 === 0 ? 'labour' : 'prices',
  }));

  test('the unsearched list is capped, and admits it', () => {
    const found = pickMatches(catalogue, '', 40);
    assert.equal(found.rows.length, 40);
    assert.equal(found.total, 134);
    assert.equal(
      found.capped,
      true,
      'The list is a max-h-72 scroller showing about six rows at a time. A reader who ' +
        'scrolls to the end of it has no way to know it stopped 94 indicators short.'
    );
  });

  test('a search lifts the cap outright', () => {
    const found = pickMatches(catalogue, 'labour', 40);
    assert.equal(found.matched, 67);
    assert.equal(found.rows.length, 67, 'a reader who has typed a term has narrowed it themselves');
    assert.equal(found.capped, false);
  });

  test('matching is on name, id and pillar, and is case-insensitive', () => {
    assert.equal(pickMatches(catalogue, 'INDICATOR 77', 40).matched, 1);
    assert.equal(pickMatches(catalogue, 'ind.133', 40).matched, 1);
    assert.equal(pickMatches(catalogue, '  prices  ', 40).matched, 67);
  });

  test('nothing matching is nothing shown, not the whole catalogue', () => {
    const found = pickMatches(catalogue, 'zzzz', 40);
    assert.deepEqual(found.rows, []);
    assert.equal(found.capped, false);
  });

  test('an absent catalogue does not throw', () => {
    assert.deepEqual(pickMatches(undefined, '', 40), {
      rows: [],
      matched: 0,
      total: 0,
      capped: false,
    });
  });

  test('source-check: the count is rendered under the list', () => {
    assert.match(source(EXPLORE), /Showing the first \$\{found\.rows\.length\} of \$\{found\.total\} indicators/);
  });
});

// ---------------------------------------------------------------------------
// /news
// ---------------------------------------------------------------------------

describe('/news', () => {
  test('source-check: the relevance chip carries a word, not just a colour', () => {
    const src = source(NEWS_LIST);
    assert.match(
      src,
      /relevance \{doc\.ai_relevance\}/,
      'The chip showed a bare integer tinted lime, yellow or neutral, with the only ' +
        'explanation in a title attribute — invisible on touch, inconsistent to a ' +
        'screen reader, so the colour was doing all of the work.'
    );
  });

  test('source-check: the scale is defined once under the h1', () => {
    assert.match(source(NEWS_PAGE), /relevance figure out of 100/);
    assert.match(source(NEWS_PAGE), /keyword score/);
  });

  test('source-check: the empty state is not an instruction to the operator', () => {
    const src = withoutComments(source(NEWS_PAGE));
    assert.doesNotMatch(
      src,
      /Run the RSS ingestion/,
      'A reader was told to run a command on a server they do not have.'
    );
    assert.match(src, /No articles are stored yet\./);
    assert.match(src, /to="\/pipeline"/, 'the reader needs somewhere to go to see when it last ran');
  });

  test('source-check: the outline no longer runs H1 straight to H3', () => {
    assert.match(source(NEWS_PAGE), /<h2 className="mb-4 text-title-3-medium text-text-primary">/);
  });
});

// ---------------------------------------------------------------------------
// /lens/:slug
// ---------------------------------------------------------------------------

describe('/lens/:slug offers the scenario a reader could not otherwise reach', () => {
  const scenarios = [
    { slug: 'ai-capex-dotcom', name: 'AI capex today', horizon_years: 5 },
    { slug: 'something-else', name: 'Another scenario', horizon_years: 3 },
  ];
  const map = { investment: ['ai-capex-dotcom'] };

  test('the capex scenario appears on the investment lens', () => {
    const offered = scenariosForLens(scenarios, 'investment', map);
    assert.deepEqual(offered.map((s) => s.slug), ['ai-capex-dotcom']);
  });

  test('a lens with no ruling offers nothing', () => {
    assert.deepEqual(scenariosForLens(scenarios, 'labour', map), []);
  });

  test('a slug in the map with no published scenario behind it is not a dead link', () => {
    assert.deepEqual(
      scenariosForLens([{ slug: 'something-else' }], 'investment', map),
      [],
      'A draft scenario is absent from /api/simulations, and the card must fail closed.'
    );
  });

  test('an absent scenario list does not throw while the query is in flight', () => {
    assert.deepEqual(scenariosForLens(undefined, 'investment', map), []);
  });

  test('source-check: the link is really rendered', () => {
    assert.match(source(LENS), /to=\{`\/simulate\/\$\{scenario\.slug\}`\}/);
  });

  test('source-check: both eyebrow-only sections have real headings', () => {
    const src = source(LENS);
    assert.match(src, /prices are tracked under this lens/);
    assert.match(src, /<h2 className="mt-3 text-title-1-medium text-text-primary">What is being reported<\/h2>/);
  });
});

// ---------------------------------------------------------------------------
// /simulate/:slug — what the country picker actually changes
// ---------------------------------------------------------------------------

/** The four countries' rows as the API returns them, values verified by query. */
const PARAMETERS = [
  ['fiscal_multiplier_y1', { USA: 0.457, FRA: 0.457, ITA: 0.457, JPN: 0.457 }],
  ['fiscal_multiplier_y2', { USA: 0.755, FRA: 0.755, ITA: 0.755, JPN: 0.755 }],
  ['fiscal_multiplier_y3', { USA: 1.035, FRA: 1.035, ITA: 1.035, JPN: 1.035 }],
  ['fiscal_multiplier_y4', { USA: 1.389, FRA: 1.389, ITA: 1.389, JPN: 1.389 }],
  ['fiscal_multiplier_y5', { USA: 1.539, FRA: 1.539, ITA: 1.539, JPN: 1.539 }],
  ['gdp_usd_bn', { USA: 29298, FRA: 3160.4, ITA: 2383.4, JPN: 4190 }],
  ['inflation_anchor', { USA: 2, FRA: 2, ITA: 2, JPN: 2 }],
  ['okun_coefficient', { USA: -0.563, FRA: -0.37, ITA: -0.217, JPN: -0.151 }],
  ['price_phillips_slope', { USA: 0.11, FRA: 1, ITA: 0.37, JPN: 0.69 }],
  ['unemployment_baseline', { USA: 4.02, FRA: 7.4, ITA: 6.5, JPN: 2.5 }],
  ['wage_persistence', { USA: 0.65, FRA: 0.65, ITA: 0.65, JPN: 0.65 }],
  ['wage_phillips_slope', { USA: 0.13, FRA: 0.13, ITA: 0.13, JPN: 0.13 }],
  ['wage_price_passthrough', { USA: 0.33, FRA: 0.33, ITA: 0.33, JPN: 0 }],
].flatMap(([param_key, byCountry]) =>
  Object.entries(byCountry).map(([country_iso3, value]) => ({ param_key, country_iso3, value }))
);

describe('/simulate/:slug says which coefficients the country picker moves', () => {
  test('five of thirteen vary; eight are the same number for every country', () => {
    const split = parameterSplit(PARAMETERS);
    assert.deepEqual(split.varying.sort(), [
      'gdp_usd_bn',
      'okun_coefficient',
      'price_phillips_slope',
      'unemployment_baseline',
      'wage_price_passthrough',
    ]);
    assert.equal(split.shared.length, 8);
    assert.equal(split.varying.length + split.shared.length, 13);
  });

  test('inflation_anchor is shared, whatever the seed header says', () => {
    const split = parameterSplit(PARAMETERS);
    assert.ok(
      split.shared.includes('inflation_anchor'),
      'The seed header lists inflation_anchor as per-country. Every country carries 2.0, ' +
        'so the header is wrong and the rows are right — which is exactly why this is ' +
        'derived from the rows rather than written down.'
    );
  });

  test('a coefficient that differs for one country only still counts as varying', () => {
    const split = parameterSplit(PARAMETERS);
    assert.ok(
      split.varying.includes('wage_price_passthrough'),
      'Japan carries 0 against 0.33 everywhere else — Hoshi & Kashyap. Switching to ' +
        'Japan does move it, so a reader must not be told it is shared.'
    );
  });

  test('a key present for one country only is shared, not varying', () => {
    const split = parameterSplit([{ param_key: 'lonely', country_iso3: 'USA', value: 1 }]);
    assert.deepEqual(split, { varying: [], shared: ['lonely'] });
  });

  test('0 and "0" from two drivers are not a difference', () => {
    const split = parameterSplit([
      { param_key: 'k', country_iso3: 'USA', value: 0 },
      { param_key: 'k', country_iso3: 'FRA', value: '0' },
    ]);
    assert.deepEqual(split.varying, []);
  });

  test('source-check: the picker no longer claims a per-country model', () => {
    const src = withoutComments(source(SIMULATION));
    assert.doesNotMatch(
      src,
      /Each country carries its own\s*\n?\s*published estimates/,
      'Two thirds of the model does not move when the picker moves.'
    );
    assert.match(src, /hold the same value for every country here/);
    assert.match(
      src,
      /\{split\.varying\.length\} of the \{split\.varying\.length \+ split\.shared\.length\}/,
      'The counts have to come from the rows, not from a sentence somebody typed.'
    );
  });
});

describe('/simulate/:slug names its coefficients in English and gives them units', () => {
  test('every parameter key in the database has a plain-language name', () => {
    const keys = [...new Set(PARAMETERS.map((p) => p.param_key))];
    for (const key of keys) {
      const meta = paramMeta(key);
      assert.notEqual(meta.label, key, `${key} still renders as its own database key`);
      assert.ok(meta.short.length > 0, `${key} has no short form for the picker's sentence`);
      assert.ok(meta.unit.length > 0, `${key} has no unit`);
    }
  });

  test('the multiplier profile is named year by year', () => {
    assert.equal(paramMeta('fiscal_multiplier_y1').label, 'Output added per unit of spending, year 1');
    assert.equal(paramMeta('fiscal_multiplier_y5').label, 'Output added per unit of spending, year 5');
  });

  test('an unknown key falls back to itself rather than to a guess', () => {
    assert.equal(paramMeta('something_new').label, 'something_new');
  });

  test('the two values that carried no unit now carry one', () => {
    assert.equal(paramValueText(29298, paramMeta('gdp_usd_bn').symbol), '$29,298bn');
    assert.equal(paramValueText(2, paramMeta('inflation_anchor').symbol), '2%');
    assert.equal(paramValueText(4.02, paramMeta('unemployment_baseline').symbol), '4.02%');
  });

  test('a ratio gets no invented notation', () => {
    assert.equal(paramValueText(0.457, paramMeta('fiscal_multiplier_y1').symbol), '0.457');
    assert.equal(paramValueText(-0.563, paramMeta('okun_coefficient').symbol), '-0.563');
  });

  test('a missing bound renders as a dash, never as 0', () => {
    assert.equal(paramValueText(null, 'percent'), '—');
    assert.equal(paramValueText(undefined, null), '—');
  });
});

describe('/simulate/:slug renders a flag as a choice, not as a two-position slider', () => {
  const sustained = {
    key: 'sustained',
    unit: 'flag',
    min_value: 0,
    max_value: 1,
    step: 1,
    default_value: 0,
  };

  test('sustained gets two named options', () => {
    assert.deepEqual(flagOptions(sustained), [
      { value: 0, label: 'One year only' },
      { value: 1, label: 'Every year' },
    ]);
  });

  test('a slider is still a slider', () => {
    assert.equal(
      flagOptions({ key: 'shock_usd_bn', unit: 'usd_bn', min_value: 0, max_value: 1000, step: 10 }),
      null
    );
  });

  test('it is the UNIT that makes a flag, not the arithmetic', () => {
    /*
     * The fixture above cannot fail on the unit: 1000 - 0 is not 10, so the
     * two-position arithmetic check refuses it whether or not `unit === 'flag'`
     * is ever consulted. Deleting that guard left this suite green.
     *
     * This one satisfies the arithmetic exactly — one step from 0 to 1 — so the
     * unit is the only thing left to decide. A real range control drawn as a
     * pair of radio buttons labelled No/Yes is a different question from the one
     * the model was asked: `shock_usd_bn` at 0 or 1 is nought or one billion
     * dollars, not "no" or "yes".
     */
    assert.equal(
      flagOptions({ key: 'shock_usd_bn', unit: 'usd_bn', min_value: 0, max_value: 1, step: 1 }),
      null,
      'a one-step numeric range is still a quantity, and must not become No/Yes'
    );
  });

  test('a flag with more than two positions stays a slider rather than losing one', () => {
    assert.equal(
      flagOptions({ key: 'tri', unit: 'flag', min_value: 0, max_value: 2, step: 1 }),
      null,
      'Three positions drawn as two would silently drop one of them.'
    );
  });

  test('an unrecognised flag gets No/Yes rather than a guess at its meaning', () => {
    assert.deepEqual(flagOptions({ key: 'other', unit: 'flag', min_value: 0, max_value: 1, step: 1 }), [
      { value: 0, label: 'No' },
      { value: 1, label: 'Yes' },
    ]);
  });
});

describe('/simulate/:slug states how far the projection actually moves', () => {
  /* USA at the $100bn one-off default, from the model: baseline 4.02, and the
     five projected years. The point of the sentence is that this is small. */
  const usaDefault = [
    { year: 1, unemployment_pct: 3.93 },
    { year: 2, unemployment_pct: 3.87 },
    { year: 3, unemployment_pct: 3.82 },
    { year: 4, unemployment_pct: 3.75 },
    { year: 5, unemployment_pct: 3.72 },
  ];

  test('the size of the gap is stated, so a flat-looking chart is explained', () => {
    const text = deviationText(usaDefault, 'unemployment_pct', 'Unemployment', 4.02);
    assert.equal(
      text,
      'Across the 5 years drawn, unemployment moves at most 0.3 percentage points from the no-injection line.'
    );
  });

  test('a deviation series with no published baseline is measured from zero', () => {
    const text = deviationText(
      [{ output_gap_pp: 0.16 }, { output_gap_pp: 0.53 }],
      'output_gap_pp',
      'Output',
      undefined
    );
    assert.match(text, /from zero\.$/);
    assert.match(text, /0\.53 percentage points/);
  });

  test('one percentage point is not "1 percentage points"', () => {
    const text = deviationText([{ x: 5 }], 'x', 'Inflation', 4);
    assert.match(text, /1 percentage point from/);
    assert.match(text, /^Across the year drawn/);
  });

  test('rounding never shows precision the engine did not produce', () => {
    const text = deviationText([{ x: 4.123456 }], 'x', 'Inflation', 0);
    assert.match(text, /4\.12 percentage points/);
  });

  test('nothing drawn means nothing claimed', () => {
    assert.equal(deviationText([], 'x', 'Inflation', 0), null);
    assert.equal(deviationText(undefined, 'x', 'Inflation', 0), null);
  });

  test('the sentence describes the years drawn, not the years asked for', () => {
    const run = {
      years: [{ year: 1 }, { year: 2 }, { year: 3 }, { year: 4 }, { year: 5 }],
      validity: { ok: false, first_invalid_year: 3 },
    };
    assert.deepEqual(drawnRows(run).map((y) => y.year), [1, 2]);
  });

  test('an absent validity is a run that passed, never one that failed', () => {
    const run = { years: [{ year: 1 }, { year: 2 }] };
    assert.equal(drawnRows(run).length, 2);
  });
});

describe('/simulate/:slug draws the measured series it says are underneath it', () => {
  /* Shaped exactly as `scenarioEvidence()` returns it — dates named `period`. */
  const semis = {
    id: 'fred.PCU334413334413',
    name: 'PPI by Industry: Semiconductor and Related Device Manufacturing',
    unit: 'Index Dec 1998=100',
    confidence_tier: 'official',
    points: [
      { period: '1990-01-01', value: 153.4 },
      { period: '1995-01-01', value: 135.1 },
      { period: '2002-12-01', value: 80.4 },
      { period: '2026-07-01', value: 28.987 },
    ],
  };

  test('the evidence shape becomes the shape SeriesChart draws', () => {
    const payload = evidencePayload(semis);
    assert.equal(payload.indexed, false, 'these are levels; nothing rebased them');
    assert.equal(payload.series.length, 1);
    assert.equal(payload.series[0].meta.name, semis.name);
    assert.equal(payload.series[0].meta.unit, semis.unit);
    assert.deepEqual(payload.series[0].points[0], { date: '1990-01-01', value: 153.4 });
    assert.equal(
      payload.series[0].points.every((p) => 'date' in p),
      true,
      'The evidence endpoint names its dates `period` and the chart reads `date`. ' +
        'That one word is the whole reason four real series were fetched and discarded.'
    );
  });

  test('the dot-com window is read off the points, never typed', () => {
    const window = windowSlice(semis.points, '1995-01-01', '2002-12-31');
    assert.equal(window.count, 2);
    assert.equal(window.first.value, 135.1);
    assert.equal(window.last.value, 80.4);
  });

  test('an unbounded call gives the whole span', () => {
    const span = windowSlice(semis.points);
    assert.equal(span.count, 4);
    assert.equal(span.first.period, '1990-01-01');
    assert.equal(span.last.period, '2026-07-01');
  });

  test('a window with no readings is null, not an empty flourish', () => {
    assert.equal(windowSlice(semis.points, '2010-01-01', '2011-01-01'), null);
    assert.equal(windowSlice([]), null);
  });

  test('a gap in the series is not counted as a reading', () => {
    const withHole = [
      { period: '1996-01-01', value: null },
      { period: '1997-01-01', value: 12 },
    ];
    const window = windowSlice(withHole, '1995-01-01', '2002-12-31');
    assert.equal(window.count, 1);
    assert.equal(window.first.value, 12);
  });

  test('source-check: the measured half is rendered and the units are not merged', () => {
    const src = source(SIMULATION);
    assert.match(src, /<MeasuredHalf series=\{evidence\?\.series\}/);
    assert.match(
      src,
      /Each series gets its own chart because their units\s*\n?\s*differ/,
      'Four units cannot share one pair of axes and this site has no second axis.'
    );
  });

  test('source-check: the four outputs of the model are all offered', () => {
    const src = source(SIMULATION);
    for (const key of ['output_gap_pp', 'unemployment_pct', 'wage_growth_gap_pp', 'inflation_pct']) {
      assert.ok(
        src.includes(`key: '${key}'`),
        `${key} is computed for every year and was not offered — the reader could see ` +
          'three of the four outputs and not the one the others derive from.'
      );
    }
  });

  test('source-check: the strongest warning on the site is reachable by heading', () => {
    assert.match(
      source(SIMULATION),
      /<h2 className="text-body-medium text-text-primary">What this cannot tell you<\/h2>/
    );
  });
});
