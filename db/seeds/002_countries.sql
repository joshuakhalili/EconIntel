-- ============================================================================
-- 002_countries.sql — countries and supranational aggregates
--
-- THIS TABLE IS A CAP, NOT A DROPDOWN
--
-- It was written as a filter list — "G20 plus the economies that matter most to
-- AI" — and the original note below argued that an empty row for Kiribati is
-- noise. That reasoning was sound for a picker and wrong for this table,
-- because `ingestWorldBankIndicator` (src/server/ingestion/runner.js:139) asks
-- the World Bank API only for the countries already sitting here and discards
-- anything else the API returns. Every multi-country World Bank series was
-- therefore capped at the 44 real rows this file held, silently, however wide
-- the source was: NE.GDI.FTOT.ZS covers 219 entities, IT.CEL.SETS.P2 covers 257.
-- A reader had no way to tell that Viet Nam appeared and Thailand did not
-- because of a seed file rather than because of the data.
--
-- WHAT CHANGED, AND ON WHAT EVIDENCE
--
-- Grown from 44 real countries to 99 on 2026-09-04. Every added row — ISO3,
-- ISO2, name, region and income group — is copied from the World Bank's own
-- country register, fetched on that date:
--
--     curl 'https://api.worldbank.org/v2/country?format=json&per_page=400'
--     → 217 records carrying a real region (the rest are aggregates)
--
-- Nothing here is remembered or inferred. Coordinates for the new rows are in
-- db/seeds/040_country_coverage.sql, which runs after 021 so it cannot clobber
-- the hand-placed label points that file argues for.
--
-- The old regional balance was Europe 19, East Asia 10, Latin America 5, MENA 4,
-- Sub-Saharan Africa 3, North America 2, South Asia 1. Three African countries
-- and one South Asian country is not a global dashboard. The additions are
-- weighted at the thin end: Sub-Saharan Africa 3 → 15, South Asia 1 → 5,
-- Latin America 5 → 12, MENA 4 → 10, East Asia 10 → 16.
--
-- Europe grows hardest (19 → 39) and that is not a preference. Eurostat's
-- isoc_eb_ai publishes the same harmonised AI-adoption instrument for 33
-- countries (see db/seeds/042), and an indicator cannot name a country this
-- table does not hold — `indicators.default_country_iso3` is a foreign key onto
-- `iso3`. Seventeen of the twenty European additions exist because that survey
-- reaches them.
--
-- TWO PLACES WHERE THE WORLD BANK'S OWN REGION IS NOT USED
--
-- The World Bank moved Afghanistan and Pakistan into "Middle East, North
-- Africa, Afghanistan & Pakistan", and files Malta there too. This table keeps
-- the seven classic regions the existing 44 rows already use, so Pakistan is
-- filed under South Asia and Malta under Europe & Central Asia. Both are
-- flagged in the comment on their row. Nothing else diverges.
--
-- Aggregates (World, Euro area, OECD) are flagged is_aggregate = TRUE. The
-- World Bank API returns them alongside real countries through the same
-- endpoint, and summing without excluding them double-counts badly.
--
-- Original scope note, kept because it explains the 44 rows that were here
-- first: G20 plus the economies that matter most to AI (Taiwan for fabs,
-- Netherlands and Ireland for data centres and lithography, Singapore, UAE,
-- Israel, the Nordics).
-- ============================================================================

INSERT INTO countries (iso3, iso2, name, region, income_group, is_aggregate) VALUES

-- North America
('USA','US','United States',        'North America',            'High income', FALSE),
('CAN','CA','Canada',               'North America',            'High income', FALSE),
('MEX','MX','Mexico',               'Latin America & Caribbean','Upper middle income', FALSE),

-- Europe
('GBR','GB','United Kingdom',       'Europe & Central Asia',    'High income', FALSE),
('DEU','DE','Germany',              'Europe & Central Asia',    'High income', FALSE),
('FRA','FR','France',               'Europe & Central Asia',    'High income', FALSE),
('ITA','IT','Italy',                'Europe & Central Asia',    'High income', FALSE),
('ESP','ES','Spain',                'Europe & Central Asia',    'High income', FALSE),
('NLD','NL','Netherlands',          'Europe & Central Asia',    'High income', FALSE),
('IRL','IE','Ireland',              'Europe & Central Asia',    'High income', FALSE),
('SWE','SE','Sweden',               'Europe & Central Asia',    'High income', FALSE),
('DNK','DK','Denmark',              'Europe & Central Asia',    'High income', FALSE),
('FIN','FI','Finland',              'Europe & Central Asia',    'High income', FALSE),
('NOR','NO','Norway',               'Europe & Central Asia',    'High income', FALSE),
('CHE','CH','Switzerland',          'Europe & Central Asia',    'High income', FALSE),
('POL','PL','Poland',               'Europe & Central Asia',    'High income', FALSE),
('BEL','BE','Belgium',              'Europe & Central Asia',    'High income', FALSE),
('AUT','AT','Austria',              'Europe & Central Asia',    'High income', FALSE),
('PRT','PT','Portugal',             'Europe & Central Asia',    'High income', FALSE),
('CZE','CZ','Czechia',              'Europe & Central Asia',    'High income', FALSE),
('TUR','TR','Türkiye',              'Europe & Central Asia',    'Upper middle income', FALSE),
('RUS','RU','Russian Federation',   'Europe & Central Asia',    'Upper middle income', FALSE),

