/**
 * The numbers a reader sees first: /overview, /pipeline, /data and /data/:id.
 *
 * WHY THIS FILE EXISTS
 *
 * Every defect it guards is the same defect wearing different clothes — a
 * figure on screen that says more than the data behind it does.
 *
 *   • "Sources 24" was a string literal on the front page of a site whose
 *     pitch is that nothing is typed, while /pipeline listed 17, /data
 *     reported 8 and the register held 25 rows.
 *   • "Countries 50" was `count(*)` over a dimension table in which six rows
 *     are aggregates.
 *   • "Rules in force ↓ 90.0%" compared three days of September against the
 *     whole of August.
 *   • "↑ 22.4%" on the overview and "↑ 11.2pp" on the lens, for one series.
 *   • "Nothing is late. Every active series has run inside its own cadence",
 *     printed while more than half the catalogue held nothing newer than a
 *     year.
 *   • Build notes addressed to a programmer, rendered as the subtitle under
 *     the h1 of every series page.
 *
 * WHAT IS AND IS NOT COVERED — READ THIS BEFORE TRUSTING A GREEN RUN
 *
 * This repo has no DOM test runner (`npm test` is bare `node --test`, no
 * jsdom), so nothing here renders a component. The arithmetic itself is tested
 * properly, as pure functions, in `components/periodModel.test.js` and
 * `components/indicatorProse.test.js`. What is left is the WIRING — that these
 * routes call those functions and do not print the raw figure beside them —
 * and that can only be asserted by reading the source. Those assertions are
 * labelled `source-check` and they are weaker than they look: a source-check
 * catches a deletion, never a mistake. It proves the call is still in the file,
 * not that it renders or that it is right.
 *
 * The technique and the `withoutComments` helper are borrowed from
 * `components/charts/honesty.test.js` and `routes/reader-pages.test.js`, which
 * solve the same problem. Every assertion below was written by reintroducing
 * the defect and watching it go red.
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
 * Every fix in this package carries a comment quoting the copy or the literal
 * it replaced — that is the house style and it is worth keeping — so a "this
 * is gone" assertion has to look at what actually renders, or the note
 * explaining the fix fails the test for the fix.
 */
function withoutComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const OVERVIEW = 'src/client/routes/OverviewPage.jsx';
const PIPELINE = 'src/client/routes/PipelinePage.jsx';
const DATA = 'src/client/routes/DataPage.jsx';
const INDICATOR = 'src/client/routes/IndicatorPage.jsx';
const TICKER = 'src/client/components/TickerStrip.jsx';

