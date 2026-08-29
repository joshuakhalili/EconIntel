-- Enterprise AI adoption, per country.
--
-- WHY THIS EXISTS
--
-- The catalogue held exactly one AI-adoption series with a country attached
-- (Korea) and two more as EU27 and OECD aggregates. An aggregate cannot show
-- diffusion — that is the whole point of the word — so the one thing this site
-- is named after was the one thing it could not draw.
--
-- Every code below was verified against the DBnomics API before seeding, by
-- fetching it and confirming it returns observations. A wrong DBnomics code
-- does not error; it returns an empty series that renders as "no data" rather
-- than as "broken", which is the failure this project keeps having to catch.
-- Observation counts and period ranges in the comments are what was actually
-- returned on 2026-08-29.
--
-- TWO SOURCES, AND WHY THEY ARE NOT INTERCHANGEABLE
--
-- Eurostat's `isoc_eb_ai` is the Community Survey on ICT usage in enterprises:
-- harmonised across member states, 10+ employees, periods 2021 / 2023 / 2024 /
-- 2025 (the survey skipped 2022). This is the good panel — same instrument,
-- same definition, four points, currently running.
--
-- OECD's `DSD_ICT_B` compiles national surveys, so it reaches beyond Europe but
-- pays for it in comparability. It is seeded ONLY for countries Eurostat does
-- not cover, so the two never disagree on the same country.
--
-- The OECD rows are weak in ways that must not be smoothed over:
--   GBR  a single observation (2020). It draws as a dot, not a line.
--   USA  ends 2021 and is non-monotonic — 6.40, 3.68, 5.65.
--   AUS  two observations, 2020 and 2022.
--   KOR  a methodology break at 2022: 2.65 (2021) to 27.99 (2022). Charted
--        naively that reads as a tenfold jump in one year. It is a change in
--        what the survey counts, not in what firms did.
-- Each carries that warning in its own `description`, because the place a
-- reader meets a series is the place the warning has to be.
--
-- WHAT THIS PANEL CANNOT DO
--
-- Sixteen countries, ten of them European, four annual points at best, starting
-- 2021. It cannot show a smooth global diffusion curve and nothing built on it
-- should imply one. Anything that animates between these values is showing
-- interpolation between four surveys, and has to say so.

INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval, default_country_iso3
) VALUES

-- ── Eurostat: the harmonised panel ──────────────────────────────────────────
-- 4 obs each, 2021-2025. Germany runs 10.56 (2021) to 25.97 (2025).
('eurostat.ai_any.DEU', 'Germany — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises, harmonised across member states. Four observations: 2021, 2023, 2024, 2025 — the survey did not run in 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.DE',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.DE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'DEU'),

('eurostat.ai_any.FRA', 'France — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. Four observations: 2021, 2023, 2024, 2025.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.FR',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.FR',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'FRA'),

('eurostat.ai_any.ITA', 'Italy — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. Four observations: 2021, 2023, 2024, 2025.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.IT',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.IT',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'ITA'),

('eurostat.ai_any.ESP', 'Spain — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. Four observations: 2021, 2023, 2024, 2025.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.ES',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.ES',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'ESP'),

('eurostat.ai_any.NLD', 'Netherlands — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. Four observations: 2021, 2023, 2024, 2025.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.NL',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.NL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'NLD'),

('eurostat.ai_any.POL', 'Poland — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. Four observations: 2021, 2023, 2024, 2025.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.PL',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.PL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'POL'),

('eurostat.ai_any.SWE', 'Sweden — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. Four observations: 2021, 2023, 2024, 2025.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.SE',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.SE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'SWE'),

('eurostat.ai_any.DNK', 'Denmark — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. Four observations: 2021, 2023, 2024, 2025.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.DK',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.DK',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'DNK'),

('eurostat.ai_any.FIN', 'Finland — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. Four observations: 2021, 2023, 2024, 2025.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.FI',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.FI',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'FIN'),

('eurostat.ai_any.IRL', 'Ireland — Enterprises using AI',
 'Share of enterprises with 10 or more employees using at least one AI technology. Eurostat Community Survey on ICT usage in enterprises. Four observations: 2021, 2023, 2024, 2025.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.IE',
 'https://db.nomics.world/Eurostat/isoc_eb_ai/A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.IE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'IRL'),

-- ── OECD: outside Eurostat's reach, and weaker for it ───────────────────────
('oecd.ai_any.GBR', 'United Kingdom — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses. WEAKNESS: a single observation, 2020 (4.11%) — there is no UK time series. The UK left the Eurostat survey after Brexit and no comparable national series has replaced it, so this draws as one point and cannot show a trend.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/GBR.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/GBR.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'GBR'),

('oecd.ai_any.USA', 'United States — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses. WEAKNESS: ends in 2021 and is non-monotonic (6.40, 3.68, 5.65), so it predates the generative-AI period entirely and cannot be read as the current US rate.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/USA.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/USA.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'USA'),

('oecd.ai_any.JPN', 'Japan — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses, compiled from the national survey. Three observations, 2019 to 2023.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/JPN.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/JPN.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'JPN'),

('oecd.ai_any.CAN', 'Canada — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses, compiled from the national survey. Three observations, 2019 to 2023.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/CAN.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/CAN.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'CAN'),

('oecd.ai_any.AUS', 'Australia — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses. WEAKNESS: two observations only, 2020 and 2022.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/AUS.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/AUS.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'AUS'),

('oecd.ai_any.KOR', 'South Korea — Enterprises using AI',
 'Share of enterprises with 10 or more employees using AI. OECD ICT Access and Usage by Businesses. WEAKNESS: a methodology break at 2022 — 2.65% in 2021 to 27.99% in 2022. That is a change in what the survey counts, not a tenfold change in what firms did, and the two halves are not comparable.',
 'adoption', 'rate', 'annual', 'official', 'Percentage of enterprises', '%', 1,
 'dbnomics', 'OECD/DSD_ICT_B@DF_BUSINESSES/KOR.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/KOR.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'KOR')

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

-- Place them on the adoption question so they are reachable and do not sit in
-- `orphaned_indicators`. One chart group: same unit, same definition, so they
-- share an axis legitimately.
INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3,
   caption_plain, caption_expert)
SELECT 'adoption', id, 'supporting', 20, 'ai-adoption-panel', default_country_iso3,
       'The share of firms using AI, country by country.',
       'Eurostat Community Survey on ICT usage in enterprises for the ten EU members; OECD compilations of national surveys elsewhere. Harmonised within Eurostat, not across the OECD additions — read the level differences between those two groups as partly definitional.'
  FROM indicators
 WHERE id LIKE 'eurostat.ai_any.%' OR id LIKE 'oecd.ai_any.%'
ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, chart_group = EXCLUDED.chart_group,
  country_iso3 = EXCLUDED.country_iso3,
  caption_plain = EXCLUDED.caption_plain, caption_expert = EXCLUDED.caption_expert;