-- Asia-Pacific
('CHN','CN','China',                'East Asia & Pacific',      'Upper middle income', FALSE),
('JPN','JP','Japan',                'East Asia & Pacific',      'High income', FALSE),
('KOR','KR','Korea, Rep.',          'East Asia & Pacific',      'High income', FALSE),
('TWN','TW','Taiwan',               'East Asia & Pacific',      'High income', FALSE),
('IND','IN','India',                'South Asia',               'Lower middle income', FALSE),
('SGP','SG','Singapore',            'East Asia & Pacific',      'High income', FALSE),
('AUS','AU','Australia',            'East Asia & Pacific',      'High income', FALSE),
('NZL','NZ','New Zealand',          'East Asia & Pacific',      'High income', FALSE),
('IDN','ID','Indonesia',            'East Asia & Pacific',      'Upper middle income', FALSE),
('MYS','MY','Malaysia',             'East Asia & Pacific',      'Upper middle income', FALSE),
('VNM','VN','Viet Nam',             'East Asia & Pacific',      'Lower middle income', FALSE),

-- Middle East & Africa
('ISR','IL','Israel',               'Middle East & North Africa','High income', FALSE),
('ARE','AE','United Arab Emirates', 'Middle East & North Africa','High income', FALSE),
('SAU','SA','Saudi Arabia',         'Middle East & North Africa','High income', FALSE),
('ZAF','ZA','South Africa',         'Sub-Saharan Africa',       'Upper middle income', FALSE),
('NGA','NG','Nigeria',              'Sub-Saharan Africa',       'Lower middle income', FALSE),
('KEN','KE','Kenya',                'Sub-Saharan Africa',       'Lower middle income', FALSE),
('EGY','EG','Egypt, Arab Rep.',     'Middle East & North Africa','Lower middle income', FALSE),

-- Latin America
('BRA','BR','Brazil',               'Latin America & Caribbean','Upper middle income', FALSE),
('ARG','AR','Argentina',            'Latin America & Caribbean','Upper middle income', FALSE),
('CHL','CL','Chile',                'Latin America & Caribbean','High income', FALSE),
('COL','CO','Colombia',             'Latin America & Caribbean','Upper middle income', FALSE),

-- ── Added 2026-09-04 ────────────────────────────────────────────────────────
-- Region and income group as the World Bank publishes them; see the header.

-- Europe & Central Asia. Seventeen of these twenty are here because Eurostat's
-- isoc_eb_ai carries them (db/seeds/042); UKR, KAZ and ISL are regional breadth.
('LUX','LU','Luxembourg',           'Europe & Central Asia',    'High income', FALSE),
('EST','EE','Estonia',              'Europe & Central Asia',    'High income', FALSE),
('SVN','SI','Slovenia',             'Europe & Central Asia',    'High income', FALSE),
('MLT','MT','Malta',                'Europe & Central Asia',    'High income', FALSE),   -- WB files Malta under MENA+AfPak; kept in Europe here
('LTU','LT','Lithuania',            'Europe & Central Asia',    'High income', FALSE),
('SVK','SK','Slovak Republic',      'Europe & Central Asia',    'High income', FALSE),
('HRV','HR','Croatia',              'Europe & Central Asia',    'High income', FALSE),
('LVA','LV','Latvia',               'Europe & Central Asia',    'High income', FALSE),
('BIH','BA','Bosnia and Herzegovina','Europe & Central Asia',   'Upper middle income', FALSE),
('HUN','HU','Hungary',              'Europe & Central Asia',    'High income', FALSE),
('SRB','RS','Serbia',               'Europe & Central Asia',    'Upper middle income', FALSE),
('MNE','ME','Montenegro',           'Europe & Central Asia',    'Upper middle income', FALSE),
('CYP','CY','Cyprus',               'Europe & Central Asia',    'High income', FALSE),
('ALB','AL','Albania',              'Europe & Central Asia',    'Upper middle income', FALSE),
('GRC','GR','Greece',               'Europe & Central Asia',    'High income', FALSE),   -- Eurostat's geo code is EL, not GR
('BGR','BG','Bulgaria',             'Europe & Central Asia',    'High income', FALSE),
('ROU','RO','Romania',              'Europe & Central Asia',    'High income', FALSE),
('UKR','UA','Ukraine',              'Europe & Central Asia',    'Upper middle income', FALSE),
('KAZ','KZ','Kazakhstan',           'Europe & Central Asia',    'Upper middle income', FALSE),
('ISL','IS','Iceland',              'Europe & Central Asia',    'High income', FALSE),

