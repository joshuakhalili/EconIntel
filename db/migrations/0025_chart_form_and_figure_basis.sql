-- ============================================================================
-- 0025_chart_form_and_figure_basis.sql
--
-- Two columns and one table, all of them the same idea: a presentation
-- decision that carries meaning is an EDITORIAL fact and belongs in the
-- editorial layer, not in a conditional in a component.
--
-- ── 1. WHICH FORM A CHART GROUP DRAWS IN ───────────────────────────────────
--
-- `chart_group` is the statement that these indicators belong on one pair of
-- axes. There are exactly six CVD-validated hues in a fixed order, so six is
-- also the honest maximum for a form that encodes identity BY COLOUR: past it,
-- `colorAt` wraps and two countries are drawn identically under a legend
-- claiming they are distinguishable.
--
-- Two live groups are past it. `ai-adoption-panel` holds sixteen countries on
-- /q/adoption — the question this project is named after — and
-- `youth-unemployment` holds eight on /q/entry-level, where it is the HERO
-- chart, directly under a heading promising "the chart this rests on".
-- ChartGroup refused to draw both, correctly, and both pages shipped a grey
-- box of apology where their evidence should be.
--
-- The answer is a form where colour is not the encoding: a ranked horizontal
-- bar chart, one hue for every bar, sorted by the latest value, with a muted
-- bar behind each for its earlier reading. Rank carries what colour carried,
-- and the palette ceiling stops applying because nothing is distinguished by
-- colour any more.
--
-- WHY A TABLE AND NOT `members.length > 6`
--
-- Because inferring the form from the count puts an editorial decision in a
-- place no editor can see, and makes a seventh country silently change the
-- shape of an argument. A row here is a person's ruling, with the reason they
-- gave and the date they gave it, and it can be overruled by editing data
-- rather than by editing React.
--
-- A group with no row draws as a line chart, which is what every group did
-- before this existed. A group with no row and more members than there are
-- hues still refuses — that refusal is the fallback and is deliberately kept.
--
-- ── 2. WHICH INSTRUMENT A SERIES CAME FROM ─────────────────────────────────
--
-- `question_indicators.series_panel` splits one chart group into sub-panels
-- that are ranked separately. The adoption panel is the live case:
-- db/seeds/020_ai_adoption_panel.sql already argues, in its own header and in
-- the chart's stored caption, that Eurostat's `isoc_eb_ai` (one harmonised
-- survey, one definition, every member state) and OECD's `DSD_ICT_B` (national
-- surveys compiled after the fact) are not comparable AT THE LEVEL. Ranking
-- them against each other in one column would assert exactly the comparability
-- the seed denies.
--
-- The label is not derived from the indicator id prefix. Which instrument a
-- series belongs to is a claim about method, and a claim is written down by a
-- person, not pattern-matched from a string.
--
-- ── 3. WHAT A REPORT FIGURE'S NUMBER ACTUALLY IS ───────────────────────────
--
-- Seed 029 established that a forecast drawn like a measurement is the failure
-- this project exists to prevent, and wired `value_status` through
-- observations → /api/series → SeriesChart → LineChart: a projected segment is
-- dashed and carries a note naming the series and the date it starts from.
--
-- None of that ever reached report figures. `report_figure_points` held only
-- (figure_id, series, label, sort_order, value), so "Jobs projected to be
-- created and displaced by 2030", "Forecast years until artificial general
-- intelligence arrives" and "Expected change in a business function's
-- headcount" drew in exactly the ink of a measurement. The letter of the rule
-- held — the words are in the titles — but the site's own standard for series
-- charts is higher than that.
--
-- `basis` IS ON THE POINT, NOT ON THE FIGURE.
--
-- Four live figures put a measured series beside an expected one in one chart:
--   deloitte-agentic-ai-usage-today-vs-two-years    'Today' / 'In two years'
--   deloitte-ai-benefits-achieved-vs-hoped          'Achieving today' / 'Hope to achieve'
--   deloitte-physical-ai-adoption-by-region         'Today' / 'In 2 years'
--   hai-workforce-reductions-observed-vs-expected   actual / expected
-- A figure-level field would mislabel half the bars of every one of them.
--
-- NULL means "nobody has classified this yet", which is NOT the same as
-- 'measured'. An unclassified point renders exactly as it did before, because
-- the absence of a classification is not itself a claim.
-- ============================================================================

/**
 * The forms a chart group may be drawn in.
 *
 * `line`        — one hue per series on one pair of axes. Bounded by the
 *                 palette: never more series than there are validated hues.
 * `ranked-bars` — one bar per entity, one hue for all of them, sorted by the
 *                 latest value, with a muted bar behind each for its earlier
 *                 reading. Colour encodes nothing, so the palette ceiling does
 *                 not apply and the form scales to 33 entities.
 *
 * Adding a value here is adding a component. It is an enum rather than free
 * text so a typo in a seed fails at the INSERT rather than falling back to a
 * line chart and looking like a decision.
 */
CREATE TYPE chart_form AS ENUM ('line', 'ranked-bars');

CREATE TABLE chart_forms (
  chart_group  TEXT PRIMARY KEY,
  form         chart_form  NOT NULL,

  -- NOT NULL because the whole point of the table is that the decision is
  -- attributable and arguable. A form with no stated reason is the inference
  -- this table exists to replace, just written somewhere else.
  reason       TEXT        NOT NULL CHECK (length(btrim(reason)) > 0),
  decided_on   DATE        NOT NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE chart_forms IS
  'One row per chart_group naming the form a person chose for it and why. '
  'A group with no row draws as a line chart. Never inferred from member count.';

/**
 * The sub-panel a member belongs to inside its chart group.
 *
 * NULL — the ordinary case — means one panel. A value means this member is
 * ranked only against the others carrying the same value, because the two
 * groups are measured by different instruments and their LEVELS are not
 * comparable even though their units match.
 */
ALTER TABLE question_indicators ADD COLUMN series_panel TEXT;

COMMENT ON COLUMN question_indicators.series_panel IS
  'Sub-panel within a chart_group: members are ranked only against others '
  'sharing this label. NULL means one panel. Set where two instruments share '
  'a unit but are not comparable at the level.';

/**
 * What kind of number a report-figure bar is.
 *
 * `measured`    — already happened, and the source is reporting it.
 * `projected`   — the source's own forecast of a future value.
 * `scenario`    — one branch of several the source models, chosen for
 *                 illustration. Not a forecast: the source is not saying this
 *                 is what will happen.
 * `expectation` — what the people surveyed say they expect. A measurement of
 *                 opinion, which is not a measurement of the world.
 */
CREATE TYPE figure_basis AS ENUM ('measured', 'projected', 'scenario', 'expectation');

ALTER TABLE report_figure_points ADD COLUMN basis figure_basis;

COMMENT ON COLUMN report_figure_points.basis IS
  'What this number is: measured / projected / scenario / expectation. NULL '
  'means not yet classified, which is not the same as measured — an '
  'unclassified point is drawn without a marker either way.';
