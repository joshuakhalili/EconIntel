-- ============================================================================
-- 002_countries.sql — countries and supranational aggregates
--
-- Scope: G20 plus the economies that matter most to AI (Taiwan for fabs,
-- Netherlands and Ireland for data centres and lithography, Singapore, UAE,
-- Israel, the Nordics). Not every country on earth — this is a focused
-- dashboard, and an empty row for Kiribati is noise on a filter dropdown.
--
-- Aggregates (World, Euro area, OECD) are flagged is_aggregate = TRUE. The
-- World Bank API returns them alongside real countries through the same
-- endpoint, and summing without excluding them double-counts badly.
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
