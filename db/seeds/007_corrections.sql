-- ============================================================================
-- 007_corrections.sql — retractions and gap fills from the source audit
--
-- An independent verification pass re-fetched every series seeded in 006 and
-- found four that should not be shown. They are deactivated rather than
-- deleted: their observations stay on disk, the decision stays reversible, and
-- the reason stays written down. A silently removed series is indistinguishable
-- from one that was never considered.
--
-- Deactivating also removes them from the ingestion runner and from every API
-- response, since both filter on is_active.
-- ============================================================================

-- ── 1. Duplicate: the same EU AI-adoption statistic from two mirrors ────────
-- Eurostat and the OECD publish identical figures (2021: 7.65 vs 7.647,
-- 2025: 19.95 vs 19.948). The OECD copy carries an additional year (2020), so
-- it strictly dominates. Two lines of the same data on one dashboard is not
-- corroboration, it is an error the reader has to notice on our behalf.
UPDATE indicators SET is_active = FALSE, updated_at = now()
 WHERE id = 'dbn.Eurostat.isoc_eb_ai.A.GE10.C10-S951_X_K.E_AI_TANY.PC_ENT.EU27_2020';

-- ── 2. Duplicate: two electricity price bands, one question ─────────────────
-- Band IE (20-70 GWh/yr) and band IG (>=150 GWh/yr) come from the same dataset
-- with identical periods. IG is the hyperscale band — 150 GWh/yr is roughly
-- 17 MW drawn continuously, which is data-centre scale. IE is a large factory.
-- Keeping IG only.
UPDATE indicators SET is_active = FALSE, updated_at = now()
 WHERE id = 'dbn.Eurostat.nrg_pc_205.S.6000.MWH20000-69999.KWH.X_TAX.EUR.EU27_2020';

-- ── 3. Duplicate: the same BEA series, twice, at different quality ──────────
-- BEA/NIPA-T50605/B985RC-A and FRED's B985RC1Q027SBEA are the same underlying
-- BEA series. The FRED copy is quarterly rather than annual and runs to 2026-Q2
-- rather than 2024. Same data, four times the resolution, two years fresher.
UPDATE indicators SET is_active = FALSE, updated_at = now()
 WHERE id = 'dbn.BEA.NIPA-T50605.B985RC-A';

-- ── 4. Stale: a gold series that has stopped moving ─────────────────────────
-- IMF/PCPS gold on DBnomics last updated 2025-07-15 and ends 2025-06. Fourteen
-- months behind and not advancing. A commodity chart that stops silently in the
-- middle of last year is worse than no commodity chart: it looks current.
-- FRED IQ12260 (gold export price index, monthly to 2026-07) already covers
-- this and is live.
UPDATE indicators SET is_active = FALSE, updated_at = now()
 WHERE id = 'dbn.IMF.PCPS.M.W00.PGOLD.USD';

-- ── 5. Forecast contamination warning ───────────────────────────────────────
-- AMECO publishes European Commission projections in the same series as
-- history, so UK total factor productivity runs to 2027 with the last three
-- years being forecasts, not observations. The dashboard must style those
-- differently or it presents a projection as a measurement. Recorded in the
-- description so the fact travels with the indicator rather than living in a
-- commit message.
UPDATE indicators
   SET description = description ||
       ' WARNING: AMECO mixes European Commission forecasts into the same series as history —' ||
       ' observations from 2025 onward are projections, not measurements, and must be rendered' ||
       ' distinctly (dashed, or cut off) or the chart asserts something false.',
       updated_at = now()
 WHERE id = 'dbn.AMECO.ZVGDF.GBR.3.0.0.0.ZVGDF'
   AND description NOT LIKE '%WARNING: AMECO%';


-- ---------------------------------------------------------------------------
-- Gap fills identified by the audit. All three verified live on 2026-08-25.
-- ---------------------------------------------------------------------------
INSERT INTO indicators (
  id, name, description, pillar, quantity_kind, cadence, confidence_tier,
  unit, unit_symbol, decimals, source_id, source_series_code, source_url,
  higher_is_better, has_country_dim, has_industry_dim, has_company_dim,
  refresh_interval, default_country_iso3
) VALUES

('dbn.OECD.ict_business.KOR.ai_adoption',
 'South Korea: Enterprises Using AI',
 'The share of Korean firms with 10 or more employees using at least one AI technology, rising from 2.5% in 2019 to 32.9% in 2024. The highest national adoption rate available from any free source — roughly 13 points above the OECD average — which makes Korea the closest thing to a natural experiment in what happens to an economy when AI use becomes common.',
 'adoption', 'rate', 'annual', 'official',
 'Percentage of enterprises', '%', 1, 'dbnomics',
 'OECD/DSD_ICT_B@DF_BUSINESSES/KOR.A.G14_B.PT_ENT._T.S_GE10',
 'https://db.nomics.world/OECD/DSD_ICT_B@DF_BUSINESSES/KOR.A.G14_B.PT_ENT._T.S_GE10',
 NULL, TRUE, FALSE, FALSE, INTERVAL '7 days', 'KOR'),

('dbn.Eurostat.isoc_eb_ain2.manufacturing',
 'EU Manufacturers Using AI',
 'AI adoption among European manufacturers, 6.9% in 2021 to 17.3% in 2025. The deliberate counterpart to the software-sector series: factories run roughly four years behind software firms, and charting the two together shows AI diffusing across an economy rather than arriving everywhere at once.',
 'adoption', 'rate', 'annual', 'official',
 'Percentage of enterprises', '%', 1, 'dbnomics',
 'Eurostat/isoc_eb_ain2/A.GE10.C.E_AI_TANY.PC_ENT.EU27_2020',
 'https://db.nomics.world/Eurostat/isoc_eb_ain2/A.GE10.C.E_AI_TANY.PC_ENT.EU27_2020',
 NULL, FALSE, TRUE, FALSE, INTERVAL '7 days', NULL),

('dbn.Eurostat.nama_10_an6.ict_equipment',
 'EU Investment in ICT Equipment',
 'European investment in computing and communications hardware, chain-linked index 2015=100. The hardware counterpart to intellectual-property investment already held: together they show whether Europe''s digital capital spending is going into machines or into software.',
 'infrastructure', 'index', 'annual', 'official',
 'index_2015=100', NULL, 2, 'dbnomics',
 'Eurostat/nama_10_an6/A.CLV_I15.N1132G.EU27_2020',
 'https://db.nomics.world/Eurostat/nama_10_an6/A.CLV_I15.N1132G.EU27_2020',
 TRUE, FALSE, FALSE, FALSE, INTERVAL '7 days', NULL)

ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description,
  source_series_code = EXCLUDED.source_series_code,
  source_url = EXCLUDED.source_url,
  default_country_iso3 = EXCLUDED.default_country_iso3,
  is_active = TRUE, updated_at = now();
