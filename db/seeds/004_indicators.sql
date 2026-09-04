-- ============================================================================
-- 004_indicators.sql — the indicator catalog
--
-- Each row defines a metric: what it means, where it comes from, how much to
-- trust it, and how it should be drawn. Observations arrive later via ingestion.
--
-- ON SERIES ID CONFIDENCE
-- Series codes below were written from knowledge of these providers, not
-- verified against a live API (the build environment has no outbound network
-- access to data providers). A wrong code does not error — it returns an empty
-- series, which renders as an empty chart. That is the most dangerous kind of
-- bug because it looks like "no data" rather than "broken".
--
-- Therefore: run `npm run verify:sources` on a machine with network access
-- BEFORE trusting any chart. It probes every code here and reports which
-- resolve. Codes marked [UNVERIFIED] below are ones this author is least
-- confident about; codes with no marker are still not verified, merely more
-- likely correct.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- PILLAR: ADOPTION — productivity, labour and output
--
-- The economic question: is AI adoption showing up in the productivity
-- statistics? (Historically, general-purpose technologies take a decade or more
-- to appear here — the "Solow paradox". A dashboard that expects an immediate
-- effect is asking the wrong question, so these series are the control group as
-- much as the treatment.)
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval
) VALUES

('fred.OPHNFB',
 'US Labour Productivity (Nonfarm Business)',
 'Real output per hour of all persons, nonfarm business sector. The headline US productivity measure and the single most important series for testing whether AI adoption is translating into measurable economic output.',
 'adoption', 'index', 'quarterly', 'official',
 'index_2017=100', NULL, 1, 'fred', 'OPHNFB',
 'https://fred.stlouisfed.org/series/OPHNFB',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '1 day'),

('fred.OPHMFG',
 'US Labour Productivity (Manufacturing)',
 'Real output per hour, manufacturing sector. Compared against the nonfarm aggregate, isolates whether productivity gains concentrate in goods-producing industries.',
 'adoption', 'index', 'quarterly', 'official',
 'index_2017=100', NULL, 1, 'fred', 'OPHMFG',
 'https://fred.stlouisfed.org/series/OPHMFG',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '1 day'),

