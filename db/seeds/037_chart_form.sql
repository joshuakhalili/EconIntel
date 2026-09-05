-- ============================================================================
-- 037_chart_form.sql — the editorial decisions 0025 made recordable
--
-- Three sets of rows, one migration behind them (0025):
--
--   1. `chart_forms`                     which form two chart groups draw in
--   2. `question_indicators.series_panel` which instrument each series came from
--   3. `report_figure_points.basis`      what kind of number each bar is
--
-- ── 1. TWO GROUPS BECOME RANKED BARS ───────────────────────────────────────
--
-- Verified against the live database on 4 September 2026:
--
--   SELECT chart_group, question_id, count(*) FROM question_indicators
--    WHERE chart_group IS NOT NULL GROUP BY 1,2 HAVING count(*) > 6;
--     → ai-adoption-panel  / adoption     16
--       youth-unemployment / entry-level   8
--
-- Those are the only two. `enterprise-ai` shows eight rows when counted per
-- GROUP, which is how scripts/check-chart-groups.js counted it and how the QA
-- brief reported it — but the eight are four members on `adoption` and four
-- different ones on `diffusion-speed`, and the front end fetches indicators
-- per question (repositories/questions.js: WHERE qi.question_id = $1). No page
-- ever draws more than four of them, so it never refused and it needs no
-- ruling. The gate has been corrected to count per (chart_group, question_id).
--
-- Both rulings are the same one: sixteen countries, or eight, cannot be told
-- apart by six hues, and the honest form is one where colour is not the
-- encoding at all.
--
-- ── 2. THE ADOPTION PANEL IS TWO INSTRUMENTS, NOT ONE ──────────────────────
--
-- db/seeds/020_ai_adoption_panel.sql already says this, twice: in its header
-- ("OECD compiles national surveys, so it reaches beyond Europe but pays for it
-- in comparability") and in the chart's own stored caption ("Harmonised within
-- Eurostat, not across the OECD additions — read the level differences between
-- those two groups as partly definitional").
--
-- A ranked bar chart sorts by level. Ranking a Eurostat reading against an OECD
-- one asserts exactly the comparability those two sentences deny, so the panel
-- is split and each half is ranked within itself.
--
-- ── 3. WHAT EACH REPORT-FIGURE BAR IS ──────────────────────────────────────
--
-- Every classification below is read off the figure's own stored title,
-- subtitle or verbatim quote — the text already in the database, not a
-- judgement about the underlying study. Where a figure's own text does not
-- settle it, `basis` is left NULL: this file names TEN figures — one
-- `projected`, one `scenario`, four wholly `expectation` and four mixed — so
-- 46 of the 56 are unclassified after it and render exactly as they did
-- before, because NULL means "nobody has said" and not "measured".
--
-- Counted, not recalled, on 2026-09-04: `SELECT count(*) FROM report_figures`
-- → 56, and the ten ids below are all present in it. An earlier draft of this
-- header said "47 of the 57", which was wrong in both halves.
-- ============================================================================

-- ── 1. Chart forms ─────────────────────────────────────────────────────────

INSERT INTO chart_forms (chart_group, form, reason, decided_on) VALUES

('ai-adoption-panel', 'ranked-bars',
 'Sixteen country series against six CVD-validated hues, on /q/adoption — the '
 'question this project is named after, which shipped a grey "Not drawn" box '
 'where its evidence should be. Drawn as ranked horizontal bars: one bar per '
 'country sorted by its latest reading, every bar the same hue, a muted bar '
 'behind each for its earliest reading. Colour then encodes nothing, so the '
 'palette ceiling stops applying, and the form still reads at the 33 countries '
 'the Eurostat expansion adds. Small multiples were the alternative and keep '
 'each trajectory''s shape; they were not chosen because rank is what a reader '
 'wants from a diffusion panel and four annual points make a poor sparkline. '
 'Every bar carries its own period, because six of these sixteen readings stop '
 'between 2020 and 2024 while the Eurostat ten reach 2025.',
 DATE '2026-09-04'),

('youth-unemployment', 'ranked-bars',
 'Eight FRED country series against six hues, and this is the HERO chart of '
 '/q/entry-level — the band headed "The evidence / The chart this rests on" '
 'rendered no chart at all. Same form and same reason as the adoption panel. '
 'Cutting the group to six countries was the alternative and was rejected: the '
 'comparison is the argument, and dropping two countries to fit a palette is '
 'the palette deciding the evidence.',
 DATE '2026-09-04')

ON CONFLICT (chart_group) DO UPDATE SET
  form = EXCLUDED.form,
  reason = EXCLUDED.reason,
  decided_on = EXCLUDED.decided_on;

-- ── 2. The two instruments in the adoption panel ────────────────────────────
--
-- Matched on the indicator id prefix HERE, once, in a file a person wrote —
-- not in the component, which must never infer an editorial fact from a string
-- pattern at render time.

UPDATE question_indicators
   SET series_panel = 'Eurostat — one harmonised survey, ten member states'
 WHERE chart_group = 'ai-adoption-panel'
   AND indicator_id LIKE 'eurostat.ai_any.%';

UPDATE question_indicators
   SET series_panel = 'OECD — national surveys, compiled; levels not comparable with the above'
 WHERE chart_group = 'ai-adoption-panel'
   AND indicator_id LIKE 'oecd.ai_any.%';

-- ── 3. Report figures that are not measurements ─────────────────────────────

-- Wholly projections. The source's own forecast of a future value.
--   Title: "Jobs projected to be created and displaced by 2030"
--   Quote: "…are projected to create around 170 million new jobs by 2030,
--           while displacing about 92 million existing jobs."
UPDATE report_figure_points SET basis = 'projected'
 WHERE figure_id = 'wef-jobs-created-vs-displaced-by-2030';

-- Wholly a scenario. Not a forecast — the source models four branches and this
-- is one of them, chosen for illustration.
--   Subtitle: "Scenario 2 of four, exponential AI advancement with limited
--              workforce readiness, global position in 2030"
UPDATE report_figure_points SET basis = 'scenario'
 WHERE figure_id = 'wef-task-automation-age-of-displacement-2030';

-- Wholly expectations: a measurement of what people say they expect, which is
-- not a measurement of the world. Each figure's own quote is the evidence.
--   imf-macro-agi-forecast-horizon        "Metaculus community forecast on when
--                                          the first general AI system will be
--                                          devised, tested and publicly
--                                          announced" — an aggregate of what
--                                          forecasters expect, not the IMF's
--                                          own projection.
--   mckinsey-expected-headcount-…         "Expected change in business
--                                          function's number of employees … next
--                                          3 years, % of respondents"
--   wef-executive-expectations-of-…       "Share of respondents selecting each
--                                          expected impact"
--   deloitte-physical-ai-greatest-…       "Which area of physical AI do you
--                                          believe will have the greatest
--                                          impact on your industry?"
UPDATE report_figure_points SET basis = 'expectation'
 WHERE figure_id IN (
   'imf-macro-agi-forecast-horizon',
   'mckinsey-expected-headcount-change-from-gen-ai',
   'wef-executive-expectations-of-ai-impact',
   'deloitte-physical-ai-greatest-expected-impact'
 );

-- Mixed figures: one series reporting what respondents say is already true,
-- one series reporting what they expect. This is why `basis` is on the POINT
-- and not on the figure — a figure-level field would mislabel half of each of
-- these four charts.
UPDATE report_figure_points SET basis = 'measured'
 WHERE (figure_id, series) IN (
   ('deloitte-agentic-ai-usage-today-vs-two-years', 'Today'),
   ('deloitte-ai-benefits-achieved-vs-hoped',       'Achieving today'),
   ('deloitte-physical-ai-adoption-by-region',      'Today'),
   ('hai-workforce-reductions-observed-vs-expected','Actual decrease over the past year')
 );

UPDATE report_figure_points SET basis = 'expectation'
 WHERE (figure_id, series) IN (
   ('deloitte-agentic-ai-usage-today-vs-two-years', 'In two years'),
   ('deloitte-ai-benefits-achieved-vs-hoped',       'Hope to achieve'),
   ('deloitte-physical-ai-adoption-by-region',      'In 2 years'),
   ('hai-workforce-reductions-observed-vs-expected','Expected decrease over the next year')
 );
