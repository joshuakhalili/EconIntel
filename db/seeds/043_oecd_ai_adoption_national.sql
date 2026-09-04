-- ============================================================================
-- 043_oecd_ai_adoption_national.sql — five countries Eurostat cannot supply
--
-- WHY THIS EXISTS
--
-- db/seeds/042 takes the adoption panel to every country in Eurostat's survey.
-- Eurostat's survey is Europe. OECD's ICT Access and Usage by Businesses
-- compiles national surveys and therefore reaches further, and five of the
-- countries it reaches are held by neither file: Brazil, Colombia, Israel,
-- New Zealand and Switzerland. Switzerland is worth naming twice — it is in
-- Europe and is NOT in isoc_eb_ai, so without this file the panel has a hole
-- in the middle of the map.
--
-- WHAT THEY ARE WORTH, AND THE ASSUMPTION THEY BREAK
--
-- Brazil reads 12.91% of firms in 2021. Germany read 10.56% in the same year.
-- The panel as it stood implied that adoption tracks income, and a middle-income
-- country above the largest economy in Europe on the same reference year is the
-- cleanest counter-example available. It could not be shown before this file.
--
-- HOW EVERY CODE AND NUMBER WAS ESTABLISHED — 2026-09-04
--
--   curl 'https://api.db.nomics.world/v22/series/OECD/DSD_ICT_B%40DF_BUSINESSES/
--         <ISO3>.A.G14_B.PT_ENT._T.S_GE10?observations=1'
--
-- All five returned 200 with observations. The lists in each description are
-- what came back, not what was expected — which matters here, because the QA
-- brief that prompted this file described all five as SINGLE OBSERVATIONS and
-- only two of them are:
--
--   BRA  3 obs — 2021 12.91, 2023 12.93, 2024 12.94   (brief: "12.91 (2021)")
--   CHE  3 obs — 2019 6.10, 2021 9.56, 2023 9.95      (brief: "6.10 (2019)")
--   COL  2 obs — 2019 6.84, 2020 7.18                 (brief: "6.84 (2019)")
--   ISR  1 obs — 2020 3.69                            single, as described
--   NZL  1 obs — 2022 9.02                            single, as described
--
-- The brief quoted each country's EARLIEST reading as though it were its
-- latest. Brazil's most recent reading is 12.94 in 2024, not 12.91 in 2021.
-- The descriptions below carry the full list so nothing depends on that again.
--
-- WHY THEY ARE NOT INTERCHANGEABLE WITH THE EUROSTAT THIRTY-THREE
--
-- Eurostat runs ONE instrument across every participating country. OECD
-- compiles what each national statistical office happened to ask, so the
-- definition of "using AI" is not held fixed between these five, or between
-- them and Eurostat. Different questionnaires, in Colombia's case a reference
-- year predating generative AI entirely, and ONE TO FIVE YEARS apart from the
-- Eurostat readings they will be ranked against: Eurostat's latest is 2025,
-- and these five were last asked in 2024 (Brazil), 2023 (Switzerland), 2022
-- (New Zealand) and 2020 (Colombia, Israel). An earlier draft of this line
-- said "two to four years apart", which is wrong at both ends.
--
-- That is why every row here carries `series_panel` naming the instrument, the
-- value db/seeds/037_chart_form.sql stamps on the six OECD rows already in the
-- group, spelled identically. The intent is that the ranked chart ranks within
-- a panel and never across two, so a Brazilian national survey is never sorted
-- against a Danish Eurostat reading as though the two measured the same thing.
--
-- THAT INTENT IS NOT YET WHAT THE READER GETS, AND THE CAPTION ALLOWS FOR IT
--
-- `series_panel` is written here, in 037 and in 042, and read in exactly one
-- place — src/client/components/charts/RankedBarChart.jsx. It never gets there:
-- src/server/repositories/questions.js does not SELECT the column, so
-- `member.series_panel` is undefined on the client and all 44 bars rank as one
-- undivided list. Until that SELECT is fixed the split exists only in the
-- database, so nothing in the caption below promises a reader a divided chart;
-- the definitional gap is stated in words, which is true either way.
--
-- A one-observation series draws as a dot and not a line, and each says so in
-- its own description — the place a reader meets the series is the place the
-- warning has to be.
-- ============================================================================

INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval, default_country_iso3
) VALUES

('oecd.ai_any.BRA', 'Brazil — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses, compiled from Brazil''s national survey. Three observations: 2021 12.91, 2023 12.93, 2024 12.94 — essentially flat across three years, and above Germany''s 10.56 in 2021. WEAKNESS: a national survey, so the level is not comparable with the Eurostat panel; read Brazil against its own earlier readings, not against Denmark.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/BRA.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/BRA.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'BRA'),

('oecd.ai_any.CHE', 'Switzerland — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses, compiled from the national survey. Three observations: 2019 6.10, 2021 9.56, 2023 9.95. WEAKNESS: it stops in 2023, and 2023 to 2025 is the interval in which 25 of the 32 Eurostat countries with a reading at both ends at least doubled (Türkiye 1.34x was the slowest, Serbia 5.56x the fastest), so Switzerland is frozen before the step everything around it took. It does not take part in Eurostat''s isoc_eb_ai either, so there is no harmonised alternative to put beside it.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/CHE.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/CHE.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'CHE'),

('oecd.ai_any.NZL', 'New Zealand — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses. WEAKNESS: a single observation, 2022 (9.02%). It draws as a dot, not a line, it cannot show a trend, and it is three years older than the Eurostat readings it sits beside.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/NZL.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/NZL.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'NZL'),

('oecd.ai_any.COL', 'Colombia — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses, compiled from the national survey. Two observations: 2019 6.84, 2020 7.18. WEAKNESS: both readings predate generative AI entirely — the later one is from 2020 — so this is a record of where Colombia stood before the period the rest of this site measures, and nothing about its current rate can be read from it.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/COL.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/COL.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'COL'),

('oecd.ai_any.ISR', 'Israel — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses. WEAKNESS: a single observation, 2020 (3.69%). It draws as a dot, not a line. It is among the oldest readings in the whole 44-country chart — the United Kingdom (2020, 4.11) and Colombia (2020, 7.18) were last asked in the same year — and third-lowest in it, above only Australia''s 3.39 from 2022 and Albania''s 3.67, itself a stale 2021 reading. A country with one of the densest AI research sectors in the world sits near the bottom because of WHEN it was last asked, not because of where it stands now.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/ISR.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/ISR.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'ISR')

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


-- Same chart group as the six OECD rows already there, and the SAME
-- `series_panel` string, spelled exactly as db/seeds/037_chart_form.sql spells
-- it. That string is what the ranked chart splits on: a second spelling would
-- rank these five as a third instrument rather than as more of the second one.
--
-- THE CAPTION IS THE GROUP'S, NOT THESE FIVE ROWS'
--
-- src/client/components/charts/ChartGroup.jsx renders ONE caption per chart
-- group — `lead.caption_plain`, where `lead` is `members[0]`. So the caption a
-- row carries is not a caption for that row: whichever row happens to sort
-- first speaks for the whole chart. The old text here said "Five countries
-- Eurostat's survey does not reach", which is true of these five rows and false
-- of the 44-bar chart it would have headed.
--
-- The string below is therefore the group caption, byte-identical to the one
-- db/seeds/042 writes across the 33 Eurostat rows. It has to be duplicated:
-- 042 runs before these rows exist, so its UPDATE cannot reach them, and there
-- is no shared literal in plain SQL seeds. If either copy is edited, edit both
-- — the group would otherwise say two different things depending on which row
-- sorted first. (Today the lead is `eurostat.ai_any.ALB`, so 042's copy is the
-- one on screen; that is an accident of alphabetical order, not a design.)
INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3,
   series_panel, caption_plain, caption_expert)
SELECT 'adoption', id, 'supporting', 21, 'ai-adoption-panel', default_country_iso3,
       'OECD — national surveys, compiled; levels not comparable with the above',
       'The share of firms using AI, country by country — forty-four countries, and only thirty-three of them measured the same way.',
       'Forty-four countries, from TWO different surveys. Thirty-three are the Eurostat Community Survey on ICT usage in enterprises (10+ employees, at least one AI technology), harmonised by construction: same instrument, same definition, same reference year across all thirty-three, which is what makes the level differences among them readable as real. Twenty-seven of those are EU members and six are not — Norway, Türkiye, Serbia, Bosnia and Herzegovina, Montenegro and Albania take part without being in the Union. The other eleven are the OECD''s compilation of national surveys, where "using AI" is not held to one definition between countries or against Eurostat''s, so a bar from those eleven set beside a bar from the thirty-three is comparing two instruments and the gap between them is partly definitional. Nor are these readings of one moment: four points at most on the Eurostat side (2021, 2023, 2024, 2025 — the survey did not run in 2022), while the eleven OECD countries were last asked between 2020 and 2024. Albania is a single 2021 observation through DBnomics and is not a current rate.'
  FROM indicators
 WHERE id IN ('oecd.ai_any.BRA', 'oecd.ai_any.CHE', 'oecd.ai_any.COL',
              'oecd.ai_any.ISR', 'oecd.ai_any.NZL')
ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, sort_order = EXCLUDED.sort_order,
  chart_group = EXCLUDED.chart_group,
  country_iso3 = EXCLUDED.country_iso3,
  series_panel = EXCLUDED.series_panel,
  caption_plain = EXCLUDED.caption_plain,
  caption_expert = EXCLUDED.caption_expert;


-- The six OECD rows seeded in db/seeds/020 before these five existed. They
-- still carry 020's caption, which counts the chart at sixteen countries.
--
-- This is the same correction db/seeds/042 makes to the ten Eurostat rows from
-- 020, for the same reason: ONE chart carries ONE caption (ChartGroup.jsx takes
-- members[0]), so leaving two texts in the group means the chart says whichever
-- of them happens to sort first. 043 is the last seed to touch this group, so
-- after this statement all 44 rows carry the identical string and the question
-- of which one leads stops mattering.
--
-- `series_panel` is deliberately NOT touched here: 037 already stamps these six
-- with the OECD string and 043's five rows above use the identical spelling, so
-- the eleven are one panel already. Only the caption was wrong.
UPDATE question_indicators
   SET caption_plain  = 'The share of firms using AI, country by country — forty-four countries, and only thirty-three of them measured the same way.',
       caption_expert = 'Forty-four countries, from TWO different surveys. Thirty-three are the Eurostat Community Survey on ICT usage in enterprises (10+ employees, at least one AI technology), harmonised by construction: same instrument, same definition, same reference year across all thirty-three, which is what makes the level differences among them readable as real. Twenty-seven of those are EU members and six are not — Norway, Türkiye, Serbia, Bosnia and Herzegovina, Montenegro and Albania take part without being in the Union. The other eleven are the OECD''s compilation of national surveys, where "using AI" is not held to one definition between countries or against Eurostat''s, so a bar from those eleven set beside a bar from the thirty-three is comparing two instruments and the gap between them is partly definitional. Nor are these readings of one moment: four points at most on the Eurostat side (2021, 2023, 2024, 2025 — the survey did not run in 2022), while the eleven OECD countries were last asked between 2020 and 2024. Albania is a single 2021 observation through DBnomics and is not a current rate.'
 WHERE question_id = 'adoption'
   AND chart_group = 'ai-adoption-panel'
   AND indicator_id LIKE 'oecd.ai_any.%';
