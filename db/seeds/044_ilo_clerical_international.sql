-- ============================================================================
-- 044_ilo_clerical_international.sql — the clerical question, for six more
--                                       countries
--
-- WHY THIS EXISTS
--
-- "Has the work most like a language model's actually gone?" is the sharpest
-- question in the labour lens, and it was answered for one country. The project
-- held exactly ONE ILO series — US employment in ISCO-08 major group 4, clerical
-- support workers — out of the 28,905 in that dataset. Filtering it to the
-- identical classif1=OCU_ISCO08_4, sex=SEX_T, frequency=A gives 223 series
-- across 175 countries, all of them reachable through the DBnomics adapter that
-- already runs on every ingest. This was never an engineering problem.
--
-- WHAT THE SIX ADD — AND THEY CHANGE THE ANSWER
--
-- Measured from each series' own first observation to its last (the numbers are
-- in each description, and every one was fetched, not remembered):
--
--     USA   16,322k (2003) → 13,572k (2023)   −16.8%   [already seeded]
--     JPN   12,736k (2000) → 14,060k (2023)   +10.4%
--     KOR    2,519k (2000) →  3,465k (2023)   +37.5%
--     DEU    4,711k (2011) →  5,556k (2022)   +17.9%
--     BRA    7,290k (2012) →  8,173k (2022)   +12.1%
--     FRA    2,465k (2011) →  2,453k (2022)    −0.5%
--     GBR    2,968k (2011) →  3,083k (2019)    +3.9%
--
-- DO NOT QUOTE ANY OF THOSE SEVEN PERCENTAGES WITHOUT THE NEXT SECTION. Six of
-- the seven series carry a break the ILO itself flags, and on four of them the
-- flagged year falls INSIDE the span the percentage is measured across.
--
-- The decline the labour lens is built around is, on this measure, American and
-- not general. Clerical employment rose in Japan, Korea, Germany and Brazil
-- over the same period. That is either the strongest evidence on the site that
-- the US fall is about something other than AI, or evidence that the effect
-- arrives country by country — and a reader cannot weigh either reading from
-- one country, which is what they had.
--
-- SIX OF THE SEVEN CARRY AN ILO BREAK FLAG; FOUR CROSS ONE MID-SERIES
--
-- This is not an inference from the shape of the lines. DBnomics returns an
-- `observations_attributes` array beside the values holding the ILO's own
-- OBSV_STATUS code per observation, and "B" is the ILO's code for BREAK IN
-- SERIES. Surfaced for all seven on 2026-09-04 with:
--
--   curl 'https://api.db.nomics.world/v22/series/ILO/EMP_TEMP_SEX_OCU_NB/
--         <CODE>?observations=1'
--   → .series.docs[0].observations_attributes lines up with .period position by
--     position; .dataset.attributes_values_labels.OBSV_STATUS gives the labels.
--
-- Nine flagged years across the seven series:
--
--     USA  2020                     JPN  2012
--     KOR  2015                     DEU  2011, 2012, 2020, 2021
--     BRA  2012 (its first year)    GBR  2011 (its first year)
--     FRA  none
--
-- A flag on a series' FIRST observation marks where a series begins, not where
-- its basis changes, so Brazil's and the UK's figures are unaffected and France
-- has no flag at all. The other four are a different matter:
--
--   USA  −16.8% over 2003-2023 — but 2003→2019 is only −4.3%. The fall is
--        2019 15,615k → 2020 13,222k, AT the flagged year. Almost the whole of
--        the American decline this lens is built on happens at a break.
--   JPN  +10.4% over 2000-2023, and the chart will draw a 21% V through the
--        middle of it: 2010 12,734.8k → 2011 10,028.4k (−21.3%) → 2012
--        10,134.4k → 2013 12,264.1k (+21.0%). No labour market loses and
--        regains a fifth of an occupation in two years. 2010 and 2013 differ by
--        only 3.7%, so the levels either side agree and the dip is confined to
--        2011 and 2012 (the ILO's flag sits on the second of the two). Read it
--        as two segments instead: flat across 2000-2010, and
--        +14.6% across 2013-2023.
--   KOR  +37.5% over 2000-2023 — but 2015→2023 is +22.9%. Korea also has an
--        UNFLAGGED −18.2% step (2003 3,190.6k → 2004 2,609.1k), which is the
--        reason not to treat the ILO's flags as a complete list of the breaks.
--   DEU  +17.9% over 2011-2022 — but its first observation is flagged and its
--        second is too, so the headline is measured from a break across another.
--        2012→2022 is +6.2%, a third of the quoted figure.
--
-- THE FLAGS DO NOT REACH THE SITE, WHICH IS WHY THEY ARE WRITTEN IN PROSE
--
-- `fetchSeries` in src/server/ingestion/sources/dbnomics.js reads `period` and
-- `value` and nothing else, so `observations_attributes` is discarded at ingest
-- and no chart can mark a break on its own. Dropping the affected years was the
-- other option and a seed cannot do it: seeds define indicators, the ingest
-- writes observations, and this file cannot delete a year it never inserted. So
-- until an adapter change carries the flag, the only place a reader can meet
-- the break is prose — the `description` on each indicator below and the
-- caption on the chart, both of which now state it.
--
-- THE OTHER THING THIS PANEL CANNOT DO, AND IT IS EASY TO MISS
--
-- EVERY SERIES HERE ENDS BEFORE OR BARELY INSIDE THE GENERATIVE-AI PERIOD.
-- The end dates are 2019 (GBR), 2022 (DEU, FRA, BRA) and 2023 (JPN, KOR, USA).
-- ChatGPT was released in November 2022. So this panel is evidence about the
-- decade BEFORE large language models were widely used, and any reading of it
-- as "AI has/has not displaced clerical work" is a reading of the wrong years.
-- The end dates differ by four years between series, so the chart must break
-- each line where its data stops rather than carrying it forward, and the
-- footer must state each series' last period — the project's THIRTEEN chart
-- honesty behaviours already require this (see the title of
-- src/client/components/charts/HONESTY.md; an earlier draft of this header
-- said twelve), and the differing endpoints are the reason to check it here
-- specifically.
--
-- LEVELS ARE NOT COMPARABLE; SHAPES ARE
--
-- These are counts of people, so Japan at 14.1 million and France at 2.5
-- million is a fact about the size of Japan. Read the direction and the slope,
-- not the height. A per-capita or indexed version would be the better chart and
-- would need a derived indicator computed at ingest, which is a code change and
-- not a seed; it is recorded here rather than half-built.
--
-- HOW EVERY CODE WAS ESTABLISHED — 2026-09-04
--
--   curl 'https://api.db.nomics.world/v22/series/ILO/EMP_TEMP_SEX_OCU_NB/
--         <ISO3>.<SOURCE>.OCU_ISCO08_4.SEX_T.A?observations=1'
--
-- All six returned 200 with the observation counts quoted below. The <SOURCE>
-- segment is the national collection the ILO harmonised — BA_259 is Japan's
-- Labour Force Survey, BA_2242 the German EU-LFS return — and it is NOT
-- guessable: a plausible-looking wrong one (GBR.BA_1002 was tried) returns 404,
-- and a plausible-looking wrong DBnomics code elsewhere returns an empty series
-- that renders as "no data" rather than as broken.
--
-- WHY SIX AND NOT THIRTEEN
--
-- Six is the number of CVD-validated hues, and this group is a line chart where
-- colour carries which country a line is. Thirteen countries were verified;
-- SEVEN of them were left out rather than drawn in a repeated hue:
-- ITA.BA_2238 (12 obs 2011-2022), ESP.BA_2244 (12), MEX.BA_463 (10,
-- 2013-2022), NLD.BA_2236 (12), POL.BA_2241 (12), IDN.BA_510 (5, 2017-2022),
-- AUS.BA_518 (30 obs, 1991-2020 — the longest run of any of them, and it stops
-- in 2020). Count them: an earlier draft of this header said "four more
-- countries" above a list of seven.
--
-- The six seeded here are the whole of `clerical-international` — the existing
-- US series stays on its own placement and is NOT in this chart group, so the
-- group holds six series against six hues rather than seven against six.
--
-- Their codes are written here so the next person does not repeat the search:
-- if this group is ever ruled `ranked-bars` in `chart_forms`, the palette
-- ceiling stops applying and they can be added without further verification.
-- ============================================================================

INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval, default_country_iso3
) VALUES

