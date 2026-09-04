# The thirteen chart honesty behaviours

These are the rules this project counts as non-negotiable for anything it
draws. They existed only as the phrase "the 12 chart honesty behaviours" in an
approved plan — never enumerated, never tested — until 3 September 2026, when
they were reconstructed from the code that already implemented all twelve.

A THIRTEENTH was added on 4 September 2026, and it is the only one on this list
that was not already implemented when it was written down. A grep across every
file in this folder for `role="img"`, `aria-label`, `<desc>`, `<title>` inside
an SVG or a hidden data table returned nothing: every chart on the site was
silence to a screen reader. The site's structure is "the answer, then the
evidence", so a blind reader got the answer and none of the evidence — on a
site whose whole argument is that you should check the working. The project
handles `prefers-reduced-motion` in six separate places, so the accessibility
thinking existed here and simply stopped at motion.

A rule that is counted but never written down cannot be handed over and cannot
be checked. Two of these had already been broken elsewhere in this codebase
precisely because there was no list to check against.

## How to use this file

Every behaviour below cites the exact line that implements it, in the form:

    - `path:line` — contains `anchor text`

`honesty.test.js`, next to this file, **reads this document and asserts that
every one of those lines still contains its anchor**. So moving the code turns
the test red and the list gets updated, rather than rotting into a set of line
numbers that point at nothing. That is the only thing keeping this file true.

Each behaviour also carries a `Coverage:` tag, and only these four exist:

| Tag | Meaning |
| --- | --- |
| `unit` | the decision is a pure function and `honesty.test.js` exercises it |
| `unit (partial)` | the decision is tested; the words a reader sees are not |
| `source-check` | not runnable logic — asserted by reading the source |
| `render-only — not covered here` | needs a DOM; **genuinely untested** |

Five of the thirteen are `render-only`. That is an honest gap, not an oversight:
this repo has no DOM test runner (`npm test` is bare `node --test`). Closing it
means adding one, which is a decision with a cost and belongs to the owner. A
behaviour that LOOKS tested is worse than one openly marked untested, so the
gaps are named rather than papered over.

---

## 1. One y-axis, always — never a dual axis

Two measures that cannot share a scale become two charts, never two axes. A
second axis lets any two series be made to cross wherever the author wants.
Series on different scales are rebased server-side to index 100 at a shared
base period instead (`/api/series?index=true`).

- `src/client/components/charts/LineChart.jsx:34` — contains `ONE Y-AXIS, ALWAYS.`
- `src/client/components/charts/LineChart.jsx:168` — contains `<YAxis`

Coverage: `render-only — not covered here`

## 2. The y-axis starts at zero unless the scale is an index

A padded floor below the observed minimum is a real trend-exaggeration
technique. It is permitted only for an index moving in a tight band around 100,
where forcing zero flattens the whole shape into a line at the top of the
frame — and even then only with behaviour 3.

- `src/client/components/charts/chartModel.js:104` — contains `const nearZero = min >= 0 && min < range * 0.35;`
- `src/client/components/charts/chartModel.js:105` — contains `const floor = nearZero ? 0 : indexed ? niceFloor(min, range) : Math.min(0, min);`

Coverage: `unit`

## 3. A truncated axis is disclosed on the chart face

Not in a caption, not in a footnote — above the frame, where the reader is
looking at the shape it changes.

- `src/client/components/charts/chartModel.js:112` — contains `axisTruncated: floor > 0,`
- `src/client/components/charts/LineChart.jsx:117` — contains `{axisTruncated && (`
- `src/client/components/charts/LineChart.jsx:119` — contains `Axis does not start at 0`

Coverage: `unit (partial)`

## 4. A bar chart may never truncate its axis, and the option does not exist

The encoding of a bar is its LENGTH, so cutting the axis does not rescale the
view, it rescales the claim: 42 next to 38 becomes four times as long as its
neighbour. No disclosure repairs that, so `FigureChart` takes no prop for it and
clamps the domain to include zero — and so does the ranked bar form, where the
clamp is inside `rankEntities` so there is nowhere for a prop to be added.

- `src/client/components/charts/FigureChart.jsx:41` — contains `THE ZERO BASELINE IS NOT A DEFAULT HERE, IT IS THE RULE`
- `src/client/components/charts/FigureChart.jsx:103` — contains `const max = Math.max(0, ...values);`
- `src/client/components/charts/FigureChart.jsx:104` — contains `const min = Math.min(0, ...values);`
- `src/client/components/charts/chartModel.js:308` — contains `domain: [Math.min(0, ...values), Math.max(0, ...values)],`

