/**
 * The thirteen chart honesty behaviours, under test.
 *
 * WHAT THIS FILE IS FOR
 *
 * "The 12 chart honesty behaviours" was a non-negotiable this project carried
 * for months as a phrase in a plan. It was never enumerated anywhere, and not
 * one of the twelve had a test. HONESTY.md, next to this file, is now the list.
 * This is the enforcement.
 *
 * Two different jobs happen below:
 *
 *   1. The list is checked against the code. Every `path:line — contains
 *      anchor` citation in HONESTY.md is resolved and the anchor is asserted to
 *      still be on that line. Move the code and this goes red, so the list
 *      cannot rot into line numbers pointing at nothing — which is the failure
 *      mode of every "see file:line" comment ever written.
 *
 *   2. The decisions themselves are exercised, where they are pure functions.
 *
 * WHAT IS **NOT** TESTED HERE, AND WHY — READ THIS BEFORE TRUSTING A GREEN RUN
 *
 * Five of the thirteen need a rendered DOM and this repo has no DOM test runner
 * (`npm test` is bare `node --test`, no jsdom, no React testing library). They
 * are genuinely untested:
 *
 *   1  one y-axis, never dual        — a JSX structure fact
 *   6  the "(raw units)" label       — built inside SeriesChart's useMemo
 *   7  the "N of M series rebased"   — ChartGroup's footer JSX
 *   8  the cadence-mismatch warning  — SeriesChart's JSX
 *   12 the legend at >= 2 series     — LineChart's JSX
 *
 * Four more are half-covered: the pure decision is asserted, the sentence a
 * reader actually sees is not (behaviours 3, 9, 10, 11, 13). Behaviour 4's
 * "there is no prop for it" half is asserted by reading FigureChart's source,
 * because that is a statement about what the file does NOT contain.
 *
 * That is an honest gap, not an oversight. A behaviour that looks tested and
 * is not is worse than one openly marked untested: the first stops anyone
 * checking. Closing it means adding a DOM runner, which is a real dependency
 * decision and belongs to the owner.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildChartModel,
  splitProjected,
  projectedKey,
  readProjectedKey,
  rankEntities,
  panelsOf,
  daysBetween,
  describeSeriesChart,
  describeRankedChart,
  describeFigureChart,
  seriesTableModel,
  rankedTableModel,
  figureTableModel,
  figureBasisNote,
  TABLE_ROW_CAP,
} from './chartModel.js';
import { SERIES_COLORS } from '../../lib/format.js';

/*
 * palette.js cannot be imported: it pulls in React for useSeriesPalette, and
 * `@/lib/format` through the Vite alias, neither of which node resolves. The
 * two functions that matter are pure and tiny, so they are read out of the
 * source and evaluated — which also means a change to either one is caught
 * here rather than passing because the test held its own copy.
 */
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const PALETTE_SRC = readFileSync(join(ROOT, 'src/client/components/charts/palette.js'), 'utf8');
const { exceedsPalette, colorAt } = evaluateExports(PALETTE_SRC, ['exceedsPalette', 'colorAt']);

function evaluateExports(source, names) {
  const bodies = names.map((name) => {
    const match = source.match(new RegExp(`export function ${name}\\([\\s\\S]*?\\n\\}`));
    assert.ok(match, `palette.js no longer exports a function called ${name}`);
    return match[0].replace('export ', '');
  });
  // eslint-disable-next-line no-new-func
  return new Function(`${bodies.join('\n')}\nreturn { ${names.join(', ')} };`)();
}

// ---------------------------------------------------------------------------
// The list itself
// ---------------------------------------------------------------------------

const HONESTY = readFileSync(join(ROOT, 'src/client/components/charts/HONESTY.md'), 'utf8');

/** Only these four exist. A fifth means someone invented a coverage class. */
const COVERAGE_TAGS = new Set([
  'unit',
  'unit (partial)',
  'source-check',
  'render-only — not covered here',
]);