('dbn.ILO.EMP_TEMP_SEX_OCU_NB.JPN.BA_259.OCU_ISCO08_4.SEX_T.A',
 'Japan — employment in clerical support work',
 'Employment in ISCO-08 major group 4, clerical support workers, both sexes. ILO harmonised from Japan''s Labour Force Survey. 24 annual observations, 2000-2023: 12,736 thousand in 2000 to 14,060 thousand in 2023, its highest reading. BREAK IN SERIES, AND IT IS THE MOST VISIBLE THING ON THE CHART: the ILO flags 2012 (OBSV_STATUS "B"), and the line drops and recovers by about a fifth around it — 12,734.8 thousand in 2010, 10,028.4 in 2011 (−21.3%), 10,134.4 in 2012, then 12,264.1 in 2013 (+21.0%). That is a change of basis. No labour market loses and regains a fifth of an occupation in two years, and this one must not be read as having done so; 2010 and 2013 differ by only 3.7%, so the levels either side of the dip agree with each other. Read it as two segments: flat across 2000-2010, and +14.6% across 2013-2023. The full-span +10.4% spans the break and is not a measurement of change. ENDS 2023, so it barely reaches the generative-AI period.',
 'adoption', 'count', 'annual', 'official',
 'Thousands of persons', NULL, 2, 'dbnomics',
 'ILO/EMP_TEMP_SEX_OCU_NB/JPN.BA_259.OCU_ISCO08_4.SEX_T.A',
 'https://db.nomics.world/ILO/EMP_TEMP_SEX_OCU_NB/JPN.BA_259.OCU_ISCO08_4.SEX_T.A',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'JPN'),

