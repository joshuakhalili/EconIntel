-- ============================================================================
-- 041_worldbank_cross_country.sql — placing the four new World Bank series
--
-- The indicator DEFINITIONS are in db/seeds/006_global_indicators.sql, with the
-- fetch that verified each code and the entity counts it returned. This file
-- only says which question each one answers, because an indicator that holds
-- observations and appears on no question shows up in `orphaned_indicators` and
-- fails `npm run check:data` — data nobody can reach is not evidence.
--
-- WHY country_iso3 IS 'WLD' ON ALL FOUR
--
-- These are the one shape of indicator this schema handles differently: a
-- single id holding every country at once, with `default_country_iso3` NULL so
-- the country-attribution gate in check-data.js correctly exempts it. The
-- `country_iso3` here is not an assertion about the series — it is which
-- country the page opens on, and the honest default for a series that covers
-- 189-234 entities is the world aggregate, which is what wb.SL.UEM.TOTL.ZS on
-- /q/aggregate-unemployment and wb.IT.NET.USER.ZS on /q/diffusion-speed already
-- do (both also appear on other questions opening on USA, so this is a pattern
-- the project uses where it fits, not a rule it keeps everywhere). The World
-- Bank publishes a WLD value for all four; each was fetched on 2026-09-04 and
-- is quoted in the caption below.
--
-- WHAT THE FINAL YEAR OF EACH OF THESE IS WORTH, BECAUSE IT IS NOT A READING
--
-- db/seeds/006's header promises that "the last point on any of these charts is
-- a partial year, not a fall". Two of the four captions below originally drew a
-- DIRECTION out of that last point anyway — ICT service exports were said to
-- have "partly given back" on a 2025 figure, and ICT goods exports were called
-- flat on a 2024 one. Recomputed on 2026-09-04 from
--
--   curl 'https://api.worldbank.org/v2/country/all/indicator/<CODE>
--         ?format=json&per_page=20000&date=2000:2026&source=2'
--
-- counting non-null values per year, the final years are thin enough to move
-- the aggregate on their own:
--
--   BX.GSR.CCIS.ZS     2023: 218 entities   2024: 204   2025: 124
--   TX.VAL.ICTG.ZS.UN  2022: 203 entities   2023: 200   2024: 154
--
-- Excluding the final year reverses one of the two readings outright: ICT
-- service exports have HELD the 2020 step (15.38% in 2020 → 15.00% in 2024),
-- not given it back. Both captions now state the direction on the complete
-- years and name the final year as partial reporting.
--
-- `chart_group` is NULL on all four deliberately. A chart group is the claim
-- that these indicators share one pair of axes, and each of these is already a
-- panel of its own — grouping two of them would draw 200 country lines through
-- six hues, which is the fault `npm run check:charts` exists to catch.
-- ============================================================================

INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3,
   caption_plain, caption_expert)
VALUES

('dot-com', 'wb.NE.GDI.FTOT.ZS', 'context', 5, NULL, 'WLD',
 'How much of the world''s output goes into building things, going back to 2000 — the yardstick this boom has to be measured against.',
 'Gross fixed capital formation as a share of GDP, World Bank NE.GDI.FTOT.ZS, annual, 219 entities. The world figure has sat in a narrow band — 25.16% in 2015, 26.17% in 2021, 25.62% in 2024 — which is the point: an AI capex cycle large enough to matter has to move a number that has not moved much. Use the country selector rather than the world line to compare economies; the aggregate hides everything interesting. The most recent year is thinly reported and will rise as countries file.'),

('power', 'wb.EG.USE.ELEC.KH.PC', 'context', 17, NULL, 'WLD',
 'How much electricity each person uses, country by country. Prices are only half the question — this is the other half.',
 'Electric power consumption per capita, World Bank EG.USE.ELEC.KH.PC, annual, 189 entities. World consumption was 3,558 kWh per person in 2023 against 3,082 in 2015. This is the only cross-country power series the project can reach without a key, and it is the counterweight to a prices lens that is otherwise US electricity and world commodity prices: Germany reads 6,109 kWh per person in 2024 and Nigeria 144 in 2023, a spread no price series shows. It lags badly — 191 entities report 2023 and 51 report 2024 — so the final point is reporting, not a fall.'),

('sector-output', 'wb.BX.GSR.CCIS.ZS', 'supporting', 6, NULL, 'WLD',
 'How much of what the world sells abroad in services is computing and information work.',
 'ICT service exports as a share of total service exports, World Bank BX.GSR.CCIS.ZS, annual, 233 entities. READ EXCLUDING THE FINAL YEAR: the world share went 9.77% in 2015 to 11.73% in 2019, stepped up to 15.38% in 2020, and has stayed there — 15.53% in 2021, 14.37% in 2022, 14.48% in 2023, 15.00% in 2024. The pandemic step is visible and has NOT been given back. The series does carry a 2025 world figure of 13.37%, and that is not a fall: 124 entities report 2025 against 204 for 2024 and 218 for 2023, so the last point on this chart is a partial year, exactly as db/seeds/006 warns for all four of these. It answers the same question as fred.RVAI above it for every country rather than one, from the balance of payments rather than the US national accounts, so the two are complements and not a cross-check: different concepts, different vintages.'),

('sector-output', 'wb.TX.VAL.ICTG.ZS.UN', 'context', 7, NULL, 'WLD',
 'And how much of what the world ships is the actual hardware — computers, chips, communications kit.',
 'ICT goods exports as a share of total goods exports, World Bank TX.VAL.ICTG.ZS.UN, annual, 234 entities. READ EXCLUDING THE FINAL YEAR: the world share is flat — 11.56% in 2015 and 12.00% in 2023, four tenths of a point apart across eight years, with a 12.96% peak in 2020. It carries a 2024 world figure of 12.59%, and the uptick is not read as one: 154 entities report 2024 against 200 for 2023, so the last point on this chart is a partial year, exactly as db/seeds/006 warns for all four of these. That flatness is what separates the economies that make the machines from those that sell the work done on them. Read beside the service-export series above: a country can rise on one and not the other, and which one it rises on is the substance of where it sits in the AI supply chain.')

ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role          = EXCLUDED.role,
  sort_order    = EXCLUDED.sort_order,
  chart_group   = EXCLUDED.chart_group,
  country_iso3  = EXCLUDED.country_iso3,
  caption_plain = EXCLUDED.caption_plain,
  caption_expert = EXCLUDED.caption_expert;