Coverage: `unit`

## 5. A gap in the data breaks the line

A straight segment across missing months asserts data that was never collected.
A date missing for one series becomes `null` in the row rather than a skipped
key, which is what lets `connectNulls={false}` break it.

- `src/client/components/charts/chartModel.js:79` — contains `row[s.label] = split.projectedDates.has(date) ? null : value;`
- `src/client/components/charts/LineChart.jsx:202` — contains `connectNulls={false}`
- `src/client/components/charts/LineChart.jsx:224` — contains `connectNulls={false}`

Coverage: `unit (partial)`

## 6. A series that could not be rebased is drawn dashed AND labelled in words

When the server cannot index a series (its value was 0 at the shared base
period) it shares an axis with true index points while meaning something else.
The dash is not the disclosure: a reader who does not know the convention reads
a dashed line as a line, so the label says "(raw units)" too.

- `src/client/components/charts/SeriesChart.jsx:51` — contains `(raw units)`
- `src/client/components/charts/LineChart.jsx:199` — contains `strokeDasharray={s.raw ? '5 4' : undefined}`

Coverage: `render-only — not covered here`

## 7. The footer states how many series were rebased and how many were not

Counted from the response, not from the request: asking for a rebase and
getting one are different facts, and claiming the second before the payload
arrives is a guess dressed as a fact.

- `src/client/components/charts/ChartGroup.jsx:117` — contains `series rebased`

Coverage: `render-only — not covered here`

## 8. A cadence mismatch is warned about above the chart

Nothing stops a chart group pairing an annual series with a monthly one — only
matching units are enforced. The axis follows the finer cadence, and that is
said out loud rather than blended away.

- `src/client/components/charts/SeriesChart.jsx:95` — contains `{cadenceMismatch && (`
- `src/client/components/charts/SeriesChart.jsx:97` — contains `These series report at different cadences`

Coverage: `render-only — not covered here`

## 9. Publisher forecasts are drawn on their own dashed line, named and dated

A forecast is never rendered as if it were a measurement. Status is read PER
POINT, not as "everything after the first projection", so a revised outturn
following a forecast is not redrawn as a forecast. The measured point
immediately before is repeated on the dashed line so the two meet. "Part of
this is a forecast" is unusable, so the note names WHICH series and FROM WHEN.

A report FIGURE is the same rule in a different table. `report_figure_points`
had no status column, so "Jobs projected to be created and displaced by 2030"
drew in exactly the ink of a measurement and the distinction lived only in the
title. `basis` (db/migrations/0025) is the per-point counterpart of
`value_status`: a projected, scenario or expectation bar is hatched, marked in
words at the end of the bar, and named in a note ABOVE the chart.

- `src/client/components/charts/chartModel.js:130` — contains `export function splitProjected(points) {`
- `src/client/components/charts/chartModel.js:141` — contains `bridgeDates.add(previous.date);`
- `src/client/components/charts/LineChart.jsx:221` — contains `strokeDasharray="5 4"`
- `src/client/components/charts/SeriesChart.jsx:70` — contains `const forecasts = mapped`
- `src/client/components/charts/chartModel.js:546` — contains `export function figureBasisNote(points) {`
- `src/client/components/charts/FigureChart.jsx:128` — contains `const basisNote = figureBasisNote(points);`

Coverage: `unit (partial)`

## 10. No chart draws more series than there are validated hues

There are exactly six CVD-validated hues in a fixed order. `colorAt` wraps
silently, so series 7 gets series 1's colour and the legend claims otherwise —
a wrong chart that renders is worse than one that refuses, because nobody
investigates it. Callers ask `exceedsPalette` first and refuse.

THE CEILING IS A FACT ABOUT COLOUR, so the answer for more than six categorical
series is a form where colour is not the encoding: `RankedBarChart` draws one
bar per entity in ONE hue, sorted by the latest value. Which groups draw that
way is read from `chart_forms` in the editorial layer, never inferred from
`members.length` — inferring it would let a seventh country silently change the
shape of an argument. The refusal above stays as the fallback for a group with
no ruling, because removing it would reopen the failure it was built to catch.