('dbn.ILO.EMP_TEMP_SEX_OCU_NB.KOR.BA_222.OCU_ISCO08_4.SEX_T.A',
 'South Korea — employment in clerical support work',
 'Employment in ISCO-08 major group 4, clerical support workers, both sexes. ILO harmonised from the Economically Active Population Survey. 24 annual observations, 2000-2023: 2,519 thousand in 2000 to 3,465 thousand in 2023, a rise of 37.5% and the steepest increase in this panel. BREAK IN SERIES: the ILO flags 2015 (OBSV_STATUS "B"), which sits inside that span; measured from the break, 2015-2023 is +22.9%. There is also an UNFLAGGED step of −18.2% between 2003 (3,190.6 thousand) and 2004 (2,609.1 thousand), larger than most of the flagged ones — so the ILO''s flags are not a complete list of this series'' breaks and the 37.5% should be treated as an upper bound, not a reading. ENDS 2023.',
 'adoption', 'count', 'annual', 'official',
 'Thousands of persons', NULL, 2, 'dbnomics',
 'ILO/EMP_TEMP_SEX_OCU_NB/KOR.BA_222.OCU_ISCO08_4.SEX_T.A',
 'https://db.nomics.world/ILO/EMP_TEMP_SEX_OCU_NB/KOR.BA_222.OCU_ISCO08_4.SEX_T.A',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'KOR'),

('dbn.ILO.EMP_TEMP_SEX_OCU_NB.DEU.BA_2242.OCU_ISCO08_4.SEX_T.A',
 'Germany — employment in clerical support work',
 'Employment in ISCO-08 major group 4, clerical support workers, both sexes. ILO harmonised from the German EU Labour Force Survey return. 12 annual observations, 2011-2022: 4,711 thousand to 5,556 thousand, up 17.9%. BREAK IN SERIES, FOUR OF THEM — the ILO flags 2011, 2012, 2020 and 2021 (OBSV_STATUS "B"), more than any other series here. 2011 is this series'' own first observation and 2012 is its second, so the 17.9% is measured from a flagged year across another flagged year; from the second break onward, 2012-2022 is +6.2%, about a third of the headline. WEAKNESS: it ENDS IN 2022, a year earlier than the US and Japanese series it will be drawn beside, so the line must stop where the data stops and the last point on the chart is not the same year for every country.',
 'adoption', 'count', 'annual', 'official',
 'Thousands of persons', NULL, 2, 'dbnomics',
 'ILO/EMP_TEMP_SEX_OCU_NB/DEU.BA_2242.OCU_ISCO08_4.SEX_T.A',
 'https://db.nomics.world/ILO/EMP_TEMP_SEX_OCU_NB/DEU.BA_2242.OCU_ISCO08_4.SEX_T.A',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'DEU'),

