-- ============================================================================
-- 042_eurostat_ai_adoption_full_panel.sql — the other twenty-three countries
--
-- WHY THIS EXISTS
--
-- db/seeds/020_ai_adoption_panel.sql seeds ten Eurostat countries. Eurostat
-- publishes THIRTY-THREE on the identical harmonised instrument, and the other
-- twenty-three needed nothing but a row: no adapter, no key, no code. The
-- DBnomics handler ingests whatever series code sits in `source_series_code`
-- (`ingestDbnomicsIndicator` in src/server/ingestion/runner.js — named rather
-- than cited by line, because the line number in an earlier draft of this
-- header had already rotted onto a `throw` in an unrelated catch block), so
-- the constraint here was never engineering — it was knowing which codes exist.
--
-- WHAT THE MISSING TWENTY-THREE ARE WORTH
--
-- The site is named after diffusion and the panel could barely show any. All
-- figures below are 2025, percentage of enterprises with 10+ employees, from
-- the same survey, verified by the fetches recorded further down.
--
--   With the ten already seeded, the spread was Denmark 42.03 to Poland 8.36
--   — a factor of 5.0, across ten EU member states of which Poland was the only
--   one from central or eastern Europe. (An earlier draft of this line called
--   the other nine "Western or Northern European", which Italy and Spain are
--   not.)
--
--   With these twenty-three it is Denmark 42.03 to Romania 5.21 — a factor of
--   8.1, across twenty-seven EU members and six countries outside the Union.
--   Belgium at 34.54 against Romania at 5.21 is a factor of 6.6 inside the
--   twenty-three added here alone.
--
-- And the ordering does not follow income the way the seeded ten implied:
-- Estonia reads 23.40, above Ireland at 19.64 and France at 18.16; Poland at
-- 8.36 sits below Bosnia and Herzegovina at 10.78. Not one of those
-- comparisons could be made before this file.
--
-- HOW EVERY CODE AND EVERY NUMBER HERE WAS ESTABLISHED — 2026-09-04
--
-- 1. The full Eurostat table, to establish who is actually in the survey:
--      curl 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/
--            data/isoc_eb_ai?format=JSON&size_emp=GE10&indic_is=E_AI_TANY&unit=PC_ENT'
--      → 200, updated 2026-06-15. 36 geo entities: EU27_2020 and EA, plus 34
--        countries. 33 of the 34 carry a 2025 value; North Macedonia (MK) has
--        no observation at all in this cut and is therefore NOT seeded.
--
-- 2. Then each of the twenty-three individually, through the path the ingester
--    actually uses, because the mirror is what will be fetched and not the
--    upstream table:
--      curl 'https://api.db.nomics.world/v22/series/Eurostat/isoc_eb_ai/
--            A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.<GEO2>?observations=1'
--      → 22 of 23 returned four observations (2021, 2023, 2024, 2025) matching
--        Eurostat to the decimal. The observation lists in each `description`
--        below are what came back, not what was expected.
--
-- The geo code is TWO letters and it is not the ISO2 code in every case:
-- GREECE IS "EL", NOT "GR". That single character is the difference between a
-- series and an empty chart, because a wrong DBnomics code does not error — it
-- returns nothing and renders as "no data" rather than as broken.
--
-- THE TWO PLACES THE MIRROR AND THE SOURCE DISAGREE, STATED RATHER THAN HIDDEN
--
--   ALB  DBnomics holds one observation (2021, 3.67). Eurostat holds three,
--        including 2025 at 8.99. Seeded anyway, with the weakness written into
--        its own description, because the row is what makes the ingest pick the
--        rest up when DBnomics reindexes. Until then Albania is a four-year-old
--        dot and must not be read as a current rate.
--   MLT  DBnomics 21.56 for 2025, Eurostat 21.51. A vintage difference of
--        0.05 points. The DBnomics figure is the one that will be ingested and
--        is therefore the one quoted.
--
-- WHAT THIS PANEL STILL CANNOT DO
--
-- Four annual points at best, starting 2021, and the 2022 gap is real — the
-- survey did not run. Nothing built on this may interpolate between the points
-- and imply a curve. And this file takes the Eurostat side of `ai-adoption-panel`
-- to 33 series — the CHART GROUP is larger still, 44, once db/seeds/043 lands
-- its five OECD rows beside the six already there; the two numbers are counted
-- out below under WHAT THE CAPTION HAS TO BE TRUE OF. Either way there are six
-- validated hues, so this CANNOT be drawn as a
-- categorical line chart and `npm run check:charts` will say so. The settled
-- form is a ranked horizontal bar — one bar per country, sorted by the latest
-- value, one hue, so colour encodes nothing and the palette limit stops
-- applying. These rows are written to land with that form.
--
-- TWO LABELS THIS FILE CORRECTS ON ROWS IT DID NOT CREATE, AND WHY
--
-- db/seeds/037_chart_form.sql rules this group a ranked bar chart and stamps
-- every Eurostat member of it with
--   series_panel = 'Eurostat — one harmonised survey, ten member states'
-- so the two instruments in the panel are ranked separately. Both that string
-- and the chart caption set in db/seeds/020 count the panel at ten, and after
-- this file there are thirty-three. Six of the thirty-three are not EU members
-- at all — Norway, Türkiye, Serbia, Bosnia and Herzegovina, Montenegro and
-- Albania take part in the survey without being in the Union.
--
-- Leaving my rows a different `series_panel` string would be worse than a wrong
-- word: `series_panel` is what splits the group into sub-panels, so two
-- spellings of "Eurostat" would rank the ten against the twenty-three as though
-- they were different instruments. They are the same instrument. So this file
-- writes ONE string across all thirty-three, and corrects the caption to match.
-- Seeds run in filename order inside a single transaction, so 037's stamp lands
-- first and this overwrites it deterministically — the same way 036 corrects
-- rows defined in 006. The literals in 020 and 037 should be brought into line
-- at source by whoever owns those files; until then this is where the site gets
-- a true sentence.
--
-- WHAT THE CAPTION HAS TO BE TRUE OF — 44, NOT 33
--
-- A chart group gets ONE caption, not one per sub-panel:
-- src/client/components/charts/ChartGroup.jsx takes `lead.caption_plain` where
-- `lead` is `members[0]`, and the server orders members by role, then
-- sort_order, then indicator_id. Every row in this group is 'supporting'; the
-- rows from 020 and 042 are sort_order 20 and 043's are 21; so the lead is the
-- alphabetically first id at 20, which is `eurostat.ai_any.ALB` — a row THIS
-- file writes. The caption below is therefore the caption of the whole chart,
-- and a chart of 44 bars headed "thirty-three countries" is a miscount a reader
-- can see, which is what it said before this correction.
--
-- Counted from the seeds, not remembered:
--
--   Eurostat  10 in db/seeds/020  +  23 here          = 33
--   OECD       6 in db/seeds/020  +   5 in 043        = 11
--   ai-adoption-panel / adoption                      = 44
--
-- 44 is the same number src/client/components/charts/RankedBarChart.jsx counts
-- for itself when it sizes MAX_REQUESTS at four, arrived at independently.
--
-- The caption states both instruments and both sizes and does NOT promise the
-- reader a visible split, because there is not one yet: `series_panel` is
-- written by 037, this file and 043, but src/server/repositories/questions.js
-- does not SELECT the column, so it never reaches RankedBarChart and the 44
-- currently rank as one undivided list. Writing "ranked in two blocks" here
-- would be describing something nobody can see. The definitional gap is stated
-- in words instead, which is true either way.
-- ============================================================================

INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval, default_country_iso3
) VALUES

('eurostat.ai_any.BEL', 'Belgium — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 10.32, 2023 13.81, 2024 24.71, 2025 34.54 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.BE',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.BE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'BEL'),

('eurostat.ai_any.LUX', 'Luxembourg — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 13.00, 2023 14.45, 2024 23.73, 2025 33.61 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.LU',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.LU',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'LUX'),

('eurostat.ai_any.AUT', 'Austria — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 8.83, 2023 10.79, 2024 20.27, 2025 29.95 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.AT',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.AT',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'AUT'),

('eurostat.ai_any.NOR', 'Norway — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 10.82, 2023 9.17, 2024 20.77, 2025 28.89 — the survey did not run in 2022. It falls between 2021 and 2023 — 10.82 to 9.17 — before tripling; the dip is in the source, not a rendering fault.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.NO',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.NO',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'NOR'),

('eurostat.ai_any.EST', 'Estonia — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 2.77, 2023 5.19, 2024 13.89, 2025 23.40 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.EE',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.EE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'EST'),

('eurostat.ai_any.SVN', 'Slovenia — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 11.73, 2023 11.37, 2024 20.89, 2025 21.61 — the survey did not run in 2022. Flat between 2021 and 2023 — 11.73 to 11.37 — then doubling.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.SI',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.SI',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'SVN'),

('eurostat.ai_any.MLT', 'Malta — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 10.16, 2023 13.17, 2024 17.30, 2025 21.56 — the survey did not run in 2022. DBnomics served 21.56 for 2025 on the verification date where Eurostat''s own API served 21.51; the mirror carries a slightly older vintage, and 21.56 is what this project will ingest.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.MT',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.MT',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'MLT'),

('eurostat.ai_any.LTU', 'Lithuania — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 4.45, 2023 4.86, 2024 8.76, 2025 21.30 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.LT',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.LT',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'LTU'),

('eurostat.ai_any.SVK', 'Slovakia — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 5.19, 2023 7.04, 2024 10.78, 2025 18.00 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.SK',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.SK',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'SVK'),

('eurostat.ai_any.CZE', 'Czechia — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 4.46, 2023 5.90, 2024 11.26, 2025 17.60 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.CZ',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.CZ',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'CZE'),

('eurostat.ai_any.HRV', 'Croatia — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 8.74, 2023 7.89, 2024 11.76, 2025 15.19 — the survey did not run in 2022. It falls between 2021 and 2023 — 8.74 to 7.89 — before rising.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.HR',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.HR',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'HRV'),

('eurostat.ai_any.LVA', 'Latvia — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 3.72, 2023 4.53, 2024 8.83, 2025 12.21 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.LV',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.LV',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'LVA'),

('eurostat.ai_any.PRT', 'Portugal — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 7.20, 2023 7.86, 2024 8.63, 2025 11.54 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.PT',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.PT',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'PRT'),

('eurostat.ai_any.BIH', 'Bosnia and Herzegovina — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 2.07, 2023 5.34, 2024 6.36, 2025 10.78 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.BA',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.BA',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'BIH'),

('eurostat.ai_any.HUN', 'Hungary — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 2.98, 2023 3.68, 2024 7.41, 2025 10.37 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.HU',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.HU',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'HUN'),

('eurostat.ai_any.SRB', 'Serbia — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 0.90, 2023 1.82, 2024 6.95, 2025 10.12 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.RS',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.RS',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'SRB'),

('eurostat.ai_any.MNE', 'Montenegro — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 3.34, 2023 5.61, 2024 7.91, 2025 10.05 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.ME',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.ME',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'MNE'),

('eurostat.ai_any.CYP', 'Cyprus — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 2.59, 2023 4.67, 2024 7.90, 2025 9.27 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.CY',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.CY',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'CYP'),

('eurostat.ai_any.GRC', 'Greece — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 2.61, 2023 3.98, 2024 9.81, 2025 8.93 — the survey did not run in 2022. It falls between 2024 and 2025 — 9.81 to 8.93 — the only country in the panel whose latest reading is below its previous one.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.EL',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.EL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'GRC'),

('eurostat.ai_any.BGR', 'Bulgaria — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 3.29, 2023 3.62, 2024 6.47, 2025 8.55 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.BG',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.BG',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'BGR'),

('eurostat.ai_any.TUR', 'Türkiye — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 2.69, 2023 5.51, 2024 4.42, 2025 7.41 — the survey did not run in 2022. Non-monotonic: 2.69, 5.51, 4.42, 7.41. Read the 2024 dip as survey noise on a small base rather than as firms abandoning AI.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.TR',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.TR',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'TUR'),

('eurostat.ai_any.ROU', 'Romania — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across participating countries. 4 observations: 2021 1.38, 2023 1.51, 2024 3.07, 2025 5.21 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.RO',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.RO',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'ROU'),

('eurostat.ai_any.ALB', 'Albania — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. WEAKNESS: DBnomics carries a single observation for Albania — 2021 3.67 — so this draws as a dot, not a line, and it is four years old. Eurostat''s own API serves three points for the same series (2021 3.67, 2024 8.91, 2025 8.99); the mirror this project ingests through has not caught up. The row is seeded so the remaining points arrive on the first ingest after DBnomics reindexes, rather than needing a second editorial pass — but until then Albania must not be read as a current rate.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.AL',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.AL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'ALB')
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


-- Onto the adoption question, in the same chart group as the ten already
-- there, because they are the same instrument and belong on one chart. A row
-- here is also what keeps them out of `orphaned_indicators`: an indicator with
-- observations that appears on no question is data nobody can reach, and
-- `npm run check:data` fails on it.
--
-- `series_panel` is set explicitly rather than left to 037's UPDATE, which ran
-- before these rows existed. Without it these twenty-three would carry NULL and
-- be ranked as an unnamed third panel beside the very instrument they came from.
--
-- sort_order is 20 for all of them, matching the ten seeded in 020 — a
-- deliberate statement that no country in this panel ranks above another
-- editorially. The chart sorts by value.
INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3,
   series_panel, caption_plain, caption_expert)
SELECT 'adoption', id, 'supporting', 20, 'ai-adoption-panel', default_country_iso3,
       'Eurostat — one harmonised survey, thirty-three countries',
       'The share of firms using AI, country by country — forty-four countries, and only thirty-three of them measured the same way.',
       'Forty-four countries, from TWO different surveys. Thirty-three are the Eurostat Community Survey on ICT usage in enterprises (10+ employees, at least one AI technology), harmonised by construction: same instrument, same definition, same reference year across all thirty-three, which is what makes the level differences among them readable as real. Twenty-seven of those are EU members and six are not — Norway, Türkiye, Serbia, Bosnia and Herzegovina, Montenegro and Albania take part without being in the Union. The other eleven are the OECD''s compilation of national surveys, where "using AI" is not held to one definition between countries or against Eurostat''s, so a bar from those eleven set beside a bar from the thirty-three is comparing two instruments and the gap between them is partly definitional. Nor are these readings of one moment: four points at most on the Eurostat side (2021, 2023, 2024, 2025 — the survey did not run in 2022), while the eleven OECD countries were last asked between 2020 and 2024. Albania is a single 2021 observation through DBnomics and is not a current rate.'
  FROM indicators
 WHERE id IN (
         'eurostat.ai_any.ALB', 'eurostat.ai_any.AUT', 'eurostat.ai_any.BEL', 'eurostat.ai_any.BGR',
         'eurostat.ai_any.BIH', 'eurostat.ai_any.CYP', 'eurostat.ai_any.CZE', 'eurostat.ai_any.EST',
         'eurostat.ai_any.GRC', 'eurostat.ai_any.HRV', 'eurostat.ai_any.HUN', 'eurostat.ai_any.LTU',
         'eurostat.ai_any.LUX', 'eurostat.ai_any.LVA', 'eurostat.ai_any.MLT', 'eurostat.ai_any.MNE',
         'eurostat.ai_any.NOR', 'eurostat.ai_any.PRT', 'eurostat.ai_any.ROU', 'eurostat.ai_any.SRB',
         'eurostat.ai_any.SVK', 'eurostat.ai_any.SVN', 'eurostat.ai_any.TUR'
       )
ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, sort_order = EXCLUDED.sort_order,
  chart_group = EXCLUDED.chart_group,
  country_iso3 = EXCLUDED.country_iso3,
  series_panel = EXCLUDED.series_panel,
  caption_plain = EXCLUDED.caption_plain,
  caption_expert = EXCLUDED.caption_expert;


-- The ten Eurostat rows seeded in 020 and stamped by 037 before these existed.
-- One instrument must carry one `series_panel` string or the ranked chart
-- splits it in two, and one chart must carry one caption. See the header.
UPDATE question_indicators
   SET series_panel   = 'Eurostat — one harmonised survey, thirty-three countries',
       caption_plain  = 'The share of firms using AI, country by country — forty-four countries, and only thirty-three of them measured the same way.',
       caption_expert = 'Forty-four countries, from TWO different surveys. Thirty-three are the Eurostat Community Survey on ICT usage in enterprises (10+ employees, at least one AI technology), harmonised by construction: same instrument, same definition, same reference year across all thirty-three, which is what makes the level differences among them readable as real. Twenty-seven of those are EU members and six are not — Norway, Türkiye, Serbia, Bosnia and Herzegovina, Montenegro and Albania take part without being in the Union. The other eleven are the OECD''s compilation of national surveys, where "using AI" is not held to one definition between countries or against Eurostat''s, so a bar from those eleven set beside a bar from the thirty-three is comparing two instruments and the gap between them is partly definitional. Nor are these readings of one moment: four points at most on the Eurostat side (2021, 2023, 2024, 2025 — the survey did not run in 2022), while the eleven OECD countries were last asked between 2020 and 2024. Albania is a single 2021 observation through DBnomics and is not a current rate.'
 WHERE question_id = 'adoption'
   AND chart_group = 'ai-adoption-panel'
   AND indicator_id LIKE 'eurostat.ai_any.%';
