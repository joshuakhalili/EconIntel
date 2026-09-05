-- ============================================================================
-- 045_eurostat_electricity_prices_by_country.sql — the discount question,
--                                                   answered per country
--
-- WHY THIS EXISTS
--
-- /q/bulk-discount asks "Do the biggest power buyers still get a discount?" —
-- which is really the question of whether a data centre gets a preferential
-- industrial tariff. It was asked of the United States and answered with an
-- EU-WIDE AVERAGE, because the only two Eurostat price series the project held
-- were the EU27 aggregate of each consumption band.
--
-- An aggregate cannot show dispersion. That is the argument db/seeds/020 makes
-- about AI adoption and it applies here exactly: national industrial
-- electricity prices inside the EU differ by more than a factor of three, and
-- the average is the one number that hides it.
--
-- WHAT THE COUNTRY SERIES SHOW THAT THE AGGREGATE CANNOT — 2025-S1, EUR/kWh
-- excluding taxes, verified by fetching every series below on 2026-09-04
--
--   Band IE (20-70 GWh a year)      Band IG (150 GWh+)     discount
--     Ireland      0.2109             Ireland   0.1911        9.4%
--     Germany      0.1346             Germany   0.1205       10.5%
--     Netherlands  0.1109             Neth.     0.0865       22.0%
--     Poland       0.1058             Poland    0.1067       −0.9%
--     France       0.0881             France    0.0699       20.7%
--     Sweden       0.0661             Sweden    0.0561       15.1%
--     [EU27        0.1200]            [EU27     0.1022      14.8%]
--
-- Two things follow, and neither was visible before this file.
--
-- 1. Irish industrial power costs 3.19 times Swedish, in the same band, in the
--    same half-year, in the same currency. The EU27 average sits at 0.12 and
--    describes neither. Siting decisions are made on that spread.
--
-- 2. THE DISCOUNT IS NOT UNIVERSAL. The EU aggregate says the very largest
--    buyers pay about 15% less, and in the Netherlands and France they pay
--    about 21-22% less — but in POLAND THE BIGGEST BUYERS PAY MORE, 0.1067
--    against 0.1058 for the mid band, a negative discount. The question this
--    page asks has a different answer in different member states, and the one
--    series the page had could not have told anyone that.
--
-- HOW EVERY CODE WAS ESTABLISHED
--
--   curl 'https://api.db.nomics.world/v22/series/Eurostat/nrg_pc_205/
--         S.6000.<BAND>.KWH.X_TAX.EUR.<GEO2>?observations=1'
--
-- All twelve returned 200 with observations; the counts and first/last values
-- in each description are what came back on 2026-09-04. ONE COUNT NEEDS ITS
-- BASIS STATED: Ireland's very-large band returns SIXTEEN periods, of which the
-- first (2017-S1) is the sentinel string 'NA'. `fetchSeries` in
-- src/server/ingestion/sources/dbnomics.js turns 'NA' into a null rather than
-- NaN, so it never becomes a value; its description counts the fifteen real
-- observations and starts the run at 2018-S1. Every other series here is
-- non-null throughout. Eurostat's own table
-- was fetched first to confirm the geo dimension holds 43 entities — EU27_2020,
-- EA and 41 countries — of which the project held two, both aggregates.
--
-- Note the band code collision when reading these: Eurostat's consumption band
-- "IE" is 20,000-69,999 MWh a year and has nothing to do with Ireland, whose
-- geo code is also IE. The series code carries both, in that order.
--
-- WHY THESE SIX COUNTRIES
--
-- Germany, France, Ireland, the Netherlands, Sweden and Poland are where
-- European data centre capacity is actually sited or actively contested.
-- Six is also the number of validated hues, and each of the two groups below
-- is a line chart where colour carries which country a line is — a seventh
-- would put two countries in one colour, and `npm run check:charts` would fail.
--
-- WHY TWO CHART GROUPS AND NOT ONE
--
-- Twelve series on one pair of axes is the exact fault this project's palette
-- rule exists to prevent. Split by BAND rather than by country, so each chart
-- is one consumption band across six countries and the discount is read by
-- comparing the two charts country by country. A single derived "discount"
-- series — the ratio between the bands — would be the better chart and needs an
-- indicator computed at ingest, which is code and not a seed; it is named here
-- rather than half-built.
--
-- ONE HONEST LIMITATION ON THE VERY-LARGE BAND
--
-- Its runs are short and they start in different years: 2019-S2 for Germany,
-- 2018-S1 for Ireland, 2017-S1 for France and Sweden, against 2009-S1 for the
-- Netherlands and 2008-S2 for Poland. Eurostat did not report the band for
-- every country from the start. Each line must begin where its data begins and
-- the chart must not imply a common baseline. Each series says so in its own
-- description.
--
-- DECLARED CADENCE
--
-- Every row here says 'annual' and publishes twice a year — a 184-day modal
-- gap. That is not sloppiness and it is not fixable in a seed: the `cadence`
-- enum is (daily, weekly, monthly, quarterly, annual, irregular), there is no
-- 'semiannual', and 'irregular' would be a worse falsehood because these are
-- perfectly regular. db/seeds/036 sets out the migration that adds the value,
-- and scripts/check-data.js deliberately treats a modal gap no enum describes
-- as unclassifiable rather than faulting a row for failing to say something the
-- schema cannot hold. These twelve join the two EU27 rows in that exemption.
--
-- `decimals` is 4 here where the two EU27 rows use 2. A price of 0.0561 EUR/kWh
-- rendered to two decimals is 0.06, which loses the Swedish-Irish comparison
-- entirely. The EU27 pair should be corrected to match; it is not done here
-- because those rows are not what this file is about.
-- ============================================================================

INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval, default_country_iso3
) VALUES

('dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.DE',
 'Germany — electricity price, 20-70 GWh a year, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IE, 20-70 GWh a year, excluding taxes and levies. This is the band a large factory sits in, and the comparator the very-large band is read against. 37 semiannual observations, 2007-S1 0.0667 to 2025-S1 0.1346 EUR/kWh. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.DE',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.DE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'DEU'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.FR',
 'France — electricity price, 20-70 GWh a year, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IE, 20-70 GWh a year, excluding taxes and levies. This is the band a large factory sits in, and the comparator the very-large band is read against. 36 semiannual observations, 2007-S2 0.0481 to 2025-S1 0.0881 EUR/kWh. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.FR',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.FR',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'FRA'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.IE',
 'Ireland — electricity price, 20-70 GWh a year, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IE, 20-70 GWh a year, excluding taxes and levies. This is the band a large factory sits in, and the comparator the very-large band is read against. 36 semiannual observations, 2007-S2 0.1094 to 2025-S1 0.2109 EUR/kWh. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.IE',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.IE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'IRL'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.NL',
 'Netherlands — electricity price, 20-70 GWh a year, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IE, 20-70 GWh a year, excluding taxes and levies. This is the band a large factory sits in, and the comparator the very-large band is read against. 37 semiannual observations, 2007-S1 0.0760 to 2025-S1 0.1109 EUR/kWh. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.NL',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.NL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'NLD'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.SE',
 'Sweden — electricity price, 20-70 GWh a year, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IE, 20-70 GWh a year, excluding taxes and levies. This is the band a large factory sits in, and the comparator the very-large band is read against. 37 semiannual observations, 2007-S1 0.0466 to 2025-S1 0.0661 EUR/kWh. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.SE',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.SE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'SWE'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.PL',
 'Poland — electricity price, 20-70 GWh a year, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IE, 20-70 GWh a year, excluding taxes and levies. This is the band a large factory sits in, and the comparator the very-large band is read against. 36 semiannual observations, 2007-S2 0.0470 to 2025-S1 0.1058 EUR/kWh. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.PL',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH20000-69999.KWH.X_TAX.EUR.PL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'POL'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.DE',
 'Germany — electricity price, 150 GWh a year and over, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IG, 150 GWh a year and over, excluding taxes and levies. This is the data-centre band: a hyperscale site draws more than 150 GWh a year, so this is the tariff an operator actually faces. 12 semiannual observations, 2019-S2 0.0348 to 2025-S1 0.1205 EUR/kWh. WEAKNESS: the run is short — this band was not reported for Germany before 2019-S2 — so it cannot be read back to the pre-2015 period the way the 20-70 GWh band can. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.DE',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.DE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'DEU'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.FR',
 'France — electricity price, 150 GWh a year and over, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IG, 150 GWh a year and over, excluding taxes and levies. This is the data-centre band: a hyperscale site draws more than 150 GWh a year, so this is the tariff an operator actually faces. 17 semiannual observations, 2017-S1 0.0456 to 2025-S1 0.0699 EUR/kWh. WEAKNESS: the run is short — this band was not reported for France before 2017-S1 — so it cannot be read back to the pre-2015 period the way the 20-70 GWh band can. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.FR',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.FR',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'FRA'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.IE',
 'Ireland — electricity price, 150 GWh a year and over, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IG, 150 GWh a year and over, excluding taxes and levies. This is the data-centre band: a hyperscale site draws more than 150 GWh a year, so this is the tariff an operator actually faces. 15 semiannual observations, 2018-S1 0.0760 to 2025-S1 0.1911 EUR/kWh. WEAKNESS: the run is short — this band was not reported for Ireland before 2018-S1 — so it cannot be read back to the pre-2015 period the way the 20-70 GWh band can. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.IE',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.IE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'IRL'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.NL',
 'Netherlands — electricity price, 150 GWh a year and over, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IG, 150 GWh a year and over, excluding taxes and levies. This is the data-centre band: a hyperscale site draws more than 150 GWh a year, so this is the tariff an operator actually faces. 33 semiannual observations, 2009-S1 0.0663 to 2025-S1 0.0865 EUR/kWh. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.NL',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.NL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'NLD'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.SE',
 'Sweden — electricity price, 150 GWh a year and over, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IG, 150 GWh a year and over, excluding taxes and levies. This is the data-centre band: a hyperscale site draws more than 150 GWh a year, so this is the tariff an operator actually faces. 17 semiannual observations, 2017-S1 0.0380 to 2025-S1 0.0561 EUR/kWh. WEAKNESS: the run is short — this band was not reported for Sweden before 2017-S1 — so it cannot be read back to the pre-2015 period the way the 20-70 GWh band can. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.SE',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.SE',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'SWE'),

('dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.PL',
 'Poland — electricity price, 150 GWh a year and over, excluding taxes',
 'Price of electricity for non-household consumers in Eurostat consumption band IG, 150 GWh a year and over, excluding taxes and levies. This is the data-centre band: a hyperscale site draws more than 150 GWh a year, so this is the tariff an operator actually faces. 34 semiannual observations, 2008-S2 0.0666 to 2025-S1 0.1067 EUR/kWh. CADENCE: Eurostat publishes this twice a year and the row is declared ''annual'' because the schema has no ''semiannual'' value; db/seeds/036 records the migration that fixes it.',
 'infrastructure', 'currency', 'annual', 'official',
 'Euro per kilowatt-hour, excluding taxes and levies', NULL, 4, 'dbnomics',
 'Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.PL',
 'https://db.nomics.world/Eurostat/nrg_pc_205/S.6000.MWH_GE150000.KWH.X_TAX.EUR.PL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'POL')
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


-- Two groups on `bulk-discount`, one per consumption band, six countries each.
-- The existing `eu-electricity-bands` group keeps the two EU27 series and the
-- band-versus-band comparison it was built for; these two add the dispersion
-- that the aggregate cannot show.

INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3,
   caption_plain, caption_expert)
SELECT 'bulk-discount', id, 'supporting', 11, 'industrial-power-price-mid',
       default_country_iso3,
       'What a large factory pays for power, in six countries — Ireland pays over three times what Sweden pays.',
       'Eurostat nrg_pc_205, non-household consumers, consumption band IE (20,000-69,999 MWh a year), excluding taxes and levies, semiannual. At 2025-S1: Ireland 0.2109, Germany 0.1346, Netherlands 0.1109, Poland 0.1058, France 0.0881, Sweden 0.0661 EUR/kWh — a factor of 3.19 between the extremes, against an EU27 average of 0.1200 that describes neither end. This is the comparator band; the chart below it is the same six countries in the data-centre band, and the difference between the two is the discount.'
  FROM indicators
 WHERE id IN (
         'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.DE', 'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.FR',
         'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.IE', 'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.NL',
         'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.SE', 'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.PL'
       )
ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, sort_order = EXCLUDED.sort_order,
  chart_group = EXCLUDED.chart_group,
  country_iso3 = EXCLUDED.country_iso3,
  caption_plain = EXCLUDED.caption_plain,
  caption_expert = EXCLUDED.caption_expert;

INSERT INTO question_indicators
  (question_id, indicator_id, role, sort_order, chart_group, country_iso3,
   caption_plain, caption_expert)
SELECT 'bulk-discount', id, 'supporting', 21, 'industrial-power-price-very-large',
       default_country_iso3,
       'And what the very biggest buyers pay — the data-centre band. In Poland they pay slightly more than a mid-sized factory does, not less.',
       'Eurostat nrg_pc_205, non-household consumers, consumption band IG (150,000 MWh a year and over), excluding taxes and levies, semiannual. Against the band above, at 2025-S1: Netherlands −22.0%, France −20.7%, Sweden −15.1%, Germany −10.5%, Ireland −9.4%, Poland +0.9%. The EU27 aggregate the page previously relied on shows −14.8% and implies the discount is a fact about European industrial tariffs; it is a fact about some of them. Read each line from where it starts — Eurostat did not report this band for every country from the same year, so Germany begins in 2019-S2 and the Netherlands in 2009-S1.'
  FROM indicators
 WHERE id IN (
         'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.DE', 'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.FR',
         'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.IE', 'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.NL',
         'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.SE', 'dbn.Eurostat.nrg_pc_205.S.6000.MWH_GE150000.KWH.X_TAX.EUR.PL'
       )
ON CONFLICT (question_id, indicator_id) DO UPDATE SET
  role = EXCLUDED.role, sort_order = EXCLUDED.sort_order,
  chart_group = EXCLUDED.chart_group,
  country_iso3 = EXCLUDED.country_iso3,
  caption_plain = EXCLUDED.caption_plain,
  caption_expert = EXCLUDED.caption_expert;