/** `- \`path:line\` — contains \`anchor\`` at the very start of a line. */
const CITATION = /^- `([^`]+):(\d+)` — contains `([^`]+)`$/;
const HEADING = /^## (\d+)\. (.+)$/;
const COVERAGE = /^Coverage: `([^`]+)`$/;

function parseHonesty(markdown) {
  const behaviours = [];
  for (const line of markdown.split('\n')) {
    const heading = line.match(HEADING);
    if (heading) {
      behaviours.push({ number: Number(heading[1]), title: heading[2], citations: [], coverage: [] });
      continue;
    }
    if (behaviours.length === 0) continue;
    const current = behaviours.at(-1);

    const citation = line.match(CITATION);
    if (citation) {
      current.citations.push({ file: citation[1], line: Number(citation[2]), anchor: citation[3] });
      continue;
    }
    const coverage = line.match(COVERAGE);
    if (coverage) current.coverage.push(coverage[1]);
  }
  return behaviours;
}

const BEHAVIOURS = parseHonesty(HONESTY);

describe('HONESTY.md — the list is complete and points at real code', () => {
  test('names exactly thirteen behaviours, numbered 1 to 13', () => {
    assert.equal(
      BEHAVIOURS.length,
      13,
      `HONESTY.md lists ${BEHAVIOURS.length} behaviours, not 13. The count is the ` +
        'non-negotiable — adding a fourteenth or dropping one is a decision, not an edit.'
    );
    assert.deepEqual(
      BEHAVIOURS.map((b) => b.number),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
    );
  });

  test('every behaviour carries exactly one recognised coverage tag', () => {
    for (const b of BEHAVIOURS) {
      assert.equal(b.coverage.length, 1, `behaviour ${b.number} has ${b.coverage.length} Coverage: lines`);
      assert.ok(
        COVERAGE_TAGS.has(b.coverage[0]),
        `behaviour ${b.number} claims coverage "${b.coverage[0]}", which is not one of: ` +
          [...COVERAGE_TAGS].join(' / ')
      );
    }
  });

  test('every behaviour cites at least one line of code', () => {
    for (const b of BEHAVIOURS) {
      assert.ok(b.citations.length > 0, `behaviour ${b.number} (${b.title}) cites nothing`);
    }
  });

  test('every cited line still contains the code it claims to', () => {
    for (const b of BEHAVIOURS) {
      for (const { file, line, anchor } of b.citations) {
        const source = readFileSync(join(ROOT, file), 'utf8').split('\n');
        const actual = source[line - 1];
        assert.ok(
          actual !== undefined,
          `HONESTY.md behaviour ${b.number} cites ${file}:${line}, which is past the end of the file`
        );
        assert.ok(
          actual.includes(anchor),
          `HONESTY.md behaviour ${b.number} cites ${file}:${line} for "${anchor}", but that line ` +
            `now reads:\n    ${actual.trim()}\nEither the behaviour moved (update the list) or it ` +
            'was removed (which is a decision, not a refactor).'
        );
      }
    }
  });

  test('the five render-only gaps are still declared as gaps', () => {
    // Named individually rather than counted: a behaviour quietly moving from
    // "render-only" to "unit" without a test appearing is the thing this
    // guards against.
    const untested = BEHAVIOURS.filter((b) => b.coverage[0] === 'render-only — not covered here');
    assert.deepEqual(untested.map((b) => b.number), [1, 6, 7, 8, 12]);
  });
});

// ---------------------------------------------------------------------------
// Behaviour 2 — the y-axis starts at zero unless the scale is an index
// Behaviour 3 — a truncated axis is disclosed (the flag half)
// ---------------------------------------------------------------------------

/** A series in the shape /api/series returns. */
function series(label, values, { status } = {}) {
  return {
    label,
    points: values.map(([date, value], i) => ({
      date,
      value,
      value_status: Array.isArray(status) ? status[i] : status,
    })),
  };
}

const MONTHS = ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01'];
const at = (values) => values.map((v, i) => [MONTHS[i], v]);

describe('behaviour 2 — zero baseline unless the scale is an index', () => {
  test('a raw-unit chart floors at zero even when the data sits far above it', () => {
    const model = buildChartModel([series('Vacancies', at([400, 450, 500, 480]))], 'monthly', false);
    assert.deepEqual(model.domain, [0, 'auto']);
    assert.equal(model.axisTruncated, false);
  });

  test('an index chart in a tight band around 100 may leave zero', () => {
    const model = buildChartModel([series('Output index', at([98, 101, 104, 103]))], 'monthly', true);
    const [floor] = model.domain;
    assert.ok(floor > 0 && floor < 98, `expected a padded floor just under 98, got ${floor}`);
    assert.equal(model.axisTruncated, true);
  });

  test('an index whose data already sits near zero still floors at zero', () => {
    // The escape hatch is for a band around 100, not for any indexed chart.
    const model = buildChartModel([series('Share', at([0.5, 1.2, 3, 2.4]))], 'monthly', true);
    assert.deepEqual(model.domain, [0, 'auto']);
    assert.equal(model.axisTruncated, false);
  });

  test('negative values move the floor to the true minimum, not to zero', () => {
    const model = buildChartModel([series('Net flow', at([-5, 2, 10, 7]))], 'monthly', false);
    assert.deepEqual(model.domain, [-5, 'auto']);
    assert.equal(model.axisTruncated, false);
  });

  test('axisTruncated is true exactly when the floor left zero', () => {
    // Behaviour 3's trigger. The paragraph it renders is render-only.
    const truncated = buildChartModel([series('I', at([98, 101, 104, 103]))], 'monthly', true);
    const honest = buildChartModel([series('I', at([98, 101, 104, 103]))], 'monthly', false);
    assert.equal(truncated.axisTruncated, truncated.domain[0] > 0);
    assert.equal(honest.axisTruncated, false);
    assert.deepEqual(honest.domain, [0, 'auto']);
  });
});

// ---------------------------------------------------------------------------
// Behaviour 5 — a gap in the data breaks the line
// ---------------------------------------------------------------------------

describe('behaviour 5 — a gap breaks the line', () => {
  test('a date one series is missing becomes an explicit null, not an absent key', () => {
    const model = buildChartModel(
      [
        series('Complete', at([1, 2, 3, 4])),
        series('Gappy', [[MONTHS[0], 1], [MONTHS[2], 3]]),
      ],
      'monthly',
      false
    );

    const gapRow = model.rows.find((r) => r.date === MONTHS[1]);
    assert.ok('Gappy' in gapRow, 'the key must be present, or connectNulls has nothing to break on');
    assert.equal(gapRow.Gappy, null);
    assert.equal(gapRow.Complete, 2);
  });

  test('a null value in the source stays null rather than being dropped', () => {
    const model = buildChartModel([series('Patchy', at([1, null, 3, 4]))], 'monthly', false);
    assert.deepEqual(model.rows.map((r) => r.Patchy), [1, null, 3, 4]);
  });
});

// ---------------------------------------------------------------------------
// Behaviour 9 — forecasts on their own dashed line
// ---------------------------------------------------------------------------

describe('behaviour 9 — projections are separated from measurements', () => {
  test('marks the projected dates and bridges from the last measured point', () => {
    const { projectedDates, bridgeDates } = splitProjected([
      { date: MONTHS[0], value: 1, value_status: 'measured' },
      { date: MONTHS[1], value: 2, value_status: 'measured' },
      { date: MONTHS[2], value: 3, value_status: 'projected' },
      { date: MONTHS[3], value: 4, value_status: 'projected' },
    ]);
    assert.deepEqual([...projectedDates], [MONTHS[2], MONTHS[3]]);
    assert.deepEqual([...bridgeDates], [MONTHS[1]]);
  });

  test('a measurement AFTER a projection stays a measurement', () => {
    // Read per point, not as "everything after the first projection" — a
    // source revising a forecast year into an outturn must not have that
    // outturn redrawn as a forecast.
    const { projectedDates } = splitProjected([
      { date: MONTHS[0], value: 1, value_status: 'measured' },
      { date: MONTHS[1], value: 2, value_status: 'projected' },
      { date: MONTHS[2], value: 3, value_status: 'measured' },
    ]);
    assert.deepEqual([...projectedDates], [MONTHS[1]]);
    assert.equal(projectedDates.has(MONTHS[2]), false);
  });

  test('a projected point with no value is not a projection', () => {
    const { projectedDates, bridgeDates } = splitProjected([
      { date: MONTHS[0], value: 1, value_status: 'measured' },
      { date: MONTHS[1], value: null, value_status: 'projected' },
    ]);
    assert.equal(projectedDates.size, 0);
    assert.equal(bridgeDates.size, 0);
  });

  test('no bridge when the previous point is itself a projection', () => {
    const { bridgeDates } = splitProjected([
      { date: MONTHS[0], value: 1, value_status: 'projected' },
      { date: MONTHS[1], value: 2, value_status: 'projected' },
    ]);
    assert.equal(bridgeDates.size, 0);
  });

  test('the solid line stops where the measurements stop', () => {
    const model = buildChartModel(
      [series('GDP', at([1, 2, 3, 4]), { status: ['measured', 'measured', 'projected', 'projected'] })],
      'annual',
      false
    );

    assert.deepEqual(model.rows.map((r) => r.GDP), [1, 2, null, null]);
    assert.deepEqual(
      model.rows.map((r) => r[projectedKey('GDP')]),
      [null, 2, 3, 4] // 2 is the bridge, so the dashed line meets the solid one
    );
    assert.deepEqual([...model.projected], ['GDP']);
  });

  test('a series with no projections gets no projected key at all', () => {
    const model = buildChartModel([series('Steady', at([1, 2, 3, 4]))], 'monthly', false);
    assert.equal(model.projected.size, 0);
    for (const row of model.rows) {
      assert.equal(projectedKey('Steady') in row, false);
    }
  });

  test('projectedKey and readProjectedKey are inverses', () => {
    assert.equal(readProjectedKey(projectedKey('Germany — Enterprises using AI')), 'Germany — Enterprises using AI');
    assert.equal(readProjectedKey('Germany — Enterprises using AI'), null);
    assert.equal(readProjectedKey(undefined), null);
    assert.equal(readProjectedKey(42), null);
  });
});

// ---------------------------------------------------------------------------
// Behaviour 10 — never more series than validated hues
// ---------------------------------------------------------------------------

describe('behaviour 10 — the palette is the honest ceiling', () => {
  const palette = ['#1', '#2', '#3', '#4', '#5', '#6'];

  test('there are exactly six hues, in the validated order', () => {
    assert.equal(SERIES_COLORS.length, 6);
    assert.deepEqual(SERIES_COLORS, ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6']);
  });

  test('exceedsPalette is true only past the number of hues', () => {
    assert.equal(exceedsPalette(0, palette), false);
    assert.equal(exceedsPalette(6, palette), false);
    assert.equal(exceedsPalette(7, palette), true);
    assert.equal(exceedsPalette(16, palette), true); // ai-adoption-panel, live today
  });

  test('the wrap it guards is silent — which is why callers must ask first', () => {
    assert.equal(colorAt(palette, 6), palette[0]);
    assert.equal(colorAt(palette, 7), palette[1]);
  });

  test('the ceiling is the palette length, not a number written twice', () => {
    const four = ['#1', '#2', '#3', '#4'];
    assert.equal(exceedsPalette(5, four), true);
    assert.equal(exceedsPalette(4, four), false);
  });
});

// ---------------------------------------------------------------------------
// Behaviour 11 — two values for one date means refuse
// ---------------------------------------------------------------------------

describe('behaviour 11 — a duplicated period is refused, not resolved', () => {
  test('two non-null values for one date is detected', () => {
    const model = buildChartModel(
      [{ label: 'Youth unemployment', points: [
        { date: MONTHS[0], value: 10 },
        { date: MONTHS[0], value: 16.4 }, // the same period, a second country
        { date: MONTHS[1], value: 11 },
      ] }],
      'monthly',
      false
    );
    assert.equal(model.duplicateDates, true);
  });

  test('a repeated date whose second value is null is not a duplicate', () => {
    const model = buildChartModel(
      [{ label: 'Sparse', points: [
        { date: MONTHS[0], value: 10 },
        { date: MONTHS[0], value: null },
      ] }],
      'monthly',
      false
    );
    assert.equal(model.duplicateDates, false);
  });

  test('two series sharing every date is not a duplicate', () => {
    const model = buildChartModel(
      [series('A', at([1, 2, 3, 4])), series('B', at([5, 6, 7, 8]))],
      'monthly',
      false
    );
    assert.equal(model.duplicateDates, false);
  });

  test('duplicates are detected, never collapsed', () => {
    // If this ever starts de-duplicating, the flag goes false and the chart
    // draws a confident wrong shape. Assert the flag rather than the rows.
    const points = [
      { date: MONTHS[0], value: 10 },
      { date: MONTHS[0], value: 16.4 },
    ];
    const model = buildChartModel([{ label: 'X', points }], 'monthly', false);
    assert.equal(model.duplicateDates, true);
    assert.equal(points.length, 2, 'buildChartModel must not mutate the series it was given');
  });
});

// ---------------------------------------------------------------------------
// Behaviour 4 — a bar chart may never truncate (asserted from source)
// Plus the N-32 regression: one palette order in the codebase.
// ---------------------------------------------------------------------------

describe('behaviour 4 — FigureChart cannot truncate, and holds no palette of its own', () => {
  const SRC = readFileSync(join(ROOT, 'src/client/components/charts/FigureChart.jsx'), 'utf8');

  test('the bar domain is clamped to include zero', () => {
    assert.match(SRC, /const max = Math\.max\(0, \.\.\.values\);/);
    assert.match(SRC, /const min = Math\.min\(0, \.\.\.values\);/);
  });

  test('it declares no palette of its own', () => {
    // It used to hold ['var(--c2)','var(--c3)','var(--c5)','var(--c4)',
    // 'var(--c1)','var(--c6)'] — a different order from SERIES_COLORS, under a
    // comment claiming it was the validated one. CVD separation is measured on
    // ADJACENT pairs, so a reordering is a real change, not a cosmetic one.
    assert.doesNotMatch(SRC, /'var\(--c\d\)'/, 'FigureChart is declaring literal palette hues again');
    assert.match(SRC, /import \{ SERIES_COLORS \} from '@\/lib\/format';/);
  });

  test('it refuses rather than wrapping the palette', () => {
    assert.doesNotMatch(SRC, /%\s*SERIES/, 'a modulo wrap gives two series the same colour silently');
    assert.match(SRC, /const tooManySeries = series\.length > SERIES_COLORS\.length;/);
  });
});

// ---------------------------------------------------------------------------
// Behaviour 10, second half — the form for MORE series than there are hues
//
// The adoption panel's real shape is used throughout, because the failure this
// prevents is a fact about that data and not about a hypothetical: sixteen
// countries whose latest readings are five years apart.
// ---------------------------------------------------------------------------

/** The live ai-adoption-panel, verified against the database on 4 Sep 2026. */
const ADOPTION = [
  { label: 'Denmark', panel: 'Eurostat', points: [['2021-01-01', 23.89], ['2023-01-01', 15.17], ['2024-01-01', 27.58], ['2025-01-01', 42.03]] },
  { label: 'Poland', panel: 'Eurostat', points: [['2021-01-01', 2.86], ['2023-01-01', 3.67], ['2024-01-01', 5.9], ['2025-01-01', 8.36]] },
  { label: 'United States', panel: 'OECD', points: [['2017-01-01', 6.399089768], ['2018-01-01', 3.675265148], ['2021-01-01', 5.651547688]] },
  { label: 'United Kingdom', panel: 'OECD', points: [['2020-01-01', 4.1104]] },
  { label: 'South Korea', panel: 'OECD', points: [['2019-01-01', 2.4929], ['2022-01-01', 27.9886], ['2023-01-01', 30.28], ['2024-01-01', 32.91]] },
].map((s) => ({ ...s, points: s.points.map(([date, value]) => ({ date, value })) }));

describe('behaviour 10 — the ranked bar form is what more than six series becomes', () => {
  test('bars are ordered by the latest reading, highest first', () => {
    const { entities } = rankEntities(ADOPTION, { cadence: 'annual' });
    assert.deepEqual(
      entities.map((e) => e.label),
      ['Denmark', 'South Korea', 'Poland', 'United States', 'United Kingdom']
    );
    assert.equal(entities[0].latest.value, 42.03);
  });

  test('two entities reading the same are ordered by name, not by chance', () => {
    const tied = [
      { label: 'Zeta', points: [{ date: '2025-01-01', value: 10 }] },
      { label: 'Alpha', points: [{ date: '2025-01-01', value: 10 }] },
    ];
    assert.deepEqual(rankEntities(tied).entities.map((e) => e.label), ['Alpha', 'Zeta']);
  });

  test('the bar domain always contains zero — behaviour 4 applies to this form too', () => {
    const [min, max] = rankEntities(ADOPTION, { cadence: 'annual' }).domain;
    assert.equal(min, 0, 'a ranked bar chart may not float its baseline above zero');
    assert.equal(max, 42.03);
  });

  test('a negative reading moves the baseline to the true minimum, never to |value|', () => {
    const falling = [
      { label: 'Down', points: [{ date: '2024-01-01', value: 4 }, { date: '2025-01-01', value: -6 }] },
      { label: 'Up', points: [{ date: '2024-01-01', value: 1 }, { date: '2025-01-01', value: 9 }] },
    ];
    assert.deepEqual(rankEntities(falling).domain, [-6, 9]);
  });

  test('the source draws every bar in ONE hue, so no palette pressure exists', () => {
    const SRC = readFileSync(join(ROOT, 'src/client/components/charts/RankedBarChart.jsx'), 'utf8');
    const calls = SRC.match(/colorAt\([^)]*\)/g) ?? [];
    assert.deepEqual(
      calls,
      ['colorAt(palette, 0)'],
      'a ranked bar chart that colours by position, or by anything, is a sixteen-hue chart again'
    );
  });

  test('the form is read from the editorial layer, never inferred from a count', () => {
    const SRC = readFileSync(join(ROOT, 'src/client/components/charts/ChartGroup.jsx'), 'utf8');
    assert.match(SRC, /const declared = members\.map\(\(m\) => m\.chart_form\)\.find\(Boolean\);/);
    assert.doesNotMatch(
      SRC,
      /members\.length\s*>\s*\d/,
      'the form must not be chosen by counting members — see HONESTY.md behaviour 10'
    );
  });

  test('the refusal is still there for a group with no ruling', () => {
    const SRC = readFileSync(join(ROOT, 'src/client/components/charts/ChartGroup.jsx'), 'utf8');
    assert.match(SRC, /const tooManySeries = !ranked && exceedsPalette\(members\.length, palette\);/);
    assert.match(SRC, /Not drawn: \{members\.length\} series on one pair of axes/);
  });

  test('panels keep two instruments apart and each panel keeps its own ranking', () => {
    const { entities } = rankEntities(ADOPTION, { cadence: 'annual' });
    const panels = panelsOf(entities);
    assert.deepEqual(panels.map((p) => p.name), ['Eurostat', 'OECD']);
    assert.deepEqual(panels[0].entities.map((e) => e.label), ['Denmark', 'Poland']);
    assert.deepEqual(
      panels[1].entities.map((e) => e.label),
      ['South Korea', 'United States', 'United Kingdom']
    );
  });

  test('a group with no declared panels is one unnamed panel', () => {
    const plain = ADOPTION.map(({ panel, ...rest }) => rest);
    const panels = panelsOf(rankEntities(plain).entities);
    assert.equal(panels.length, 1);
    assert.equal(panels[0].name, '');
  });
});

// ---------------------------------------------------------------------------
// N-6 — the readings are years apart, and the chart has to say so
// ---------------------------------------------------------------------------

describe('every bar carries its own period, and an old one is marked', () => {
  test('the United States 2021 reading is marked stale beside Denmark 2025', () => {
    const { entities, newestDate, staleCount } = rankEntities(ADOPTION, { cadence: 'annual' });
    const by = Object.fromEntries(entities.map((e) => [e.label, e]));

    assert.equal(newestDate, '2025-01-01');
    assert.equal(by['United States'].latest.date, '2021-01-01');
    assert.equal(by['United States'].stale, true, 'a 2021 reading beside a 2025 one is not the same moment');
    assert.equal(by['United Kingdom'].stale, true);
    assert.equal(by.Denmark.stale, false);
    // The UK's 2020 and the US's 2021, against a newest reading of 2025.
    assert.equal(staleCount, 2);
  });

  test('one ordinary publication lag behind is NOT stale', () => {
    // South Korea's 2024 against Denmark's 2025 is one annual survey round, not
    // a different era. Marking it would spend the warning on noise.
    const by = Object.fromEntries(
      rankEntities(ADOPTION, { cadence: 'annual' }).entities.map((e) => [e.label, e])
    );
    assert.equal(by['South Korea'].latest.date, '2024-01-01');
    assert.equal(by['South Korea'].stale, false);
  });

  test('the same rule at monthly cadence flags three months but not one', () => {
    const monthly = [
      { label: 'US', points: [{ date: '2026-01-01', value: 8 }, { date: '2026-07-01', value: 8.5 }] },
      { label: 'DE', points: [{ date: '2026-01-01', value: 7 }, { date: '2026-06-01', value: 7.1 }] },
      { label: 'GB', points: [{ date: '2026-01-01', value: 16 }, { date: '2026-04-01', value: 16.4 }] },
    ];
    const by = Object.fromEntries(
      rankEntities(monthly, { cadence: 'monthly' }).entities.map((e) => [e.label, e])
    );
    assert.equal(by.DE.stale, false, 'one month behind is the ordinary release lag');
    assert.equal(by.GB.stale, true, 'three months behind is a different quarter');
  });

  test('no baseline is shared across the adoption panel, and it says so', () => {
    // The UK holds only 2020 and Eurostat never ran in 2020, so there is no
    // period every country has. Asserting "since 2021" would be a claim about
    // comparability the data does not support.
    const ranked = rankEntities(ADOPTION, { cadence: 'annual' });
    assert.equal(ranked.sharedBaselineDate, null);
    assert.equal(ranked.baselinesDiffer, true);

    const by = Object.fromEntries(ranked.entities.map((e) => [e.label, e]));
    assert.equal(by.Denmark.baseline.date, '2021-01-01');
    assert.equal(by['United States'].baseline.date, '2017-01-01');
    assert.equal(by['United Kingdom'].baseline, null, 'one observation is not a change');
  });

  test('a shared baseline is used when every entity really holds one', () => {
    const shared = [
      { label: 'A', points: [{ date: '1999-06-01', value: 5 }, { date: '2026-07-01', value: 8 }] },
      { label: 'B', points: [{ date: '1990-01-01', value: 9 }, { date: '1999-06-01', value: 7 }, { date: '2026-07-01', value: 12 }] },
    ];
    const ranked = rankEntities(shared, { cadence: 'monthly' });
    assert.equal(ranked.sharedBaselineDate, '1999-06-01');
    assert.equal(ranked.baselinesDiffer, false);
    assert.deepEqual(ranked.entities.map((e) => e.baseline.value), [7, 5]);
  });

  test('a date that is somebody’s LATEST is never used as everybody’s baseline', () => {
    // Otherwise an entity whose only reading is the shared date would compare
    // against itself and render a bar of no change that is really no data.
    const ranked = rankEntities(
      [
        { label: 'Long', points: [{ date: '2020-01-01', value: 3 }, { date: '2025-01-01', value: 9 }] },
        { label: 'Short', points: [{ date: '2020-01-01', value: 4 }] },
      ],
      { cadence: 'annual' }
    );
    assert.equal(ranked.sharedBaselineDate, null);
    assert.equal(ranked.entities.find((e) => e.label === 'Short').baseline, null);
  });

  test('daysBetween is the arithmetic the staleness test rests on', () => {
    assert.equal(daysBetween('2021-01-01', '2025-01-01'), 1461);
    assert.equal(daysBetween('2024-01-01', '2025-01-01'), 366);
    assert.equal(daysBetween('2025-01-01', '2025-01-01'), 0);
  });
});

// ---------------------------------------------------------------------------
// Behaviour 13 — every chart is readable without seeing it
// ---------------------------------------------------------------------------

describe('behaviour 13 — the chart said out loud', () => {
  test('a line chart’s label carries unit, cadence, range and direction', () => {
    const label = describeSeriesChart(
      [series('US Youth Unemployment', [['1990-01-01', 12.4], ['2026-07-01', 8.5]])],
      { cadence: 'monthly', unit: 'percent' }
    );
    assert.match(label, /^Line chart\. 1 series, monthly, measured in percent\./);
    assert.match(label, /US Youth Unemployment: 8\.5 in Jul 2026, down from 12\.4 in Jan 1990\./);
  });

  test('it characterises nothing — only what the points say', () => {
    const label = describeSeriesChart([series('X', at([1, 2, 3, 90]))], { cadence: 'monthly', unit: '%' });
    for (const word of ['sharp', 'steep', 'dramatic', 'surge', 'plummet', 'broadly']) {
      assert.ok(!label.toLowerCase().includes(word), `the label editorialised: "${word}"`);
    }
  });

  test('an indexed chart says so rather than naming a unit it does not have', () => {
    const label = describeSeriesChart([series('X', at([100, 104]))], { indexed: true, unit: 'percent' });
    assert.match(label, /index points, 100 at the first shared period/);
  });

  test('a ranked chart’s label names every reading that is not from the newest period', () => {
    const label = describeRankedChart(rankEntities(ADOPTION, { cadence: 'annual' }), {
      unit: 'Percentage of enterprises',
      cadence: 'annual',
    });
    assert.match(label, /^Ranked bar chart\. 5 entities ordered by their most recent reading/);
    // Two instruments, so two rankings — one "highest overall" across both
    // would be the comparison the panels exist to refuse.
    assert.match(label, /in 2 panels ranked separately because they are not comparable at the level/);
    assert.match(label, /Eurostat — highest Denmark, 42 in 2025\. Lowest Poland, 8\.4 in 2025\./);
    assert.match(label, /OECD — highest South Korea, 32\.9 in 2024\./);
    assert.match(label, /3 of these 5 readings are older than 2025, so they are not measurements of the same moment/);
    assert.match(label, /United States 2021/);
    assert.match(label, /United Kingdom 2020/);
    // THE REGRESSION GUARD. South Korea's 2024 reading is exactly one annual period
    // behind 2025 — 366 days against a PERIOD_DAYS.annual of 366 — so `behind > 366`
    // is false and it is not MARKED. It is still older than the newest period, and
    // the sentence says "older than 2025", so it must be counted and named. It was
    // neither, and this assertion was written asserting the wrong number.
    assert.match(label, /South Korea 2024/);
    // Marked and older are different sets, and the label now says which is which
    // rather than presenting one count under the other's description.
    assert.match(label, /2 of those are more than one period behind and are marked on the chart/);
    assert.match(label, /Each bar is labelled with its own period\./);
  });

  test('a ranked chart with one vintage says that instead of warning about nothing', () => {
    const clean = rankEntities(
      [
        { label: 'A', points: [{ date: '2024-01-01', value: 1 }, { date: '2025-01-01', value: 3 }] },
        { label: 'B', points: [{ date: '2024-01-01', value: 2 }, { date: '2025-01-01', value: 4 }] },
      ],
      { cadence: 'annual' }
    );
    assert.match(describeRankedChart(clean, { unit: '%' }), /Every reading is from 2025\./);
    // Singular reads as singular: "1 of these 8 readings are" is the sort of
    // seam that tells a reader a sentence was assembled rather than written.
    const one = rankEntities(
      [
        { label: 'Fresh', points: [{ date: '2024-01-01', value: 1 }, { date: '2026-07-01', value: 3 }] },
        { label: 'Old', points: [{ date: '2024-01-01', value: 2 }, { date: '2026-04-01', value: 4 }] },
      ],
      { cadence: 'monthly' }
    );
    assert.match(
      describeRankedChart(one, { unit: '%', cadence: 'monthly' }),
      /1 of these 2 readings is older than Jul 2026, so they are not measurements of the same moment/
    );
  });

  test('the hidden table holds one row per period and one column per series', () => {
    const model = seriesTableModel(
      [series('A', at([1, 2, 3, 4])), series('B', [[MONTHS[0], 9], [MONTHS[3], 12]])],
      { cadence: 'monthly' }
    );
    assert.deepEqual(model.columns, ['Period', 'A', 'B']);
    assert.equal(model.rows.length, 4);
    assert.deepEqual(model.rows[1].cells, ['Feb 2024', '2.0', 'no data']);
    assert.equal(model.truncated, false);
  });

  test('a long series is capped and the cap is declared with the true total', () => {
    const long = {
      label: 'Long',
      points: Array.from({ length: 439 }, (_, i) => ({
        date: `${1990 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-01`,
        value: i,
      })),
    };
    const model = seriesTableModel([long], { cadence: 'monthly' });
    assert.equal(model.rows.length, TABLE_ROW_CAP);
    assert.equal(model.total, 439);
    assert.equal(model.truncated, true, 'a silently shortened table is a silently truncated axis');
    // The kept rows are the RECENT ones, which is what a reader is looking for.
    assert.equal(model.rows.at(-1).cells[1], '438');
  });

  test('the ranked table carries both readings AND both periods', () => {
    const model = rankedTableModel(rankEntities(ADOPTION, { cadence: 'annual' }), { cadence: 'annual' });
    assert.deepEqual(model.columns, [
      'Entity',
      'Latest reading',
      'Period of that reading',
      'Earlier reading',
      'Period of the earlier reading',
    ]);
    assert.deepEqual(model.rows[0].cells, ['Denmark (Eurostat)', '42', '2025', '23.9', '2021']);
    const uk = model.rows.find((r) => r.key === 'United Kingdom');
    assert.deepEqual(uk.cells.slice(3), ['no earlier reading', '—']);
  });

  test('the table is a SIBLING of the graphic, never inside it', () => {
    // role="img" makes everything inside it one opaque graphic, so a nested
    // table is unreachable: the fix would look right in the source and do
    // nothing. The check has to be structural — "there is a </div> somewhere
    // in between" is true of any JSX and proves nothing — so the wrapper's own
    // closing tag is found by balancing, and the table must come after it.
    for (const file of ['LineChart.jsx', 'RankedBarChart.jsx', 'SimulationChart.jsx', 'FigureChart.jsx']) {
      const src = readFileSync(join(ROOT, 'src/client/components/charts', file), 'utf8');
      assert.match(src, /role="img"/, `${file} draws a chart with no role="img"`);
      assert.match(src, /aria-label=/, `${file} has a role="img" with nothing to announce`);

      const table = src.indexOf('<ChartDataTable');
      assert.ok(table > 0, `${file} renders no data table`);

      // The OPENING TAG, not the first mention: these files discuss
      // `role="img"` in their comments, and matching the prose walks the
      // balancer back to the wrong element.
      const wrapper = src.match(/<div(?:\s[^>]*)?\srole="img"/);
      assert.ok(wrapper, `${file} does not put role="img" on a <div>`);
      assert.ok(
        table > closeOfWrapper(src, wrapper.index),
        `${file} nests its data table inside role="img", where nothing can reach it`
      );
    }
  });

  test('the table markup is hidden visually and NOT from assistive technology', () => {
    const SRC = readFileSync(join(ROOT, 'src/client/components/charts/ChartDataTable.jsx'), 'utf8');
    assert.match(SRC, /<table className="sr-only">/);
    // `display: none` and the `hidden` attribute remove an element from the
    // accessibility tree as well as from the page, which is the same mistake
    // in a different spelling. Checked on the markup, not on the prose above it.
    const markup = SRC.slice(SRC.indexOf('export default function'));
    assert.doesNotMatch(markup, /<table[^>]*\bhidden\b/);
    assert.doesNotMatch(markup, /display:\s*'?none/);
    assert.match(SRC, /scope="col"/);
    assert.match(SRC, /scope="row"/);
  });
});

// ---------------------------------------------------------------------------
// Behaviour 9, second half — a report figure that is not a measurement
// ---------------------------------------------------------------------------

const WEF_JOBS = [
  { series: '', label: 'Created', value: 170, basis: 'projected' },
  { series: '', label: 'Displaced', value: 92, basis: 'projected' },
];

const HAI_MIXED = [
  { series: 'Actual decrease over the past year', label: 'Customer service', value: 11, basis: 'measured' },
  { series: 'Expected decrease over the next year', label: 'Customer service', value: 24, basis: 'expectation' },
];

describe('behaviour 9 — a forecast is never drawn in the ink of a measurement', () => {
  test('a wholly projected figure says every bar is one', () => {
    assert.equal(
      figureBasisNote(WEF_JOBS),
      'Every bar here is a projection, not a measurement — drawn hatched, not solid.'
    );
  });

  test('a mixed figure names WHICH series, because "part of this" is unusable', () => {
    const note = figureBasisNote(HAI_MIXED);
    assert.match(note, /Expected decrease over the next year/);
    assert.doesNotMatch(note, /Actual decrease over the past year/);
    assert.match(note, /what respondents expect, not what has been measured/);
  });

  test('an unclassified figure is left exactly as it was', () => {
    // NULL basis means nobody has said. That is not a claim that it was
    // measured, so it must not be drawn as one either way.
    assert.equal(figureBasisNote([{ series: '', label: 'A', value: 1 }]), null);
    assert.equal(figureBasisNote([{ series: '', label: 'A', value: 1, basis: 'measured' }]), null);
  });

  test('the figure table gains a basis column only where a basis is recorded', () => {
    assert.deepEqual(figureTableModel(WEF_JOBS, { decimals: 0 }).columns, [
      'Label',
      'Value',
      'What this number is',
    ]);
    assert.deepEqual(figureTableModel([{ series: '', label: 'A', value: 1 }]).columns, ['Label', 'Value']);
    assert.deepEqual(figureTableModel(HAI_MIXED, { decimals: 0, unitSymbol: '%' }).rows[1].cells, [
      'Customer service',
      'Expected decrease over the next year',
      '24%',
      'what respondents expect, not what has been measured',
    ]);
  });

  test('the spoken description names the basis of every bar that has one', () => {
    const said = describeFigureChart(WEF_JOBS, { unit: 'million jobs by 2030', decimals: 0 });
    assert.match(said, /drawn from a zero baseline/);
    assert.match(said, /Created: 170 — a projection, not a measurement\./);
  });

  test('FigureChart hatches a non-measured bar and marks it in words', () => {
    const SRC = readFileSync(join(ROOT, 'src/client/components/charts/FigureChart.jsx'), 'utf8');
    assert.match(SRC, /repeating-linear-gradient/, 'a forecast bar is not drawn as a solid bar');
    assert.match(SRC, /const basisNote = figureBasisNote\(points\);/);
    // The hatch is not the disclosure — the same rule the raw-units line follows.
    assert.match(SRC, /BASIS_MARK\[point\.basis\]/);
    assert.match(SRC, /projected: 'projected'/);
  });
});

// ---------------------------------------------------------------------------
// The build gate behind behaviour 10 — `npm run check:charts`
//
// Read out of the script and evaluated rather than imported, because importing
// it drags in the database pool. Same trick as palette.js above, same reason:
// a test holding its own copy of the logic proves nothing about the logic.
// ---------------------------------------------------------------------------

const GATE_SRC = readFileSync(join(ROOT, 'scripts/check-chart-groups.js'), 'utf8');
const { classifyGroups } = evaluateExports(GATE_SRC, ['classifyGroups']);

describe('check:charts — the data half of behaviour 10', () => {
  const group = (chart_group, question_id, members, form = null) => ({
    chart_group,
    question_id,
    members,
    form,
  });

  test('a colour-coded group past the palette is caught', () => {
    const { over } = classifyGroups([group('ai-adoption-panel', 'adoption', 16, 'line')], 6);
    assert.deepEqual(over.map((r) => r.chart_group), ['ai-adoption-panel']);
  });

  test('a group with NO declared form is treated as a line chart and still caught', () => {
    // This is the state of the live database until 0025 and seed 037 are
    // applied. Defaulting an unknown form to "exempt" would have hidden both
    // blockers behind a pending migration.
    const { over } = classifyGroups([group('youth-unemployment', 'entry-level', 8)], 6);
    assert.equal(over.length, 1);
  });

  test('a ranked-bars group is exempt, because colour encodes nothing in it', () => {
    const rows = [group('ai-adoption-panel', 'adoption', 16, 'ranked-bars')];
    const { over, exempt } = classifyGroups(rows, 6);
    assert.deepEqual(over, []);
    assert.deepEqual(exempt.map((r) => r.members), [16]);
  });

  test('the exemption does not leak to a group that merely fits', () => {
    const { over, exempt } = classifyGroups([group('enterprise-ai', 'adoption', 4, 'line')], 6);
    assert.deepEqual(over, []);
    assert.deepEqual(exempt, [], 'a group inside the palette is not "exempt", it is simply fine');
  });

  test('exactly the palette length is not over it', () => {
    assert.deepEqual(classifyGroups([group('six', 'q', 6, 'line')], 6).over, []);
    assert.equal(classifyGroups([group('seven', 'q', 7, 'line')], 6).over.length, 1);
  });

  test('the query counts per question, because that is what one chart holds', () => {
    // `enterprise-ai` has eight rows across two questions and four on each.
    // Grouping by chart_group alone reported it as a third broken group in the
    // QA brief and in this gate's own header; no page has ever drawn eight.
    assert.match(GATE_SRC, /GROUP BY qi\.chart_group, qi\.question_id/);
    assert.match(GATE_SRC, /qi\.question_id,\n\s+count\(\*\)::int/);
  });
});

/**
 * Index just past the `</div>` that closes the element carrying `role="img"`.
 *
 * Counts opening and closing div tags from the wrapper's own `<div`, so a
 * nested chart body does not fool it.
 */
function closeOfWrapper(src, start) {
  let depth = 0;
  const tag = /<div\b|<\/div>/g;
  tag.lastIndex = start;
  for (let m = tag.exec(src); m; m = tag.exec(src)) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  assert.fail('the role="img" wrapper is never closed');
}

// ---------------------------------------------------------------------------
// The row labels on a ranked chart
//
// A display transformation on strings the editorial layer wrote — not an
// editorial decision — but it is the one place a country could lose its name,
// so it is exercised rather than trusted.
// ---------------------------------------------------------------------------

const RANKED_SRC = readFileSync(join(ROOT, 'src/client/components/charts/RankedBarChart.jsx'), 'utf8');
const { sharedSuffix, trimSuffix } = evaluateExports(RANKED_SRC, ['sharedSuffix', 'trimSuffix']);

describe('ranked bar labels — a shared ending is dropped, an identity never is', () => {
  const ADOPTION_NAMES = [
    'Germany — Enterprises using AI',
    'France — Enterprises using AI',
    'United Kingdom — Enterprises using AI',
  ];

  test('sixteen rows do not each repeat "— Enterprises using AI"', () => {
    const suffix = sharedSuffix(ADOPTION_NAMES);
    assert.equal(suffix, ' — Enterprises using AI');
    assert.deepEqual(
      ADOPTION_NAMES.map((n) => trimSuffix(n, suffix)),
      ['Germany', 'France', 'United Kingdom']
    );
  });

  test('names with no meaningful shared ending are left whole', () => {
    // The FRED youth-unemployment names differ in their age bands — "(16–24)"
    // against "(15–24)" — so the only shared ending is "–24)", which is not a
    // name and must not be cut.
    const fred = ['US Youth Unemployment (16–24)', 'Korean Youth Unemployment (15–24)'];
    assert.equal(sharedSuffix(fred), '');
    assert.deepEqual(fred.map((n) => trimSuffix(n, '')), fred);
  });

  test('a row is never trimmed down to nothing', () => {
    assert.equal(sharedSuffix(['Enterprises using AI', 'Germany — Enterprises using AI']), '');
    assert.equal(trimSuffix('Germany', 'Germany'), 'Germany');
  });

  test('one series has no shared ending to find', () => {
    assert.equal(sharedSuffix(['Only one — Enterprises using AI']), '');
  });
});

/**
 * RankedBarChart fetches in chunks because /api/series caps at 12 ids. React
 * forbids calling a hook in a loop, so the calls are written out one per chunk —
 * which means the CAP and the NUMBER OF CALLS are two facts that must agree, kept
 * in two places, with nothing connecting them.
 *
 * They disagreed once. MAX_REQUESTS was three, sized against "the Eurostat
 * expansion's 33" — but that was the size of one PANEL, while chunks are built
 * from the whole chart_group, which the country seeds take to 44. Raising the cap
 * without adding the fourth call would have been worse than leaving it: the chart
 * would draw, and eight countries would be missing from it silently.
 *
 * A chart that quietly omits entities is the failure this whole component exists
 * to prevent, so the invariant is asserted rather than remembered.
 */
describe('RankedBarChart — the fetch cap and the hooks agree', () => {
  const source = readFileSync(
    new URL('./RankedBarChart.jsx', import.meta.url),
    'utf8'
  );

  test('there is exactly one useSeries call per permitted request', () => {
    const cap = Number(source.match(/const MAX_REQUESTS = (\d+)/)[1]);
    const calls = source.match(/const \w+ = useSeries\(chunks\[\d\]/g) ?? [];
    assert.equal(
      calls.length,
      cap,
      `MAX_REQUESTS is ${cap} but ${calls.length} useSeries calls are written out — ` +
      `chunk ${calls.length} onwards would never be fetched and its entities would ` +
      `vanish from the chart without a word`
    );
  });

  test('every fetched chunk is collected into the results array', () => {
    const cap = Number(source.match(/const MAX_REQUESTS = (\d+)/)[1]);
    const listed = source.match(/const requests = \[([^\]]*)\]/)[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    assert.equal(
      listed.length,
      cap,
      `${listed.length} of ${cap} request results are collected — the rest are ` +
      `issued and then discarded`
    );
  });

  test('the cap covers the adoption panel the seeds actually build', () => {
    // 33 Eurostat (10 in seed 020 + 23 in 042) and 11 OECD (6 in 020 + 5 in 043).
    const PANEL_AFTER_SEEDS = 44;
    const perRequest = Number(source.match(/const SERIES_PER_REQUEST = (\d+)/)[1]);
    const cap = Number(source.match(/const MAX_REQUESTS = (\d+)/)[1]);
    assert.ok(
      perRequest * cap >= PANEL_AFTER_SEEDS,
      `the chart carries ${perRequest * cap} entities but ai-adoption-panel becomes ` +
      `${PANEL_AFTER_SEEDS}, so /q/adoption would refuse to draw again the moment ` +
      `the country seeds are applied`
    );
  });
});