('dbn.ILO.EMP_TEMP_SEX_OCU_NB.BRA.BX_6355.OCU_ISCO08_4.SEX_T.A',
 'Brazil — employment in clerical support work',
 'Employment in ISCO-08 major group 4, clerical support workers, both sexes. ILO harmonised from the Continuous National Household Sample Survey. 11 annual observations, 2012-2022: 7,290 thousand to 8,173 thousand, up 12.1%. The only middle-income country in this panel, and it moves with Japan and Germany rather than with the United States. The ILO flags 2012 as a break (OBSV_STATUS "B"), but 2012 is this series'' own first observation — where a series begins rather than where its basis changes — so the 12.1% is unaffected by it. WEAKNESS: it ENDS IN 2022. Note also that this comes from a household survey rather than a labour force survey, which is a different sampling frame from the other five.',
 'adoption', 'count', 'annual', 'official',
 'Thousands of persons', NULL, 2, 'dbnomics',
 'ILO/EMP_TEMP_SEX_OCU_NB/BRA.BX_6355.OCU_ISCO08_4.SEX_T.A',
 'https://db.nomics.world/ILO/EMP_TEMP_SEX_OCU_NB/BRA.BX_6355.OCU_ISCO08_4.SEX_T.A',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'BRA'),

('dbn.ILO.EMP_TEMP_SEX_OCU_NB.FRA.BA_148.OCU_ISCO08_4.SEX_T.A',
 'France — employment in clerical support work',
 'Employment in ISCO-08 major group 4, clerical support workers, both sexes. ILO harmonised from the French Employment Survey. 12 annual observations, 2011-2022: 2,465 thousand to 2,453 thousand — flat, a fall of 0.5% over eleven years, and the only country here besides the United States that does not rise. It is also the ONLY series in this panel the ILO flags no break in, which makes its flatness the cleanest single reading here. WEAKNESS: it ENDS IN 2022.',
 'adoption', 'count', 'annual', 'official',
 'Thousands of persons', NULL, 2, 'dbnomics',
 'ILO/EMP_TEMP_SEX_OCU_NB/FRA.BA_148.OCU_ISCO08_4.SEX_T.A',
 'https://db.nomics.world/ILO/EMP_TEMP_SEX_OCU_NB/FRA.BA_148.OCU_ISCO08_4.SEX_T.A',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'FRA'),

('dbn.ILO.EMP_TEMP_SEX_OCU_NB.GBR.BA_2247.OCU_ISCO08_4.SEX_T.A',
 'United Kingdom — employment in clerical support work',
 'Employment in ISCO-08 major group 4, clerical support workers, both sexes. ILO harmonised from the UK EU Labour Force Survey return. 9 annual observations, 2011-2019: 2,968 thousand to 3,083 thousand, peaking at 3,177 thousand in 2018. The ILO flags 2011 as a break (OBSV_STATUS "B"), but 2011 is this series'' own first observation — where a series begins rather than where its basis changes — so the 3.9% is unaffected by it. WEAKNESS, AND IT IS THE WORST IN THIS PANEL: IT ENDS IN 2019. The series stops at Brexit, four years before the others and three years before ChatGPT, and the ILO has no comparable UK series after it. Nothing about the UK in the AI period can be read from this line, and it must not be carried forward past 2019 on any chart.',
 'adoption', 'count', 'annual', 'official',
 'Thousands of persons', NULL, 2, 'dbnomics',
 'ILO/EMP_TEMP_SEX_OCU_NB/GBR.BA_2247.OCU_ISCO08_4.SEX_T.A',
 'https://db.nomics.world/ILO/EMP_TEMP_SEX_OCU_NB/GBR.BA_2247.OCU_ISCO08_4.SEX_T.A',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'GBR')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  pillar = EXCLUDED.pillar, quantity_kind = EXCLUDED.quantity_kind,
  cadence = EXCLUDED.cadence, confidence_tier = EXCLUDED.confidence_tier,
  unit = EXCLUDED.unit, unit_symbol = EXCLUDED.unit_symbol,
  decimals = EXCLUDED.decimals,
  source_series_code = EXCLUDED.source_series_code,
  source_url = EXCLUDED.source_url,
  has_country_dim = EXCLUDED.has_country_dim,
  refresh_interval = EXCLUDED.refresh_interval,
  default_country_iso3 = EXCLUDED.default_country_iso3,
  is_active = TRUE, updated_at = now();


