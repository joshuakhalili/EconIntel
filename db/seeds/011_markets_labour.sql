-- ============================================================================
-- 011_markets_labour.sql — the finance layer, and labour depth
--
-- Two gaps closed. Every code below was fetched and confirmed returning real
-- observations on 2026-08-25.
--
-- ON COMMODITY SOURCES. FRED carries copper, aluminium, nickel, oil and gas,
-- all current. It carries no silver and no lithium. The IMF's Primary Commodity
-- Price System does carry silver, lithium and cobalt — but its DBnomics mirror
-- last updated in June 2025 across every series, so those are marked as such
-- rather than presented as live. Gold and silver come from LBMA's own daily
-- JSON instead: free, no key, 1968 to yesterday.
--
-- WHY THESE METALS ARE ON AN AI DASHBOARD. Not as a markets ticker for its own
-- sake. Copper is the wiring and transformers of a data centre; aluminium the
-- racks and heat sinks; silver the most conductive metal in commercial use and
-- in every circuit board; nickel and cobalt the batteries in the backup power;
-- lithium the same; uranium and gas what actually runs the site. Each is a
-- physical input to AI capacity, and their prices are the cost floor under it.
-- ============================================================================

-- The LBMA source row must exist before any indicator references it.
INSERT INTO sources (id, name, homepage_url, api_base_url, licence, attribution_text, credibility, requires_key, notes)
VALUES ('lbma', 'London Bullion Market Association', 'https://www.lbma.org.uk',
        'https://prices.lbma.org.uk/json', 'Free for non-commercial use with attribution',
        'Precious metal prices © LBMA', 9, FALSE,
        'Daily benchmark fixes as JSON, no key. Back to 1968. Used because FRED has no silver series and the IMF mirror is stale.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, notes = EXCLUDED.notes;


INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval, default_country_iso3
) VALUES

-- ── Precious metals, LBMA daily ─────────────────────────────────────────────
('lbma.gold', 'Gold Price',
 'The London benchmark gold price, set twice daily since 1968. Gold is used in chip bonding wire, and is the standard gauge of whether investors are nervous — which is exactly what you want beside a chart of an investment boom.',
 'effects', 'currency', 'daily', 'official',
 'USD per troy ounce', '$', 2, 'lbma', 'gold',
 'https://prices.lbma.org.uk', NULL, FALSE, FALSE, FALSE, INTERVAL '1 day', NULL),

('lbma.silver', 'Silver Price',
 'The London benchmark silver price. Silver is the most electrically conductive metal in commercial use: it is in the circuit boards, connectors and solar panels that AI infrastructure is built from, so its price is a direct input cost.',
 'effects', 'currency', 'daily', 'official',
 'USD per troy ounce', '$', 2, 'lbma', 'silver',
 'https://prices.lbma.org.uk', NULL, FALSE, FALSE, FALSE, INTERVAL '1 day', NULL),

-- ── Industrial metals and energy, FRED ──────────────────────────────────────
('fred.PCOPPUSDM', 'Copper Price',
 'The global copper price. A large data centre needs thousands of tonnes of copper for wiring, busbars and transformers, which is why grid-scale build-outs move this market.',
 'effects', 'currency', 'monthly', 'official',
 'USD per tonne', '$', 0, 'fred', 'PCOPPUSDM',
 'https://fred.stlouisfed.org/series/PCOPPUSDM', NULL, FALSE, FALSE, FALSE, INTERVAL '1 day', NULL),

('fred.PALUMUSDM', 'Aluminium Price',
 'Aluminium — server racks, chassis and heat sinks. Cheaper and lighter than copper, and used wherever conductivity is not the binding requirement.',
 'effects', 'currency', 'monthly', 'official',
 'USD per tonne', '$', 0, 'fred', 'PALUMUSDM',
 'https://fred.stlouisfed.org/series/PALUMUSDM', NULL, FALSE, FALSE, FALSE, INTERVAL '1 day', NULL),