-- Sub-Saharan Africa. Was three rows: Kenya, Nigeria, South Africa.
('ETH','ET','Ethiopia',             'Sub-Saharan Africa',       'Low income', FALSE),
('GHA','GH','Ghana',                'Sub-Saharan Africa',       'Lower middle income', FALSE),
('TZA','TZ','Tanzania',             'Sub-Saharan Africa',       'Lower middle income', FALSE),
('UGA','UG','Uganda',               'Sub-Saharan Africa',       'Low income', FALSE),
('SEN','SN','Senegal',              'Sub-Saharan Africa',       'Lower middle income', FALSE),
('CIV','CI','Côte d''Ivoire',       'Sub-Saharan Africa',       'Lower middle income', FALSE),
('CMR','CM','Cameroon',             'Sub-Saharan Africa',       'Lower middle income', FALSE),
('AGO','AO','Angola',               'Sub-Saharan Africa',       'Lower middle income', FALSE),
('ZMB','ZM','Zambia',               'Sub-Saharan Africa',       'Lower middle income', FALSE),
('RWA','RW','Rwanda',               'Sub-Saharan Africa',       'Low income', FALSE),
('MOZ','MZ','Mozambique',           'Sub-Saharan Africa',       'Low income', FALSE),
('ZWE','ZW','Zimbabwe',             'Sub-Saharan Africa',       'Lower middle income', FALSE),

-- South Asia. Was one row: India.
('PAK','PK','Pakistan',             'South Asia',               'Lower middle income', FALSE),   -- WB files Pakistan under MENA+AfPak; kept in South Asia here
('BGD','BD','Bangladesh',           'South Asia',               'Lower middle income', FALSE),
('LKA','LK','Sri Lanka',            'South Asia',               'Upper middle income', FALSE),
('NPL','NP','Nepal',                'South Asia',               'Lower middle income', FALSE),

-- Middle East & North Africa
('MAR','MA','Morocco',              'Middle East & North Africa','Lower middle income', FALSE),
('TUN','TN','Tunisia',              'Middle East & North Africa','Lower middle income', FALSE),
('DZA','DZ','Algeria',              'Middle East & North Africa','Upper middle income', FALSE),
('JOR','JO','Jordan',               'Middle East & North Africa','Upper middle income', FALSE),
('QAT','QA','Qatar',                'Middle East & North Africa','High income', FALSE),
('KWT','KW','Kuwait',               'Middle East & North Africa','High income', FALSE),

-- Latin America & Caribbean
('PER','PE','Peru',                 'Latin America & Caribbean','Upper middle income', FALSE),
('ECU','EC','Ecuador',              'Latin America & Caribbean','Upper middle income', FALSE),
('URY','UY','Uruguay',              'Latin America & Caribbean','High income', FALSE),
('CRI','CR','Costa Rica',           'Latin America & Caribbean','High income', FALSE),
('PAN','PA','Panama',               'Latin America & Caribbean','High income', FALSE),
('DOM','DO','Dominican Republic',   'Latin America & Caribbean','Upper middle income', FALSE),
('GTM','GT','Guatemala',            'Latin America & Caribbean','Upper middle income', FALSE),

-- East Asia & Pacific
('THA','TH','Thailand',             'East Asia & Pacific',      'Upper middle income', FALSE),
('PHL','PH','Philippines',          'East Asia & Pacific',      'Upper middle income', FALSE),
('HKG','HK','Hong Kong SAR, China', 'East Asia & Pacific',      'High income', FALSE),
('KHM','KH','Cambodia',             'East Asia & Pacific',      'Lower middle income', FALSE),
('MNG','MN','Mongolia',             'East Asia & Pacific',      'Upper middle income', FALSE),
('PNG','PG','Papua New Guinea',     'East Asia & Pacific',      'Lower middle income', FALSE),

-- Supranational aggregates. NEVER sum across these and real countries.
('WLD', NULL,'World',               NULL, NULL, TRUE),
('EUU', NULL,'European Union',      NULL, NULL, TRUE),
('EMU', NULL,'Euro area',           NULL, NULL, TRUE),
('OED', NULL,'OECD members',        NULL, NULL, TRUE),
('HIC', NULL,'High income',         NULL, NULL, TRUE),
('LMY', NULL,'Low & middle income', NULL, NULL, TRUE)

ON CONFLICT (iso3) DO UPDATE SET
  iso2         = EXCLUDED.iso2,
  name         = EXCLUDED.name,
  region       = EXCLUDED.region,
  income_group = EXCLUDED.income_group,
  is_aggregate = EXCLUDED.is_aggregate;
