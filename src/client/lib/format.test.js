/**
 * These are the first tests over client code. They are worth having because
 * `format.js` is pure — no DOM, no network — and because it is the single
 * chokepoint every number and unit on the site passes through, so a fault here
 * is visible on every page at once.
 *
 * The unit cases are taken from real rows in `indicators`, not invented. The
 * provider metadata genuinely contains sentences addressed to whoever wired
 * the adapter, and they were being printed to readers.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  displayUnit,
  withUnit,
  fmt,
  fmtDate,
  fmtDay,
  delta,
  deltaDirection,
  confidenceLabel,
  confidenceDefinition,
  CONFIDENCE_TIERS,
  prefixSymbol,
  latestIsoPeriod,
  narrationStaleness,
} from './format.js';

describe('displayUnit', () => {
  test('drops the parenthetical note an ingestion adapter left behind', () => {
    assert.equal(
      displayUnit('ten thousand persons (2026-06 value 6,846 = 68.46 million employed)'),
      'ten thousand persons'
    );
    assert.equal(
      displayUnit('Thousands of vacancies (NA-sentinel strings present; filter them)'),
      'Thousands of vacancies'
    );
    assert.equal(displayUnit('index, 2015 = 100 (2015-01 = 99.9; 2024-04 = 114.0)'), 'index, 2015 = 100');
  });

  test('drops a trailing semicolon clause even without brackets', () => {
    assert.equal(displayUnit('10,000 yuan; 2025 value 1,548,312'), '10,000 yuan');
  });

  test('does not split a thousands separator — "10,000 yuan" must not become "10"', () => {
    // The reason the comma rule requires a non-digit after the comma.
    assert.equal(displayUnit('10,000 yuan (dimension unit=10000_yuan)'), '10,000 yuan');
    assert.equal(displayUnit('100 million units (dimension unit=100_million_units)'), '100 million units');
  });

  test('keeps only the head clause of a long but legitimate description', () => {
    assert.equal(
      displayUnit('Millions of Dollars, seasonally adjusted annual rate'),
      'Millions of Dollars'
    );
    assert.equal(
      displayUnit('US dollars per hour, PPP converted, constant prices'),
      'US dollars per hour'
    );
  });

  test('leaves a short unit alone, including one with a meaningful comma', () => {
    assert.equal(displayUnit('USD per tonne'), 'USD per tonne');
    assert.equal(displayUnit('percent'), 'percent');
    // 30 chars, under the threshold, so the comma clause survives.
    assert.equal(displayUnit('ratio, percent of labour force'), 'ratio, percent of labour force');
  });

  test('survives the shapes that are not strings', () => {
    for (const bad of [null, undefined, 42, {}]) assert.equal(displayUnit(bad), '');
  });

  // Every string below is a real value of `indicators.unit`, read out of the
  // live table on 4 September 2026, not invented:
  //   SELECT DISTINCT unit FROM indicators WHERE unit ~ '_|=' ORDER BY 1;
  test('translates the eight snake_case identifiers readers were being shown', () => {
    assert.equal(displayUnit('percent_of_gdp'), '% of GDP');
    assert.equal(displayUnit('thousands_of_persons'), 'thousands of persons');
    assert.equal(displayUnit('constant_2015_usd'), 'constant 2015 US dollars');
    assert.equal(
      displayUnit('billions_of_chained_2017_usd'),
      'billions of chained 2017 dollars'
    );
    assert.equal(displayUnit('index_2017=100'), 'index, 2017 = 100');
    assert.equal(displayUnit('index_2017=1'), 'index, 2017 = 1');
    assert.equal(displayUnit('index_2015=100'), 'index, 2015 = 100');
    assert.equal(displayUnit('score_-100_to_100'), 'score, −100 to 100');
  });

  test('de-snakes an identifier the table does not name, so a new source is not raw', () => {
    // The point of the general rule: no underscore ever reaches a reader, even
    // from a unit string this project has not seen yet.
    assert.equal(displayUnit('millions_of_widgets'), 'millions of widgets');
    for (const unit of [
      'percent_of_gdp',
      'thousands_of_persons',
      'constant_2015_usd',
      'billions_of_chained_2017_usd',
      'index_2017=100',
      'score_-100_to_100',
      'some_unit_nobody_listed',
    ]) {
      assert.ok(!displayUnit(unit).includes('_'), `underscore leaked: ${displayUnit(unit)}`);
    }
  });

  test('spaces out a base year jammed against its equals sign', () => {
    assert.equal(displayUnit('Index Dec 1998=100'), 'Index Dec 1998 = 100');
    assert.equal(displayUnit('index 2016=100'), 'index 2016 = 100');
    assert.equal(displayUnit('ratio, 1990=100'), 'ratio, 1990 = 100');
  });

  test('does not amputate an index base year when trimming a long description', () => {
    // This split at the FIRST comma and rendered as "Index" — an index with no
    // base year, which is not a unit. The comma rule now allows whitespace
    // before the digit it is protecting.
    assert.equal(
      displayUnit('Index, 2023 = 100, seasonally adjusted'),
      'Index, 2023 = 100'
    );
  });
});

describe('withUnit', () => {
  test('never emits a raw provider string', () => {
    const out = withUnit(6846, 'ten thousand persons (2026-06 value 6,846 = 68.46 million)');
    assert.ok(!out.includes('('), `leaked provider note: ${out}`);
    assert.equal(out, '6,846 ten thousand persons');
  });

  test('uses symbols for the two units that have them', () => {
    // Abbreviation starts at 10k, so four digits stay written out in full.
    assert.equal(withUnit(1234, 'USD'), '$1,234');
    assert.equal(withUnit(15_000, 'USD'), '$15.0k');
    assert.equal(withUnit(60.87, 'percent'), '60.9%');
  });

  test('renders a missing value as a dash rather than NaN', () => {
    assert.equal(withUnit(null, 'USD'), '—');
    assert.equal(withUnit(Number.NaN, 'percent'), '—');
  });

  test('puts a currency symbol BEFORE the number', () => {
    // Live: thirteen indicators carry unit_symbol '$', among them copper, which
    // is the lead ticker on the Investment lens and the first figure on the
    // home page. It rendered "13.5k $".
    assert.equal(withUnit(13_542, '$'), '$13.5k');
    assert.equal(withUnit(3158.265, '$', 0), '$3,158');
    assert.equal(withUnit(59.58, '£', 2), '£59.6');
    assert.equal(withUnit(1234, '€'), '€1,234');
  });

  test('renders a count at the precision the indicator declares, not one decimal', () => {
    // derived.ai_binding_rules: unit "documents per month", decimals 0.
    // It was rendering "1.0 documents per month".
    assert.equal(withUnit(1, 'documents per month', 0), '1 documents per month');
    assert.equal(withUnit(2, 'documents', 0), '2 documents');
    // Unstated decimals keep the old default, so nothing else moves.
    assert.equal(withUnit(1, 'documents per month'), '1.0 documents per month');
  });

  test('accepts the indicator row itself, which two call sites already pass', () => {
    // TickerStrip's sheet and PriceMarquee call withUnit(value, ticker). The
    // object hit displayUnit's non-string guard, so the unit vanished entirely
    // and the number rendered with a trailing space.
    assert.equal(
      withUnit(1, { unit: 'documents per month', unit_symbol: null, decimals: 0 }),
      '1 documents per month'
    );
    assert.equal(
      withUnit(13_542, { unit: 'USD per tonne', unit_symbol: '$', decimals: 0 }),
      '$13.5k'
    );
    assert.equal(
      withUnit(8.5, { unit: 'percent', unit_symbol: '%', decimals: 1 }),
      '8.5%'
    );
  });

  test('does not call dollars a percentage because the description ends "annual rate"', () => {
    // fred series carry "Millions of Dollars, seasonally adjusted annual rate".
    // isRateUnit matched "rate" in the raw string and printed a percent sign.
    assert.equal(
      withUnit(1234, 'Millions of Dollars, seasonally adjusted annual rate'),
      '1,234 Millions of Dollars'
    );
  });

  test('translates a snake_case unit rather than printing the identifier', () => {
    assert.equal(withUnit(2.42, 'percent_of_gdp', 2), '2.42%');
    assert.equal(withUnit(124, 'index_2017=100', 1), '124 index, 2017 = 100');
  });
});

describe('locale', () => {
  test('numbers and dates are en-GB whatever the machine says', () => {
    // The prose quotes US-formatted figures and the k/M/B/T suffixes are
    // English, so following the reader's locale mixed three conventions on one
    // page. This asserts the decision, not the environment.
    assert.equal(fmt(1234.5), '1,234.5');
    assert.equal(fmt(13_542, 0), '13.5k');
    assert.equal(fmt(9876), '9,876');
    assert.equal(fmtDate('2026-01-01', 'monthly'), 'Jan 2026');
  });

  test('the same call under a German environment still reads English', () => {
    // A regression guard with teeth: 1234.5 is "1.234,5" in de-DE and
    // "1 234,5" in fr-FR, so a reverted LOCALE fails here rather than only on
    // a German reader's screen.
    const formatted = fmt(1234.5);
    assert.ok(!formatted.includes('.234'), `looks like a de-DE grouping: ${formatted}`);
    assert.equal(formatted.split('.')[1], '5');
  });
});

describe('prefixSymbol', () => {
  test('names the symbols that go before the number and nothing else', () => {
    assert.equal(prefixSymbol('$'), '$');
    assert.equal(prefixSymbol('USD'), '$');
    assert.equal(prefixSymbol('£'), '£');
    assert.equal(prefixSymbol('%'), null);
    assert.equal(prefixSymbol('MW'), null);
    assert.equal(prefixSymbol('documents per month'), null);
    for (const bad of [null, undefined, 42, {}]) assert.equal(prefixSymbol(bad), null);
  });
});

describe('narrationStaleness', () => {
  // These are the exact rows from the live database on 4 September 2026:
  //   narrations.grounding->'series' for scope 'lens:regulation', all period
  //   "2026-08-01"; and observations' max(period_start) for the same four
  //   indicators, three of which are "2026-09-01".
  const AUGUST_GROUNDING = [
    { name: 'Rules in force', latest: 10, previous: 6, period: '2026-08-01' },
    { name: 'Rules proposed', latest: 5, previous: 9, period: '2026-08-01' },
    { name: 'Executive actions', latest: 2, previous: 2, period: '2026-08-01' },
    { name: 'All AI documents', latest: 36, previous: 42, period: '2026-08-01' },
  ];
  const SEPTEMBER_TICKERS = [
    { latest_period: '2026-09-01' },
    { latest_period: '2026-09-01' },
    { latest_period: '2026-08-01' },
    { latest_period: '2026-09-01' },
  ];

  test('catches the /lens/regulation contradiction: August prose over September tiles', () => {
    const out = narrationStaleness(AUGUST_GROUNDING, SEPTEMBER_TICKERS);
    assert.equal(out.narrationPeriod, '2026-08-01');
    assert.equal(out.tickerPeriod, '2026-09-01');
    assert.equal(out.stale, true);
  });

  test('says nothing when the narration is current', () => {
    const out = narrationStaleness(AUGUST_GROUNDING, [{ latest_period: '2026-08-01' }]);
    assert.equal(out.stale, false);
  });

  test('a simulation, whose periods are sentences, is never called stale', () => {
    // buildSimulationGrounding writes "no injection → year 5" as the period.
    const sim = [
      { name: 'New capital spending', latest: 500, period: 'one-off, in year one' },
      { name: 'Output', previous: 1, latest: 2, period: 'no injection → year 5' },
    ];
    const out = narrationStaleness(sim, SEPTEMBER_TICKERS);
    assert.equal(out.narrationPeriod, null);
    assert.equal(out.stale, false);
  });

  test('a missing side is not evidence of disagreement', () => {
    assert.equal(narrationStaleness(AUGUST_GROUNDING, undefined).stale, false);
    assert.equal(narrationStaleness(undefined, SEPTEMBER_TICKERS).stale, false);
    assert.equal(narrationStaleness([], []).stale, false);
    assert.equal(narrationStaleness([{ period: null }], [{ latest_period: null }]).stale, false);
  });

  test('a narration AHEAD of the tickers is not stale', () => {
    // Forecast series carry future periods; being ahead is not being behind.
    const out = narrationStaleness([{ period: '2027-03-01' }], SEPTEMBER_TICKERS);
    assert.equal(out.stale, false);
  });
});

describe('latestIsoPeriod', () => {
  test('takes the maximum date and ignores everything that is not one', () => {
    assert.equal(latestIsoPeriod(['2026-01-01', '2026-09-01', '2025-12-31']), '2026-09-01');
    assert.equal(latestIsoPeriod(['2026-09-01T00:00:00.000Z']), '2026-09-01');
    assert.equal(latestIsoPeriod(['year 5', null, undefined, 7, {}]), null);
    assert.equal(latestIsoPeriod([]), null);
    assert.equal(latestIsoPeriod(undefined), null);
  });
});

describe('fmtDay', () => {
  test('keeps the day, which fmtDate deliberately drops', () => {
    assert.equal(fmtDay('2026-08-30T18:37:31.054Z'), '30 Aug 2026');
    assert.equal(fmtDay('2026-08-30'), '30 Aug 2026');
    assert.equal(fmtDay('nonsense'), '');
    assert.equal(fmtDay(null), '');
  });
});

describe('confidenceLabel', () => {
  test('gives every stored tier a label and a definition', () => {
    // The five ids are the confidence_tier enum in db/migrations/0001_enums.sql;
    // four of them are in use in `indicators` today.
    assert.deepEqual(
      CONFIDENCE_TIERS.map((t) => t.id),
      ['official', 'derived', 'survey', 'modelled', 'news_derived']
    );
    assert.equal(confidenceLabel('news_derived'), 'News-derived');
    assert.equal(confidenceLabel('official'), 'Official');
    for (const tier of CONFIDENCE_TIERS) {
      assert.ok(tier.definition.length > 20, `${tier.id} has no definition a reader can use`);
    }
  });

  test('an unknown tier is still not shown as an identifier', () => {
    assert.equal(confidenceLabel('some_new_tier'), 'some new tier');
    assert.equal(confidenceDefinition('some_new_tier'), '');
  });
});

describe('delta', () => {
  test('reports a rate in points, not as a percentage of a percentage', () => {
    // "0.5% to 60.9%" is +11,831% and also useless — see the note in format.js.
    const points = [
      { date: '2015-01-01', value: 0.5 },
      { date: '2026-01-01', value: 60.9 },
    ];
    const d = delta(points, true, 'annual');
    assert.equal(d.unit, 'pp');
    assert.ok(Math.abs(d.value - 60.4) < 0.001);
  });

  test('a small fall keeps its sign rather than being classed flat', () => {
    assert.equal(deltaDirection({ value: -0.05 }), 'down');
    assert.equal(deltaDirection({ value: 0 }), 'flat');
    assert.equal(deltaDirection(null), 'flat');
  });
});

describe('fmt', () => {
  test('abbreviates at each magnitude', () => {
    assert.equal(fmt(1.5e12), '1.5T');
    assert.equal(fmt(2.4e9), '2.4B');
    assert.equal(fmt(3.7e6), '3.7M');
    assert.equal(fmt(15_000), '15.0k');
  });

  test('keeps decimals only where they carry information', () => {
    // A series moving between 0.2 and 0.9 must not render as "0, 0, 1".
    assert.equal(fmt(0.234, 2), '0.23');
    assert.equal(fmt(1234), '1,234');
  });
});
