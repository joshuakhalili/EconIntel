-- ============================================================================
-- 0001_enums.sql — controlled vocabularies
--
-- These enums are the project's semantic backbone. `quantity_kind` in
-- particular is consumed by the frontend ChartSpec layer to decide which chart
-- form and which colour role an indicator gets, so a new indicator renders
-- correctly without anyone touching UI code.
--
-- Enums (rather than lookup tables) are the right call here because these
-- vocabularies are small, closed, and changing one implies a code change
-- anyway. Postgres enforces them at write time, which keeps junk out of the
-- fact table.
-- ============================================================================

-- The four analytical pillars of the dashboard.
CREATE TYPE pillar AS ENUM (
  'adoption',        -- AI adoption & corporate impact (spend, productivity, headcount)
  'infrastructure',  -- data centres, power, physical buildout
  'policy',          -- government stance, regulation, public investment
  'effects'          -- broader economic effects (labour, creative industries, markets)
);

-- What KIND of number this is. Drives chart form + colour role selection.
--   magnitude -> bar/area,     sequential colour
--   rate      -> line,         sequential colour
--   index     -> line rebased, sequential colour
--   change    -> bar,          DIVERGING colour (can be negative)
--   count     -> bar,          sequential colour
--   currency  -> bar/area,     sequential colour
--   score     -> gauge/tile,   status colour (bounded composite)
CREATE TYPE quantity_kind AS ENUM (
  'magnitude', 'rate', 'index', 'change', 'count', 'currency', 'score'
);

-- Native reporting frequency of the source series.
CREATE TYPE cadence AS ENUM (
  'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'irregular'
);

-- HOW MUCH TO TRUST THIS NUMBER.
--
-- This is the most important column in the schema. The dashboard mixes official
-- statistical agency output with numbers inferred by a language model from news
-- text. Those are not the same kind of fact, and rendering them identically
-- would be dishonest. Every observation inherits its indicator's tier, and the
-- UI is required to visually distinguish them.
--
--   official     — published by a statistical agency or central bank (FRED, World Bank)
--   derived      — computed by us in SQL from official inputs (deterministic, reproducible)
--   survey       — from a published survey/report (Stanford AI Index, OECD); periodic, not live
--   modelled     — estimated with stated assumptions
--   news_derived — extracted or classified from news/filing text, possibly by an LLM. LOWEST TRUST.
CREATE TYPE confidence_tier AS ENUM (
  'official', 'derived', 'survey', 'modelled', 'news_derived'
);

-- Stance of a government communication toward AI. Used by the policy pillar.
-- Deliberately two independent axes rather than one left-right scale: a
-- government can be simultaneously pro-investment AND pro-regulation (the EU is
-- the obvious case), and collapsing that into one number would destroy the most
-- interesting signal in the dataset.
CREATE TYPE policy_stance AS ENUM (
  'accelerationist',  -- pro-investment, light-touch regulation
  'balanced',         -- pro-investment AND pro-regulation
  'precautionary',    -- regulation-forward, investment-neutral
  'restrictive',      -- restriction-forward
  'neutral',          -- procedural/administrative, no discernible stance
  'unclear'           -- classifier had low confidence; NOT the same as neutral
);

-- Lifecycle of a physical asset (data centre, power project).
CREATE TYPE asset_status AS ENUM (
  'announced', 'permitted', 'under_construction', 'operational', 'cancelled', 'unknown'
);