- `src/client/lib/format.js:29` — contains `export const SERIES_COLORS = ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'];`
- `src/client/components/charts/palette.js:75` — contains `export function exceedsPalette(count, palette) {`
- `src/client/components/charts/ChartGroup.jsx:81` — contains `const tooManySeries = !ranked && exceedsPalette(members.length, palette);`
- `src/client/components/charts/ChartGroup.jsx:127` — contains `) : tooManySeries ? (`
- `src/client/components/charts/FigureChart.jsx:100` — contains `const tooManySeries = series.length > SERIES_COLORS.length;`
- `src/client/components/charts/RankedBarChart.jsx:188` — contains `const hue = colorAt(palette, 0);`

Coverage: `unit (partial)`

## 11. Two values for one date means refuse, not pick one

A series holding two values for one period cannot be drawn as a line without
silently choosing between them. It means the request was missing a filter,
usually a country. Detected, never resolved — collapsing duplicates would hide
the missing filter behind a plausible-looking line.

- `src/client/components/charts/chartModel.js:58` — contains `const duplicateDates = series.some((s) => {`
- `src/client/components/charts/LineChart.jsx:87` — contains `if (duplicateDates) {`

Coverage: `unit (partial)`

## 12. A legend is always present at two or more series

Identity never rests on colour alone. A reader who cannot separate two hues can
still read the label, and can switch one off to see the other on its own.

- `src/client/components/charts/LineChart.jsx:243` — contains `{series.length > 1 && (`
- `src/client/components/charts/SeriesLegend.jsx:14` — contains `Present whenever there is more than one series`

Coverage: `render-only — not covered here`

## 13. Every chart is readable without seeing it

A chart that only exists as pixels is evidence a blind reader cannot check. The
wrapper carries `role="img"` and an `aria-label` built from the same points the
chart draws — how many series, at what cadence, in what unit, where each one
ended and where it started — and a visually-hidden `<table>` of those points
sits BESIDE it, not inside it, because `role="img"` makes everything within it
one opaque graphic and a nested table would be unreachable.

Nothing in the label is characterised. No "sharp rise", no "broadly flat": the
front end arranges evidence, it does not author claims, and that rule does not
relax because the output is a sentence rather than a line.

The ranked bar form's label is the one that matters most, because its dates are
load-bearing — see behaviour 10 and the note in `rankEntities`.

- `src/client/components/charts/chartModel.js:362` — contains `export function describeSeriesChart(series, {`
- `src/client/components/charts/chartModel.js:461` — contains `export function seriesTableModel(series, {`
- `src/client/components/charts/ChartDataTable.jsx:38` — contains `<table className="sr-only">`
- `src/client/components/charts/LineChart.jsx:134` — contains `aria-label={describeSeriesChart(series, { cadence, unit, indexed })}`
- `src/client/components/charts/FigureChart.jsx:178` — contains `aria-label={describeFigureChart(points, {`
- `src/client/components/charts/RankedBarChart.jsx:233` — contains `aria-label={describeRankedChart(ranked, { unit, cadence, decimals })}`
- `src/client/components/charts/SimulationChart.jsx:97` — contains `aria-label={describeSimulation(rows, series, baseline)}`

Coverage: `unit (partial)`

---

## What enforces what

| Guard | What it catches |
| --- | --- |
| `npm test` (`honesty.test.js`) | the pure decisions behind behaviours 2, 3, 5, 9, 10, 11 — and every stale citation above |
| `npm run check:contrast` | the palette behind behaviour 10: exactly six hues, in order, at the exact validated hex |
| `npm run check:charts` | any `chart_group` in the database with more members than there are hues — the data half of behaviour 10 |

`check:charts` is **not** in the `build` chain yet, and there are two reasons.

The temporary one: it counts what is in the LIVE database, and
`db/migrations/0025_chart_form_and_figure_basis.sql` and
`db/seeds/037_chart_form.sql` are written but not yet applied. Until they are,
`chart_forms` does not exist, both ranked-bar groups are still read as line
charts, and the gate is red on `ai-adoption-panel` (16) and
`youth-unemployment` (8). Wiring a red gate into `build` teaches people to skip
it.

The permanent one, which is check-data.js's reason too: it needs a reachable
database, and a front-end build that fails when Postgres is asleep is a build
people learn to work around.

`enterprise-ai` was on that list and should never have been. It has eight rows
across two questions — four on `adoption`, four different ones on
`diffusion-speed` — and the front end fetches per question, so no page ever
drew more than four. The gate now counts per (chart_group, question_id), which
is how the app reads it.