-- A NEW chart group, not the existing `us-clerical`.
--
-- `us-clerical` holds the two US series — the FRED count and the ILO count of
-- the same work on a different occupational boundary — and its whole point is
-- that the two disagree by about two million because they draw the line in
-- different places. That is a comparison of DEFINITIONS. This is a comparison
-- of COUNTRIES. Putting six countries into a group whose caption explains a
-- definitional gap would make both arguments unreadable.
--
-- Six members exactly: this draws as a line chart, colour carries which country
-- each line is, and there are six validated hues. `npm run check:charts` counts
-- per (chart_group, question_id), so a seventh would fail it.
INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3,
   caption_plain, caption_expert)
SELECT 'clerical', id, 'supporting', 4, 'clerical-international', default_country_iso3,
       'The same work in six more countries — and outside the United States it has not gone anywhere. Several of these lines change basis part-way through, including the 21% step in Japan, so read their shapes rather than their totals.',
       'ILO harmonised employment in ISCO-08 major group 4 (clerical support workers), both sexes, annual, sourced from each country''s own labour force or household survey. From first to last observation: Korea +37.5%, Germany +17.9%, Brazil +12.1%, Japan +10.4%, the UK +3.9%, France −0.5% — against the United States at −16.8%. FOUR THINGS BEFORE READING ANY OF THAT AS AN ANSWER. First, six of those seven series carry a year the ILO itself flags as a BREAK IN SERIES, and on four of them the flagged year falls inside the span the percentage covers — so those percentages measure a change of basis as well as a change in the world. Japan''s break shows on the chart as a fall and recovery of about a fifth between 2010 and 2013 that no labour market produced, and almost the whole of the American −16.8% is one step at its flagged 2020. Measured clear of the flagged years the same series read: Japan +14.6% (2013-2023), Korea +22.9% (2015-2023), Germany +6.2% (2012-2022), the United States −4.3% (2003-2019). France is the only one the ILO flags no break in. Second, these are counts of people, so the heights are country sizes; read slope, not level. Third, the series end in different years — 2019 for the UK, 2022 for Germany, France and Brazil, 2023 for Japan and Korea — and each line stops where its data stops. Fourth, and decisively: every one of them ends before or barely inside the generative-AI period, so this panel is evidence about the decade before large language models, not about their effect.'
  FROM indicators
 WHERE id IN (
   'dbn.ILO.EMP_TEMP_SEX_OCU_NB.JPN.BA_259.OCU_ISCO08_4.SEX_T.A',
   'dbn.ILO.EMP_TEMP_SEX_OCU_NB.KOR.BA_222.OCU_ISCO08_4.SEX_T.A',
   'dbn.ILO.EMP_TEMP_SEX_OCU_NB.DEU.BA_2242.OCU_ISCO08_4.SEX_T.A',
   'dbn.ILO.EMP_TEMP_SEX_OCU_NB.BRA.BX_6355.OCU_ISCO08_4.SEX_T.A',
   'dbn.ILO.EMP_TEMP_SEX_OCU_NB.FRA.BA_148.OCU_ISCO08_4.SEX_T.A',
   'dbn.ILO.EMP_TEMP_SEX_OCU_NB.GBR.BA_2247.OCU_ISCO08_4.SEX_T.A'
 )
ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, sort_order = EXCLUDED.sort_order,
  chart_group = EXCLUDED.chart_group,
  country_iso3 = EXCLUDED.country_iso3,
  caption_plain = EXCLUDED.caption_plain,
  caption_expert = EXCLUDED.caption_expert;
