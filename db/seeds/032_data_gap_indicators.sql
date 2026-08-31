-- ============================================================================
-- 032_data_gap_indicators.sql — the four gaps named by the 2026-08-30 research
--
-- Source: docs/research/blocked-questions-2026-08-30-verdicts.md, final section
-- ("Data this research says is worth ingesting, and is not yet").
--
-- Every series code below was fetched and confirmed to return real observations
-- on 2026-08-31, before being written here. That is the standing rule in
-- 006_global_indicators.sql and it earned its keep again: the research named
-- NAICS 5112 and 5182, and BOTH are dead codes. The 2022 NAICS revision moved
-- software publishers to 5132 and folded data processing and hosting into 518,
-- so CES5051120001 and CES5051820001 return nothing at all. Seeding the codes
-- as written would have produced two permanently empty charts that read as
-- "no data" rather than "wrong code".
--
-- Census VIP computer-and-electronic-products is deliberately absent. The
-- research could not confirm its sector code and `the-buildings` stays off
-- until someone does; guessing at it is exactly the failure above.
-- ============================================================================

INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval, default_country_iso3
) VALUES

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Quality-adjusted compute price — the counterweight to a flat nominal PPI
--
-- READ src/server/ingestion/sources/epoch.js BEFORE USING THIS. The adapter
-- carries three limits in full, and they bound what may be claimed from it.
-- The short form is in the description below and none of it is optional.
-- ─────────────────────────────────────────────────────────────────────────────

('epoch.gpu_price_performance',
 'Best ML Hardware Price-Performance Achieved',
 'Highest FLOP/s per dollar reached by any accelerator in Epoch AI''s hardware register, as a running maximum. Placed against the semiconductor PPI, which has been flat since roughly 2021: that index prices a CHIP, this prices a unit of COMPUTATION, and the gap between them is the measurement problem the chip-prices page describes. THREE LIMITS, all load-bearing. (1) It is a frontier, not an index — the register is a convenience sample of notable hardware, so any average or per-year maximum over it moves with which chips Epoch recorded rather than with prices; a running maximum can only understate, never invent a price rise. (2) The 14x step in September 2018 is partly a change of measurement: Epoch takes each chip at the precision it is fastest at, and that basis moved from FP32 to tensor FP16 with the RTX 2080 Ti. (3) It has been FLAT since September 2022, when a consumer RTX 4090 set the record no sampled accelerator has beaten. So this shows a roughly 430x improvement from 2008 to 2022 against a barely-moving PPI, and then a gap — it does NOT on its own show quality-adjusted prices still falling through the 2020s. Nobody publishes the precision- and population-consistent index that would.',
 'infrastructure', 'magnitude', 'irregular', 'survey',
 'FLOP/s per US dollar', NULL, 0, 'epoch_ai', 'ml_hardware',
 'https://epoch.ai/data/machine-learning-hardware',
 TRUE, FALSE, FALSE, FALSE, INTERVAL '7 days', NULL),

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CES subsector employment — splitting the AI-intensive part out of
--    "information", which is the aggregate fred.USINFO already tracks.
--
-- The two series come from different mirrors, deliberately, and end 19 months
-- apart as a result. FRED carries 518 and is current; it does not carry the
-- software-publishers series under any identifier (checked directly and by
-- search on 2026-08-31), so that one can only come from DBnomics, whose entire
-- BLS mirror is frozen at January 2025 — total nonfarm stops there too, so it
-- is the mirror, not the series. Taking 518 from the stale mirror as well would
-- have bought a matching end date by throwing away 19 months of real data, and
-- FRED also matches the vintage and adjustment basis of fred.USINFO, which is
-- the aggregate these two sit inside.
-- ─────────────────────────────────────────────────────────────────────────────

