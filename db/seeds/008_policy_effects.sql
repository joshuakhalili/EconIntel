-- ============================================================================
-- 008_policy_effects.sql — filling out the two thin pillars
--
-- Policy held one populated indicator and effects four. Both were thin for the
-- same reason: the remaining slots needed an LLM to classify documents, which
-- is not yet configured. What follows is everything measurable WITHOUT one.
--
-- The move is to split counts that were already being collected but thrown
-- together. That is not a workaround — it is a better measurement. Lumping
-- every Federal Register document into one "regulatory activity" line treats
-- an executive order, a draft open for comment, and enforceable law as the
-- same event, when the whole question of policy is which of those a government
-- has actually done.
-- ============================================================================

-- ── Fix: SEC mention rate writes USA but was declared country-less ──────────
-- The observation grain includes country, and upsertObservations rejects a
-- country on an indicator that does not declare the dimension. SEC filings are
-- US-only by definition, so the declaration was simply wrong.
UPDATE indicators
   SET has_country_dim = TRUE,
       default_country_iso3 = 'USA',
       updated_at = now()
 WHERE id = 'derived.sec_ai_mention_rate';

-- ── Retire: a derived proxy where a measured series now exists ──────────────
-- derived.datacentre_investment was defined when no source was known. One has
-- since been found and seeded: BEA NIPA table 5.4.5 line LA001282-A, US private
-- fixed investment in data centre STRUCTURES, published by the Bureau of
-- Economic Analysis. An inferred proxy standing next to the real measurement
-- would invite the reader to treat two different things as corroboration.
UPDATE indicators SET is_active = FALSE, updated_at = now()
 WHERE id = 'derived.datacentre_investment';


-- ---------------------------------------------------------------------------
-- New policy indicators, from documents already being ingested.
-- ---------------------------------------------------------------------------
INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval, default_country_iso3
) VALUES

('derived.ai_binding_rules',
 'US AI Rules in Force',
 'Federal Register documents of type "Rule" mentioning AI — regulation that is already law and enforceable, as distinct from proposals that may never take effect. This is the only one of the three policy counts that represents an obligation on anyone.',
 'policy', 'count', 'monthly', 'official',
 'documents per month', NULL, 0, 'federal_register', NULL,
 'https://www.federalregister.gov',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('derived.ai_proposed_rules',
 'US AI Rules Proposed',
 'Federal Register documents of type "Proposed Rule" mentioning AI. Proposals carry a public comment period and typically precede a binding rule by 12 to 24 months, if they convert at all — so this leads the series above, and the gap between them measures how much announced intent becomes actual obligation.',
 'policy', 'count', 'monthly', 'official',
 'documents per month', NULL, 0, 'federal_register', NULL,
 'https://www.federalregister.gov',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('derived.ai_presidential_documents',
 'US AI Executive Actions',
 'Executive orders and presidential memoranda mentioning AI. These move far faster than rulemaking — days rather than years — and are as easily reversed by a successor, which makes them a measure of political attention rather than of durable policy.',
 'policy', 'count', 'monthly', 'official',
 'documents per month', NULL, 0, 'federal_register', NULL,
 'https://www.federalregister.gov',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

-- ---------------------------------------------------------------------------
-- New effects indicators, computed from data already held.
--
-- Both are RATIOS between an AI-exposed group and the whole economy. A single
-- series cannot separate an AI effect from a recession, an interest-rate move
-- or a pandemic recovery, because all of those hit every series at once. A
-- ratio cancels whatever the two share, leaving what is different about the
-- exposed group — which is as close to a causal reading as observational data
-- allows.
-- ---------------------------------------------------------------------------
('derived.information_employment_share',
 'US Information-Sector Share of Employment',
 'Jobs in the information sector as a percentage of all US non-farm employment. The information sector is the most AI-exposed part of the economy, and total employment is the control: both fall in a recession, so a divergence between them is attributable to something specific to information work rather than to the business cycle.',
 'effects', 'rate', 'monthly', 'derived',
 'percent of total employment', '%', 3, 'fred', NULL,
 'https://fred.stlouisfed.org/series/USINFO',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('derived.productivity_gap_mfg_vs_total',
 'US Productivity Gap: Manufacturing vs Whole Economy',
 'Manufacturing labour productivity divided by non-farm business productivity, indexed so 100 means the two are moving together. Differential effects appear long before aggregate ones: if AI raises output per hour unevenly across sectors, this separates before headline productivity moves at all.',
 'effects', 'index', 'quarterly', 'derived',
 'ratio, 1990=100', NULL, 2, 'fred', NULL,
 'https://fred.stlouisfed.org/series/OPHMFG',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  pillar = EXCLUDED.pillar, unit = EXCLUDED.unit,
  has_country_dim = EXCLUDED.has_country_dim,
  default_country_iso3 = EXCLUDED.default_country_iso3,
  is_active = TRUE, updated_at = now();