describe('/overview — the figure row is looked up, not typed', () => {
  const rendered = withoutComments(source(OVERVIEW));

  test('source-check: the hardcoded 24 is gone', () => {
    // Quoted or bare: `['Sources', '24']` and `['Sources', 24,` are the same
    // defect, and the second is what a careless "fix" looks like.
    assert.doesNotMatch(rendered, /'Sources',\s*'?\d/);
    assert.doesNotMatch(rendered, /'Countries',\s*'?\d/);
  });

  test('source-check: sources and countries come from the status counts', () => {
    assert.match(rendered, /counts\?\.sources_supplying/);
    assert.match(rendered, /counts\?\.sources_registered/);
    assert.match(rendered, /counts\?\.countries_with_data/);
    assert.match(rendered, /counts\?\.countries_with_depth/);
  });

  test('source-check: the row-count "countries" figure is not rendered', () => {
    // `counts.countries` is count(*) over a dimension table, six rows of which
    // are aggregates. The endpoint still publishes it; this page must not
    // print it under a label a reader reads as coverage.
    assert.doesNotMatch(rendered, /counts\?\.countries\b(?!_)/);
  });

  test('source-check: observations are printed in full, not abbreviated', () => {
    // `fmt` renders 75,934 as "75.9k". PageHero already argues that a page
    // describing the size of a catalogue is the one place a rounded figure
    // undercuts what it is saying, and /pipeline prints it in full.
    assert.match(rendered, /value\.toLocaleString\('en-GB'\)/);
    assert.doesNotMatch(rendered, /fmt\(counts/);
  });
});

describe('/overview — the delta is the ticker strip’s delta', () => {
  const rendered = withoutComments(source(OVERVIEW));

  test('source-check: LensRow calls the shared helper', () => {
    assert.match(rendered, /import \{ figureDelta.*\} from '@\/components\/periodModel'/);
    assert.match(rendered, /const \{ delta, toDate \} = figureDelta\(lens\)/);
  });

  test('source-check: it no longer computes percent-of-previous itself', () => {
    assert.doesNotMatch(rendered, /previous_value\) \/ Math\.abs/);
    assert.doesNotMatch(rendered, /\* 100/);
  });

  test('source-check: the missing-delta explanation removes itself', () => {
    // Written unconditionally it would still be on the page after
    // /api/overview starts carrying quantity_kind.
    assert.match(rendered, /!lenses\.some\(\(lens\) => figureDelta\(lens\)\.delta\) && \(/);
  });

  test('source-check: the unit comes from the helper, never a literal %', () => {
    // The old row appended a hardcoded "%" to every delta, which is what made
    // a rate print as a percentage on this page and as points on the lens.
    assert.match(rendered, /\{delta\.unit\}/);
    assert.doesNotMatch(rendered, /toFixed\(1\)\}%/);
  });
});

describe('/overview — it goes somewhere', () => {
  const rendered = withoutComments(source(OVERVIEW));

  test('source-check: every route that had no inbound link now has one', () => {
    // /data, /news, /explore and /simulate were unreachable from the page
    // every reader lands on.
    // Written both ways in this file: as a JSX attribute on <EntryCard>, and
    // as a `to:` property on an entry the component spreads.
    for (const route of ['/data', '/news', '/explore', '/pipeline']) {
      assert.match(rendered, new RegExp(`to[:=] *['"]${route}['"]`), `no link to ${route}`);
    }
    assert.match(rendered, /to=\{`\/simulate\/\$\{scenario\.slug\}`\}/);
  });

  test('source-check: the scenario is named from the API, not written down', () => {
    assert.doesNotMatch(rendered, /ai-capex-dotcom/);
    assert.match(rendered, /useScenarios\(\)/);
  });

  test('source-check: the "start here" question is picked from the data', () => {
    // A slug written into this file is an editorial decision made in the
    // client, and it rots silently the first time the seed reorders.
    assert.match(rendered, /questions \?\? \[\]/);
    assert.match(rendered, /q\.lens_id === firstLensId/);
  });

  test('source-check: "what changed" excludes forecast periods', () => {
    // dbnomics carries a valued row dated 2027; a plain maximum would make the
    // site's "newest measurement" a number nobody has measured.
    assert.match(rendered, /!isFuturePeriod\(s\.latest_period\)/);
  });
});

describe('/pipeline — the freshness panel measures the data', () => {
  const rendered = withoutComments(source(PIPELINE));

  test('source-check: the reassurance survives only as the empty state', () => {
    const claim = /Nothing is late/g;
    assert.equal((rendered.match(claim) ?? []).length, 1);
    assert.match(rendered, /rows\.length === 0 \? \([\s\S]{0,200}Nothing is late/);
  });

  test('source-check: the note no longer disclaims the list it heads', () => {
    // It used to end "an adapter can fetch successfully and find nothing new,
    // and that shows here as fresh" — a correct explanation of why the list
    // below it was wrong.
    assert.doesNotMatch(rendered, /that shows here as fresh/);
    assert.match(rendered, /Measured on the data, not on the job/);
  });

  test('source-check: each row shows the newest observation, not the job time', () => {
    assert.match(rendered, /row\.latest_period/);
    assert.match(rendered, /row\.days_behind/);
    assert.match(rendered, /row\.ingest_gap_days/);
  });

  test('source-check: no denominator is invented for the stale count', () => {
    // The payload carries the list and no total.
    assert.doesNotMatch(rendered, /of \d+ (active )?series/);
  });

  test('source-check: a future latest_period is marked as a forecast', () => {
    assert.match(rendered, /isFuturePeriod\(source\.latest_period\)/);
  });

  test('source-check: the countries figure is coverage and says so', () => {
    assert.match(rendered, /\['Countries with data', counts\.countries_with_data\]/);
    assert.doesNotMatch(rendered, /\['Countries', counts\.countries\]/);
  });
});

describe('/pipeline — a capped list is never printed as a total', () => {
  const rendered = withoutComments(source(PIPELINE));

  /*
   * The staleness endpoint returns at most 40 rows. Printing `rows.length` as the
   * answer to "how many are late" is therefore a number that is true until it is
   * silently not — at 40 it stops being a count and becomes a cap, with nothing on
   * the page to say so.
   *
   * The first attempt at this fix then over-corrected: the no-total branch asserted
   * "so that is the worst of what is late rather than all of it", which is a claim
   * about truncation the page cannot make either. Uncapped the query returns 38, so
   * nothing was being truncated and the sentence was false. Both directions are the
   * same defect — stating something about completeness that the payload does not
   * support — so both are asserted against here.
   */
  test('source-check: rows.length is never presented as the number that are behind', () => {
    assert.doesNotMatch(
      rendered,
      /\{rows\.length\}[^<]*series (is|are) behind/,
      'the length of a capped list is being printed as the count of late series'
    );
  });

  test('source-check: the no-total branch claims no knowledge it does not have', () => {
    assert.doesNotMatch(
      rendered,
      /that is the worst\s+of what is late/,
      'the page asserts its list is truncated; with no total from the server it ' +
        'cannot know that, and today the list is complete'
    );
    assert.match(
      rendered,
      /cannot say\s+whether these are all of them/,
      'the no-total branch should say what it does not know rather than guess'
    );
  });

  test('source-check: a denominator is never invented', () => {
    assert.doesNotMatch(rendered, /of \d+ (active )?series/);
  });
});

describe('/data — the catalogue', () => {
  const rendered = withoutComments(source(DATA));

  test('source-check: the build notes are trimmed before rendering', () => {
    assert.match(rendered, /readerDescription\(indicator\.description\)/);
    assert.doesNotMatch(rendered, /\{indicator\.description\}/);
  });

  test('source-check: search runs on the trimmed text too', () => {
    assert.doesNotMatch(rendered, /i\.description\?\.toLowerCase/);
    assert.match(rendered, /readerDescription\(i\.description\)\?\.toLowerCase/);
  });

  test('source-check: filters and results each carry a heading', () => {
    // The whole 134-row catalogue had exactly one heading — the h1 — so a
    // screen-reader user had no navigation through it at all.
    const headings = rendered.match(/<h2/g) ?? [];
    assert.ok(headings.length >= 2, `expected two h2s, found ${headings.length}`);
    assert.match(rendered, /id="data-filters"/);
    assert.match(rendered, /series`\}\s*<\/h2>/);
  });

  test('source-check: a future coverage date is labelled a forecast', () => {
    assert.match(rendered, /isFuturePeriod\(indicator\.latest_period\)/);
    assert.match(rendered, /forecast to /);
  });

  test('source-check: the sources figure says which sources it counts', () => {
    assert.match(rendered, /\['Sources with series', sources\.length\]/);
  });
});

describe('/data/:id — one series', () => {
  const rendered = withoutComments(source(INDICATOR));

  test('source-check: the chart card no longer repeats the h1', () => {
    // ChartCard emits an h3, and this page passed it `indicator.name` — the
    // h1 verbatim — so the outline ran H1 → H3 (same words) → H2.
    assert.doesNotMatch(rendered, /<ChartCard[\s\S]{0,120}title=/);
  });

  test('source-check: the description is trimmed', () => {
    assert.match(rendered, /readerDescription\(indicator\.description\)/);
    assert.doesNotMatch(rendered, /\{indicator\.description\}/);
  });

  test('source-check: coverage is the measured end, forecasts are separate', () => {
    assert.match(rendered, /p\.value_status !== 'projected'/);
    assert.match(rendered, /label="Forecast to"/);
    assert.doesNotMatch(rendered, /label="Covers"/);
  });
});

describe('TickerStrip — one function, not two', () => {
  const rendered = withoutComments(source(TICKER));

  test('source-check: the arithmetic is imported, not redefined here', () => {
    assert.match(rendered, /from '@\/components\/periodModel'/);
    assert.doesNotMatch(rendered, /function change\(/);
    assert.doesNotMatch(rendered, /function isStale\(/);
  });

  test('source-check: a period still running is labelled instead of compared', () => {
    assert.match(rendered, /const \{ delta, toDate \} = figureDelta\(ticker\)/);
    assert.match(rendered, /toDate \? ` · \$\{toDate\}` : ''/);
  });
});