('fred.ULCNFB',
 'US Unit Labour Costs (Nonfarm Business)',
 'Labour cost per unit of output. Falling unit labour costs alongside stable wages is the signature of genuine productivity growth rather than wage suppression.',
 'adoption', 'index', 'quarterly', 'official',
 'index_2017=100', NULL, 1, 'fred', 'ULCNFB',
 'https://fred.stlouisfed.org/series/ULCNFB',
 FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day'),

('fred.PAYEMS',
 'US Total Nonfarm Employment',
 'All employees, total nonfarm payrolls. The denominator for revenue-per-employee analysis and the baseline against which AI-attributed displacement is measured.',
 'adoption', 'count', 'monthly', 'official',
 'thousands_of_persons', NULL, 0, 'fred', 'PAYEMS',
 'https://fred.stlouisfed.org/series/PAYEMS',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '1 day'),

-- VERIFIED 2026-08-24 against the live FRED API. The previous code
-- CES5000000001 is a BLS series id; FRED does not expose it under that name and
-- returned 400. FRED's seasonally-adjusted alias is USINFO, which matches the
-- adjustment basis of PAYEMS above — mixing adjusted and unadjusted series in
-- one chart produces a sawtooth that reads as signal.
('fred.USINFO',
 'US Employment: Information Sector',
 'All employees in the information supersector — the industry most directly exposed to both AI supply and AI substitution.',
 'adoption', 'count', 'monthly', 'official',
 'thousands_of_persons', NULL, 0, 'fred', 'USINFO',
 'https://fred.stlouisfed.org/series/USINFO',
 NULL, TRUE, TRUE, FALSE, INTERVAL '1 day'),

('fred.INDPRO',
 'US Industrial Production Index',
 'Real output of manufacturing, mining and utilities. Included partly because data centre electricity demand is beginning to register in utilities output.',
 'adoption', 'index', 'monthly', 'official',
 'index_2017=100', NULL, 1, 'fred', 'INDPRO',
 'https://fred.stlouisfed.org/series/INDPRO',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '1 day'),

('fred.GDPC1',
 'US Real GDP',
 'Real gross domestic product, chained 2017 dollars. Context series — the denominator for AI investment as a share of the economy.',
 'adoption', 'currency', 'quarterly', 'official',
 'billions_of_chained_2017_usd', '$', 1, 'fred', 'GDPC1',
 'https://fred.stlouisfed.org/series/GDPC1',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '1 day'),

-- [UNVERIFIED] Penn World Table series codes are long and easily mistyped.
--
-- BASE YEAR CORRECTED 2026-09-03. This carried 'index_2017=1' from the day it
-- was added. The series says otherwise: 2021 is exactly 1.000000 and 2017 is
-- 0.953378. FRED serves the Penn World Table 10.01 series rebased to 2021 = 1.
--
--   select to_char(period_start,'YYYY'), value from observations
--    where indicator_id = 'fred.RTFPNAUSA632NRUG' and period_start >= '2015-01-01';
--   → 2017 0.953378140926361 … 2021 1 … 2023 0.992998480796814
--
-- An index is meaningless without its base, and `displayUnit()` puts this
-- string on the axis verbatim, so the wrong base was being read by anyone
-- looking at the chart: told 2017 = 1, a reader takes 0.993 in 2023 for a fall
-- when it is 4.2% ABOVE 2017 and 0.7% below 2021. `check:data` now asserts the
-- base for every indicator whose unit names one.
('fred.RTFPNAUSA632NRUG',
 'US Total Factor Productivity',
 'Total factor productivity at constant national prices. TFP is the residual after accounting for labour and capital inputs — conceptually the closest thing economics has to "technological progress", and therefore the series where a genuine AI effect should eventually appear.',
 'adoption', 'index', 'annual', 'official',
 'index_2021=1', NULL, 3, 'fred', 'RTFPNAUSA632NRUG',
 'https://fred.stlouisfed.org/series/RTFPNAUSA632NRUG',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '7 days'),

-- ─────────────────────────────────────────────────────────────────────────────
-- PILLAR: ADOPTION — cross-country context (World Bank, keyless)
-- ─────────────────────────────────────────────────────────────────────────────

('wb.NY.GDP.PCAP.KD',
 'GDP per Capita (constant 2015 USD)',
 'Real GDP per head. The standard control variable when comparing AI adoption across countries at different development levels.',
 'adoption', 'currency', 'annual', 'official',
 'constant_2015_usd', '$', 0, 'worldbank', 'NY.GDP.PCAP.KD',
 'https://data.worldbank.org/indicator/NY.GDP.PCAP.KD',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '7 days'),

('wb.GB.XPD.RSDV.GD.ZS',
 'R&D Expenditure (% of GDP)',
 'Gross domestic spending on research and development as a share of GDP. The best available proxy for a country''s structural capacity to absorb and produce AI technology.',
 'adoption', 'rate', 'annual', 'official',
 'percent_of_gdp', '%', 2, 'worldbank', 'GB.XPD.RSDV.GD.ZS',
 'https://data.worldbank.org/indicator/GB.XPD.RSDV.GD.ZS',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '7 days'),

('wb.NY.GDP.MKTP.KD.ZG',
 'GDP Growth (annual %)',
 'Annual percentage growth of real GDP. A change-type series, so it renders on a diverging palette — negative growth must be visually distinct from positive.',
 'adoption', 'change', 'annual', 'official',
 'percent', '%', 2, 'worldbank', 'NY.GDP.MKTP.KD.ZG',
 'https://data.worldbank.org/indicator/NY.GDP.MKTP.KD.ZG',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '7 days'),

('wb.SL.UEM.TOTL.ZS',
 'Unemployment Rate',
 'Unemployment as a share of total labour force (ILO modelled estimate). Tracked against AI adoption to test displacement claims — noting that aggregate unemployment is a blunt instrument for detecting task-level substitution.',
 'adoption', 'rate', 'annual', 'official',
 'percent', '%', 1, 'worldbank', 'SL.UEM.TOTL.ZS',
 'https://data.worldbank.org/indicator/SL.UEM.TOTL.ZS',
 FALSE, TRUE, FALSE, FALSE, INTERVAL '7 days'),

('wb.IT.NET.USER.ZS',
 'Individuals Using the Internet (%)',
 'Share of population using the internet. Baseline digital infrastructure — a country cannot adopt AI faster than it is connected.',
 'adoption', 'rate', 'annual', 'official',
 'percent', '%', 1, 'worldbank', 'IT.NET.USER.ZS',
 'https://data.worldbank.org/indicator/IT.NET.USER.ZS',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '7 days'),

-- [UNVERIFIED] This series has had coverage gaps in recent World Bank releases.
('wb.TX.VAL.TECH.MF.ZS',
 'High-Technology Exports (% of manufactured exports)',
 'High-technology exports as a share of manufactured exports. A structural indicator of where advanced-technology production actually sits.',
 'adoption', 'rate', 'annual', 'official',
 'percent', '%', 1, 'worldbank', 'TX.VAL.TECH.MF.ZS',
 'https://data.worldbank.org/indicator/TX.VAL.TECH.MF.ZS',
 TRUE, TRUE, FALSE, FALSE, INTERVAL '7 days'),

-- ─────────────────────────────────────────────────────────────────────────────
-- PILLAR: INFRASTRUCTURE — the physical AI buildout
--
-- Sourced primarily from Epoch AI (CC BY 4.0), which publishes the only
-- credible open structured data on AI compute. Values here are counts and
-- capacities derived from their datasets, not estimates of our own.
-- ─────────────────────────────────────────────────────────────────────────────

('epoch.training_compute_frontier',
 'Frontier Model Training Compute',
 'Estimated training compute of the largest known AI model, in floating-point operations. The single best measure of the capital intensity of frontier AI development, and the driver behind data centre demand.',
 'infrastructure', 'magnitude', 'irregular', 'survey',
 'flop', NULL, 2, 'epoch_ai', 'notable_ai_models',
 'https://epoch.ai/data',
 NULL, FALSE, FALSE, FALSE, INTERVAL '7 days'),

('epoch.gpu_cluster_count',
 'Known Large GPU Clusters',
 'Count of publicly documented large-scale GPU clusters. Undercounts by construction — many clusters are undisclosed — so it is a lower bound on real capacity, not a census.',
 'infrastructure', 'count', 'irregular', 'survey',
 'clusters', NULL, 0, 'epoch_ai', 'gpu_clusters',
 'https://epoch.ai/data',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days'),

-- CADENCE CORRECTED 2026-09-03: was 'monthly'. The register aggregates to one
-- point per country per year — the modal gap between consecutive non-null
-- observations is 365 days over 160 gaps — and this is the hero series on
-- `building`, so a reader was told to expect twelve points a year on a chart
-- that has one. Measured by the cadence check in scripts/check-data.js.
('derived.datacentre_capacity_mw',
 'Announced Data Centre Capacity',
 'Sum of announced and operational data centre capacity in megawatts, aggregated from the assets table. Megawatts rather than floor area because power is the binding constraint on AI compute and the link to energy economics.',
 'infrastructure', 'magnitude', 'annual', 'derived',
 'megawatts', 'MW', 0, 'epoch_ai', NULL,
 NULL,
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day'),

('derived.datacentre_investment',
 'Announced Data Centre Investment',
 'Sum of announced capital investment in data centre projects. Derived from the assets table, which is largely news-sourced — treat as directional, not audited.',
 'infrastructure', 'currency', 'monthly', 'news_derived',
 'usd', '$', 0, 'epoch_ai', NULL,
 NULL,
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day'),

-- ─────────────────────────────────────────────────────────────────────────────
-- PILLAR: POLICY — government stance
--
-- Every indicator here is derived from classification of government text and
-- carries confidence_tier = 'news_derived'. The UI must render these visually
-- distinct from official statistics. They are the opinion of a model about a
-- document, not a measurement.
-- ─────────────────────────────────────────────────────────────────────────────

('derived.policy_investment_stance',
 'Government AI Investment Stance',
 'Rolling mean investment score (-100 to +100) from classified government communications. Derived from LLM classification of official press releases; every point traces to a document with a verbatim evidence quote.',
 'policy', 'change', 'monthly', 'news_derived',
 'score_-100_to_100', NULL, 0, 'federal_register', NULL,
 NULL,
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day'),

('derived.policy_regulation_stance',
 'Government AI Regulation Stance',
 'Rolling mean regulation score (-100 to +100) from classified government communications. Deliberately independent of investment stance — a government can be simultaneously pro-investment and pro-regulation, and collapsing that into one axis destroys the most interesting signal in the dataset.',
 'policy', 'change', 'monthly', 'news_derived',
 'score_-100_to_100', NULL, 0, 'federal_register', NULL,
 NULL,
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day'),

('derived.ai_regulation_volume',
 'AI Regulatory Documents Published',
 'Count of Federal Register documents matching AI-related terms. A volume measure of regulatory activity, making no claim about the direction or severity of that activity.',
 'policy', 'count', 'monthly', 'official',
 'documents', NULL, 0, 'federal_register', NULL,
 'https://www.federalregister.gov',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day'),

-- ─────────────────────────────────────────────────────────────────────────────
-- PILLAR: EFFECTS — corporate and market signals
-- ─────────────────────────────────────────────────────────────────────────────

-- CADENCE CORRECTED 2026-09-03: was 'quarterly'. It scans ANNUAL filings and
-- stores one point a year — modal gap 365 days over 11 gaps — and it is the
-- hero series on `adoption`, where "quarterly" promised four points a year on
-- a chart that has one.
('derived.sec_ai_mention_rate',
 'Share of Filings Mentioning AI',
 'Percentage of scanned SEC annual filings containing AI-related terms. IMPORTANT: this measures discussion, not spending. Companies do not tag AI capital expenditure as a distinct accounting line, so no dollar figure can be derived from filings — treat this as an attention proxy only.',
 'effects', 'rate', 'annual', 'derived',
 'percent', '%', 1, 'sec_edgar', NULL,
 'https://efts.sec.gov',
 NULL, FALSE, TRUE, FALSE, INTERVAL '7 days'),

-- CADENCE CORRECTED 2026-09-03: was 'daily', which was the ingestion interval
-- rather than the grain of what is stored. Every row spans a calendar month
-- (period_start to period_end), the modal gap is 31 days over 115 gaps, seed
-- 033 describes the series as "116 monthly observations" and the caption it
-- placed on `productivity` says "monthly". The metadata was the only thing
-- still saying daily.
('derived.ai_news_volume',
 'AI Economic News Volume',
 'Share of worldwide news coverage matching an AI-economics query, from GDELT''s index of global media. A measure of ATTENTION, included as a deliberate contrast to the hard indicators — divergence between attention and measured productivity is itself the finding. Expressed as a share of all monitored coverage rather than a raw count, so it cannot rise merely because GDELT indexed more outlets.',
 'effects', 'count', 'monthly', 'news_derived',
 'articles', NULL, 0, 'gdelt', NULL,
 NULL,
 NULL, TRUE, TRUE, FALSE, INTERVAL '1 hour')

ON CONFLICT (id) DO UPDATE SET
  name               = EXCLUDED.name,
  description        = EXCLUDED.description,
  pillar             = EXCLUDED.pillar,
  quantity_kind      = EXCLUDED.quantity_kind,
  cadence            = EXCLUDED.cadence,
  confidence_tier    = EXCLUDED.confidence_tier,
  unit               = EXCLUDED.unit,
  unit_symbol        = EXCLUDED.unit_symbol,
  decimals           = EXCLUDED.decimals,
  source_id          = EXCLUDED.source_id,
  source_series_code = EXCLUDED.source_series_code,
  source_url         = EXCLUDED.source_url,
  higher_is_better   = EXCLUDED.higher_is_better,
  has_country_dim    = EXCLUDED.has_country_dim,
  has_industry_dim   = EXCLUDED.has_industry_dim,
  has_company_dim    = EXCLUDED.has_company_dim,
  refresh_interval   = EXCLUDED.refresh_interval,
  updated_at         = now();
