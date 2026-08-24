-- ============================================================================
-- 001_sources.sql — the provider registry
--
-- Every fact in this database traces to a row here. `attribution_text` is not
-- decoration: several of these licences oblige us to display it, and the UI
-- provenance panel reads this column.
--
-- Seeds are idempotent (ON CONFLICT DO UPDATE) so they can be re-run safely
-- after edits without dropping the database.
-- ============================================================================

INSERT INTO sources (id, name, homepage_url, api_base_url, licence, attribution_text, credibility, requires_key, notes) VALUES

('fred',
 'FRED — Federal Reserve Economic Data',
 'https://fred.stlouisfed.org',
 'https://api.stlouisfed.org/fred',
 'Public Domain (most series; some redistributed under source terms)',
 'Source: Federal Reserve Bank of St. Louis (FRED)',
 10, TRUE,
 'Free key: fredaccount.stlouisfed.org/apikeys. 120 req/min. Authoritative for US series.'),

('worldbank',
 'World Bank Open Data',
 'https://data.worldbank.org',
 'https://api.worldbank.org/v2',
 'CC BY 4.0',
 'Source: World Bank Open Data (CC BY 4.0)',
 10, FALSE,
 'No key. Returns supranational aggregates alongside countries — filter on countries.is_aggregate.'),

('dbnomics',
 'DBnomics',
 'https://db.nomics.world',
 'https://api.db.nomics.world/v22',
 'Varies by upstream provider',
 'Retrieved via DBnomics. Original source retained per series.',
 8, FALSE,
 'Keyless aggregator mirroring FRED, OECD, IMF, Eurostat, BLS, ECB. Convenient but may lag upstream — prefer the primary source where freshness matters.'),

('sec_edgar',
 'SEC EDGAR',
 'https://www.sec.gov/edgar',
 'https://efts.sec.gov/LATEST',
 'Public Domain (US Government work)',
 'Source: US Securities and Exchange Commission, EDGAR',
 10, FALSE,
 'No key, but a descriptive User-Agent with contact details is REQUIRED or requests are refused. Full-text search returns filing MENTIONS, not structured financials.'),

('epoch_ai',
 'Epoch AI',
 'https://epoch.ai/data',
 'https://epoch.ai/data',
 'CC BY 4.0',
 'Source: Epoch AI (CC BY 4.0)',
 8, FALSE,
 'Structured CSVs on notable AI models, ML hardware, GPU clusters and data centres. Best available open source of real AI-compute figures.'),

('federal_register',
 'US Federal Register',
 'https://www.federalregister.gov',
 'https://www.federalregister.gov/api/v1',
 'Public Domain (US Government work)',
 'Source: US Federal Register',
 10, FALSE,
 'No key. Rules, proposed rules and notices — the primary record of US AI regulation.'),

('nasa_gibs',
 'NASA GIBS',
 'https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api',
 'https://gibs.earthdata.nasa.gov',
 'Public Domain / NASA open data',
 'Imagery courtesy of NASA EOSDIS GIBS',
 9, FALSE,
 'No auth. Global tiled imagery. Lower resolution than Sentinel-2 — fallback when Copernicus is unavailable.'),

('copernicus',
 'Copernicus Data Space Ecosystem (Sentinel-2)',
 'https://dataspace.copernicus.eu',
 'https://sh.dataspace.copernicus.eu',
 'Copernicus open licence (free, attribution required)',
 'Contains modified Copernicus Sentinel data',
 9, TRUE,
 '10m optical imagery. Free tier has monthly processing-unit quotas. Phase 3.')

ON CONFLICT (id) DO UPDATE SET
  name             = EXCLUDED.name,
  homepage_url     = EXCLUDED.homepage_url,
  api_base_url     = EXCLUDED.api_base_url,
  licence          = EXCLUDED.licence,
  attribution_text = EXCLUDED.attribution_text,
  credibility      = EXCLUDED.credibility,
  requires_key     = EXCLUDED.requires_key,
  notes            = EXCLUDED.notes;

-- RSS news and government feeds are registered as sources too, so an article
-- carries the same provenance guarantees as a statistic. Credibility scores are
-- carried over from the previous implementation's editorial judgement.
INSERT INTO sources (id, name, homepage_url, licence, attribution_text, credibility, requires_key, notes) VALUES
  ('rss:ft',           'Financial Times',          'https://www.ft.com',                    'Headline/excerpt use', 'Financial Times',                9, FALSE, 'RSS'),
  ('rss:bloomberg',    'Bloomberg',                'https://www.bloomberg.com',             'Headline/excerpt use', 'Bloomberg',                      9, FALSE, 'RSS'),
  ('rss:cnbc',         'CNBC',                     'https://www.cnbc.com',                  'Headline/excerpt use', 'CNBC',                           8, FALSE, 'RSS'),
  ('rss:mit_tech',     'MIT Technology Review',    'https://www.technologyreview.com',      'Headline/excerpt use', 'MIT Technology Review',          9, FALSE, 'RSS'),
  ('rss:arstechnica',  'Ars Technica',             'https://arstechnica.com',               'Headline/excerpt use', 'Ars Technica',                   8, FALSE, 'RSS'),
  ('rss:guardian',     'The Guardian',             'https://www.theguardian.com',           'Headline/excerpt use', 'The Guardian',                   8, FALSE, 'RSS'),
  ('rss:bbc_tech',     'BBC Technology',           'https://www.bbc.co.uk/news/technology', 'Headline/excerpt use', 'BBC News',                       9, FALSE, 'RSS'),
  ('gov:federal_reserve','Federal Reserve',        'https://www.federalreserve.gov',        'Public Domain',        'Federal Reserve',               10, FALSE, 'Government RSS'),
  ('gov:boe',          'Bank of England',          'https://www.bankofengland.co.uk',       'Open Government Licence','Bank of England',             10, FALSE, 'Government RSS'),
  ('gov:ecb',          'European Central Bank',    'https://www.ecb.europa.eu',             'ECB terms',            'European Central Bank',         10, FALSE, 'Government RSS'),
  ('gov:uk',           'UK Government',            'https://www.gov.uk',                    'Open Government Licence','UK Government (OGL v3.0)',    9, FALSE, 'Government RSS'),
  ('gov:ec',           'European Commission',      'https://ec.europa.eu',                  'EC reuse decision',    'European Commission',            9, FALSE, 'Government RSS'),
  ('gov:whitehouse',   'The White House',          'https://www.whitehouse.gov',            'Public Domain',        'The White House',                9, FALSE, 'Government RSS'),
  ('gov:boj',          'Bank of Japan',            'https://www.boj.or.jp',                 'BOJ terms',            'Bank of Japan',                 10, FALSE, 'Government RSS')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, credibility = EXCLUDED.credibility, notes = EXCLUDED.notes;