('dbn.BLS.ce.CES5051320001',
 'US Employment: Software Publishers (NAICS 5132)',
 'All employees, software publishers, seasonally adjusted. The most AI-exposed subsector of the information supersector, separated from the broadcasting and telecoms lines that move for unrelated reasons. Employment ran 93k in 1990 and 656k at the end of 2024, and the 2022-24 plateau inside that climb is the period the sector-jobs question argues about. NAICS 5132, not the 5112 that older sources cite: the 2022 NAICS revision renumbered software publishers and the old code returns nothing. ENDS DECEMBER 2024 — DBnomics'' BLS mirror is frozen at January 2025 across every BLS series, and FRED carries no equivalent, so there is no fresher route to this subsector today.',
 'adoption', 'count', 'monthly', 'official',
 'Thousands of persons', NULL, 1, 'dbnomics', 'BLS/ce/CES5051320001',
 'https://db.nomics.world/BLS/ce/CES5051320001',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('fred.CES5051800001',
 'US Employment: Computing Infrastructure, Data Processing and Hosting (NAICS 518)',
 'All employees in computing infrastructure providers, data processing and web hosting, seasonally adjusted. The cloud and data-centre operations subsector — the part of the information supersector that AI capex should be ADDING jobs to, read against software publishers where it may be removing them. NAICS 518 under the 2022 revision, which absorbed the old 5182. Same source and vintage as fred.USINFO, the aggregate it sits inside.',
 'adoption', 'count', 'monthly', 'official',
 'Thousands of persons', NULL, 1, 'fred', 'CES5051800001',
 'https://fred.stlouisfed.org/series/CES5051800001',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. JOLTS information-sector flows — firing, or a hiring freeze?
--
-- A falling headcount is a NET number and cannot distinguish the two. These
-- three separate it: quits are workers leaving voluntarily, hires are the gross
-- inflow, openings are demand that has not been filled. A fall in employment
-- driven by collapsing hires while quits also fall is a freeze; one driven by
-- separations outrunning steady hiring is not.
--
-- Seasonally adjusted, from DBnomics, and therefore ending December 2024. FRED
-- has these fresher (to June 2026) but only NOT seasonally adjusted, and raw
-- monthly flow levels swing hard enough on seasonality to bury the turning
-- points these series exist to show. The 2022-24 correction — the actual
-- subject of the sector-jobs question — is inside the adjusted window.
-- ─────────────────────────────────────────────────────────────────────────────

('dbn.BLS.jt.JTS510000000000000JOL',
 'US Job Openings: Information Sector',
 'Unfilled positions in the information supersector, seasonally adjusted, monthly from December 2000. Openings measure DEMAND rather than headcount, so they turn before employment does. Read beside hires: openings that stay high while hires fall means unfilled demand, openings that fall with hires means withdrawn demand. Industry-level JOLTS is a small sample and genuinely noisy month to month — single-month moves of 40% appear in the published series and are not errors. Ends December 2024; DBnomics'' BLS mirror is frozen at early 2025.',
 'adoption', 'count', 'monthly', 'official',
 'Thousands of positions', NULL, 0, 'dbnomics', 'BLS/jt/JTS510000000000000JOL',
 'https://db.nomics.world/BLS/jt/JTS510000000000000JOL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('dbn.BLS.jt.JTS510000000000000HIL',
 'US Hires: Information Sector',
 'Gross monthly hires into the information supersector, seasonally adjusted. The direct test of the hiring-freeze hypothesis: if information employment is falling because firms stopped recruiting rather than because they cut staff, it shows here as a fall in hires without a matching rise in separations. Ends December 2024; DBnomics'' BLS mirror is frozen at early 2025.',
 'adoption', 'count', 'monthly', 'official',
 'Thousands of hires', NULL, 0, 'dbnomics', 'BLS/jt/JTS510000000000000HIL',
 'https://db.nomics.world/BLS/jt/JTS510000000000000HIL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('dbn.BLS.jt.JTS510000000000000QUL',
 'US Quits: Information Sector',
 'Workers leaving information-sector jobs voluntarily each month, seasonally adjusted. The confidence measure in the trio — quits rise when workers believe another job is available and fall when they do not, so a falling quit rate alongside falling employment points at a frozen market rather than a purge. Ends December 2024; DBnomics'' BLS mirror is frozen at early 2025.',
 'adoption', 'count', 'monthly', 'official',
 'Thousands of quits', NULL, 0, 'dbnomics', 'BLS/jt/JTS510000000000000QUL',
 'https://db.nomics.world/BLS/jt/JTS510000000000000QUL',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. BEA software investment, split three ways
--
-- The software-not-steel caveat says own-account software is a substantial
-- minority of the total and is estimated from programmer wages rather than
-- observed in any transaction. These three lines put the number on it. They sum
-- to dbn.BEA.NIPA-T50605.B985RC-A, already held: 334,591 + 261,038 + 97,368 =
-- 692,997 against a published total of 692,996 for 2024, the rounding of a
-- table published to whole millions.
--
-- On that arithmetic, own-account was 14.1% of US software investment in 2024
-- — the low end of the 15-25% the research quoted, and down from 47% in 1985.
-- ─────────────────────────────────────────────────────────────────────────────

('dbn.BEA.NIPA-T50605.Y003RC-A',
 'US Private Fixed Investment in Prepackaged Software',
 'Off-the-shelf software bought by US business, from NIPA table 5.6.5, annual. The cleanest of the three components: it is an observed market transaction at an observed price, which neither of the others is. $334.6bn in 2024 against $4.9bn in 1985.',
 'infrastructure', 'currency', 'annual', 'official',
 'Millions of current USD', NULL, 2, 'dbnomics', 'BEA/NIPA-T50605/Y003RC-A',
 'https://db.nomics.world/BEA/NIPA-T50605/Y003RC-A',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('dbn.BEA.NIPA-T50605.Y004RC-A',
 'US Private Fixed Investment in Custom Software',
 'Software built to order for a US business by an outside supplier, from NIPA table 5.6.5, annual. Also a real transaction, but priced as a contract rather than a product. $261.0bn in 2024.',
 'infrastructure', 'currency', 'annual', 'official',
 'Millions of current USD', NULL, 2, 'dbnomics', 'BEA/NIPA-T50605/Y004RC-A',
 'https://db.nomics.world/BEA/NIPA-T50605/Y004RC-A',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA'),

('dbn.BEA.NIPA-T50605.Y005RC-A',
 'US Private Fixed Investment in Own-Account Software',
 'Software US firms build for themselves, from NIPA table 5.6.5, annual — $97.4bn in 2024, 14.1% of all US software investment. THIS LINE IS NOT OBSERVED. There is no transaction to record, so BEA estimates it as the compensation of the programmers and systems analysts doing the in-house work, plus intermediate inputs and a margin. It therefore rises when programmer pay rises whether or not more software was produced, which is a real limit on reading total software investment as a measure of output. Its share has fallen steadily — 47% of the total in 1985 to 14.1% in 2024 — so the wage-estimated component matters less to the aggregate than it once did, but it is still a seventh of it. Method: BEA NIPA handbook chapter 6.',
 'infrastructure', 'currency', 'annual', 'official',
 'Millions of current USD', NULL, 2, 'dbnomics', 'BEA/NIPA-T50605/Y005RC-A',
 'https://db.nomics.world/BEA/NIPA-T50605/Y005RC-A',
 NULL, TRUE, FALSE, FALSE, INTERVAL '1 day', 'USA')

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  pillar = EXCLUDED.pillar, quantity_kind = EXCLUDED.quantity_kind,
  cadence = EXCLUDED.cadence, confidence_tier = EXCLUDED.confidence_tier,
  unit = EXCLUDED.unit, unit_symbol = EXCLUDED.unit_symbol,
  decimals = EXCLUDED.decimals,
  source_id = EXCLUDED.source_id,
  source_series_code = EXCLUDED.source_series_code,
  source_url = EXCLUDED.source_url,
  higher_is_better = EXCLUDED.higher_is_better,
  has_country_dim = EXCLUDED.has_country_dim,
  refresh_interval = EXCLUDED.refresh_interval,
  default_country_iso3 = EXCLUDED.default_country_iso3,
  updated_at = now();