('fred.PNICKUSDM', 'Nickel Price',
 'Nickel, used in the batteries that keep a data centre running through a power cut, and in the stainless steel of its cooling systems.',
 'effects', 'currency', 'monthly', 'official',
 'USD per tonne', '$', 0, 'fred', 'PNICKUSDM',
 'https://fred.stlouisfed.org/series/PNICKUSDM', NULL, FALSE, FALSE, FALSE, INTERVAL '1 day', NULL),

('fred.DCOILWTICO', 'Crude Oil Price',
 'West Texas Intermediate crude, daily. The broadest available gauge of what energy costs, which sets the floor under the price of running anything.',
 'effects', 'currency', 'daily', 'official',
 'USD per barrel', '$', 2, 'fred', 'DCOILWTICO',
 'https://fred.stlouisfed.org/series/DCOILWTICO', NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('fred.DHHNGSP', 'Natural Gas Price',
 'Henry Hub natural gas, daily. Gas generates most of the marginal electricity a new American data centre draws, so this is close to the direct fuel cost of AI compute.',
 'effects', 'currency', 'daily', 'official',
 'USD per million BTU', '$', 2, 'fred', 'DHHNGSP',
 'https://fred.stlouisfed.org/series/DHHNGSP', NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('fred.PALLFNFINDEXM', 'All Commodities Price Index',
 'Every major traded commodity in one index. Included so a move in copper or silver can be read against raw materials generally, rather than mistaken for something specific to AI.',
 'effects', 'index', 'monthly', 'official',
 'index 2016=100', NULL, 1, 'fred', 'PALLFNFINDEXM',
 'https://fred.stlouisfed.org/series/PALLFNFINDEXM', NULL, FALSE, FALSE, FALSE, INTERVAL '1 day', NULL),

('fred.SPASTT01USM661N', 'US Share Prices',
 'The broad US share price index. Included because it is published by the OECD through FRED under a licence that permits public redisplay — most market data does not.',
 'effects', 'index', 'monthly', 'official',
 'index 2015=100', NULL, 1, 'fred', 'SPASTT01USM661N',
 'https://fred.stlouisfed.org/series/SPASTT01USM661N', NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

-- ── Battery and specialist metals, IMF via DBnomics. STALE — see header. ────
('dbn.IMF.PCPS.lithium', 'Lithium Price',
 'Lithium, for the backup batteries every data centre needs. NOTE: the only free source for this is the IMF commodity system, whose mirror has not updated since June 2025 — the trend to that point is real, the last year is missing.',
 'effects', 'currency', 'monthly', 'official',
 'USD per tonne', '$', 0, 'dbnomics', 'IMF/PCPS/M.W00.PLITH.USD',
 'https://db.nomics.world/IMF/PCPS/M.W00.PLITH.USD', NULL, FALSE, FALSE, FALSE, INTERVAL '7 days', NULL),

('dbn.IMF.PCPS.cobalt', 'Cobalt Price',
 'Cobalt, the other main battery metal, and among the most supply-constrained commodities there is. Same staleness caveat as lithium: free data stops at June 2025.',
 'effects', 'currency', 'monthly', 'official',
 'USD per tonne', '$', 0, 'dbnomics', 'IMF/PCPS/M.W00.PCOBA.USD',
 'https://db.nomics.world/IMF/PCPS/M.W00.PCOBA.USD', NULL, FALSE, FALSE, FALSE, INTERVAL '7 days', NULL),

('dbn.IMF.PCPS.uranium', 'Uranium Price',
 'Uranium. Several of the largest AI companies have signed nuclear power agreements, so the fuel price is now part of the cost of compute. Stale after June 2025.',
 'effects', 'currency', 'monthly', 'official',
 'USD per pound', '$', 2, 'dbnomics', 'IMF/PCPS/M.W00.PURAN.USD',
 'https://db.nomics.world/IMF/PCPS/M.W00.PURAN.USD', NULL, FALSE, FALSE, FALSE, INTERVAL '7 days', NULL),

-- ── Youth unemployment. The entry-level canary, eight countries. ────────────
-- OECD harmonised rates, so the definition is the same in each — which is what
-- makes them comparable on one axis rather than merely adjacent.
('fred.LNS14024887', 'US Youth Unemployment (16–24)',
 'The share of young Americans looking for work and not finding it. If AI substitutes entry-level tasks first — the junior analyst, the first-year paralegal — this is where it appears before anywhere else.',
 'effects', 'rate', 'monthly', 'official',
 'percent', '%', 1, 'fred', 'LNS14024887',
 'https://fred.stlouisfed.org/series/LNS14024887', FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('fred.LRHU24TTGBM156S', 'UK Youth Unemployment (15–24)',
 'The same measure for Britain.',
 'effects', 'rate', 'monthly', 'official',
 'percent', '%', 1, 'fred', 'LRHU24TTGBM156S',
 'https://fred.stlouisfed.org/series/LRHU24TTGBM156S', FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day', 'GBR'),

('fred.LRHU24TTDEM156S', 'German Youth Unemployment (15–24)',
 'Germany, whose apprenticeship system usually keeps this figure among the lowest in Europe.',
 'effects', 'rate', 'monthly', 'official',
 'percent', '%', 1, 'fred', 'LRHU24TTDEM156S',
 'https://fred.stlouisfed.org/series/LRHU24TTDEM156S', FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day', 'DEU'),

('fred.LRHU24TTFRM156S', 'French Youth Unemployment (15–24)',
 'France, which has run persistently high youth unemployment for decades — a useful reminder that this series moves for many reasons besides technology.',
 'effects', 'rate', 'monthly', 'official',
 'percent', '%', 1, 'fred', 'LRHU24TTFRM156S',
 'https://fred.stlouisfed.org/series/LRHU24TTFRM156S', FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day', 'FRA'),

('fred.LRHU24TTJPM156S', 'Japanese Youth Unemployment (15–24)',
 'Japan, where a shrinking workforce means employers compete for young workers rather than the reverse.',
 'effects', 'rate', 'monthly', 'official',
 'percent', '%', 1, 'fred', 'LRHU24TTJPM156S',
 'https://fred.stlouisfed.org/series/LRHU24TTJPM156S', FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day', 'JPN'),

('fred.LRHU24TTKRM156S', 'Korean Youth Unemployment (15–24)',
 'South Korea — the country with the highest measured enterprise AI adoption anywhere, which makes its youth labour market the most informative single case here.',
 'effects', 'rate', 'monthly', 'official',
 'percent', '%', 1, 'fred', 'LRHU24TTKRM156S',
 'https://fred.stlouisfed.org/series/LRHU24TTKRM156S', FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day', 'KOR'),

('fred.LRHU24TTCAM156S', 'Canadian Youth Unemployment (15–24)',
 'Canada.',
 'effects', 'rate', 'monthly', 'official',
 'percent', '%', 1, 'fred', 'LRHU24TTCAM156S',
 'https://fred.stlouisfed.org/series/LRHU24TTCAM156S', FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day', 'CAN'),

('fred.LRHU24TTAUM156S', 'Australian Youth Unemployment (15–24)',
 'Australia.',
 'effects', 'rate', 'monthly', 'official',
 'percent', '%', 1, 'fred', 'LRHU24TTAUM156S',
 'https://fred.stlouisfed.org/series/LRHU24TTAUM156S', FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day', 'AUS'),

-- ── Graduates and clerical work ─────────────────────────────────────────────
('fred.CGBD2534', 'US Graduate Unemployment (25–34, degree)',
 'Unemployment among young American graduates. Separated from overall youth unemployment because a degree is exactly the credential that was supposed to protect against automation.',
 'effects', 'rate', 'monthly', 'official',
 'percent', '%', 1, 'fred', 'CGBD2534',
 'https://fred.stlouisfed.org/series/CGBD2534', FALSE, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('fred.LNU02032207', 'US Office and Administrative Employment',
 'Americans employed in office and administrative support work. This is the largest occupational group most directly exposed to language models, and it is measured monthly rather than annually.',
 'effects', 'count', 'monthly', 'official',
 'thousands of persons', NULL, 0, 'fred', 'LNU02032207',
 'https://fred.stlouisfed.org/series/LNU02032207', NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  unit = EXCLUDED.unit, source_series_code = EXCLUDED.source_series_code,
  source_url = EXCLUDED.source_url, default_country_iso3 = EXCLUDED.default_country_iso3,
  is_active = TRUE, updated_at = now();
