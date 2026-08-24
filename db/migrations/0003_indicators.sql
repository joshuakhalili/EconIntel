-- ============================================================================
-- 0003_indicators.sql — the indicator catalog and the observation fact table
--
-- THIS IS THE CORE OF THE SYSTEM.
--
-- `indicators` is metadata: what a metric means, where it came from, how much
-- to trust it, and how it should be drawn. `observations` is the single long
-- fact table holding every data point for every indicator.
--
-- The payoff of this shape: adding a new metric to the dashboard is an INSERT
-- into `indicators` plus an ingestion job. No migration, no new endpoint, no
-- new UI component. The frontend reads `quantity_kind` and renders correctly by
-- construction.
--
-- The cost, stated honestly: long format loses per-column type safety (every
-- value is NUMERIC) and the fact table grows tall rather than wide. Both are
-- acceptable — the value domain genuinely is "a number", and Postgres handles
-- tens of millions of rows on a covering index without complaint. Revisit only
-- if we exceed ~10^8 rows, at which point declarative partitioning by
-- period_start is the answer.
-- ============================================================================

CREATE TABLE indicators (
  -- Namespaced id: '<source>.<series>'. Human-readable ids make the ingestion
  -- code, the API responses and the debug logs all legible without joins.
  id                 TEXT PRIMARY KEY,          -- e.g. 'fred.OPHNFB', 'wb.NY.GDP.PCAP.KD'

  name               TEXT NOT NULL,             -- short label for chart titles
  description        TEXT,                      -- long-form; shown in the info popover

  pillar             pillar NOT NULL,
  quantity_kind      quantity_kind NOT NULL,
  cadence            cadence NOT NULL,
  confidence_tier    confidence_tier NOT NULL,

  unit               TEXT NOT NULL,             -- 'index_2017=100', 'usd_millions', 'percent'
  unit_symbol        TEXT,                      -- '%', '$', rendered adjacent to values
  decimals           SMALLINT NOT NULL DEFAULT 1,

  -- Provenance. NOT NULL on source_id is deliberate: an indicator with no
  -- traceable source has no business being on this dashboard.
  source_id          TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,
  source_series_code TEXT,                      -- the id the SOURCE uses, for refetching
  source_url         TEXT,

  -- Semantics that drive rendering ------------------------------------------

  -- Does a bigger number mean things are going well? NULL means genuinely
  -- ambiguous (e.g. "AI mentions in filings" — is more good or bad? depends who
  -- is asking), and the UI must then use a neutral, non-judgemental palette
  -- rather than red/green. Encoding "we don't know" explicitly stops the chart
  -- layer from silently assuming up=good.
  higher_is_better   BOOLEAN,

  -- For 'index' kinds: what the base equals (usually 100) and when.
  index_base_value   NUMERIC,
  index_base_period  DATE,

  -- Which dimensions this indicator is actually reported against. Enforced by a
  -- trigger on observations (see below) so a country-level series can never
  -- accidentally acquire company-level rows.
  has_country_dim    BOOLEAN NOT NULL DEFAULT FALSE,
  has_industry_dim   BOOLEAN NOT NULL DEFAULT FALSE,
  has_company_dim    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Operational -------------------------------------------------------------
  refresh_interval   INTERVAL,                  -- how often ingestion should refetch
  last_ingested_at   TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX indicators_pillar_idx ON indicators (pillar) WHERE is_active;
CREATE INDEX indicators_source_idx ON indicators (source_id);

COMMENT ON COLUMN indicators.higher_is_better IS
  'NULL means genuinely ambiguous — the UI must then use a neutral palette, never red/green.';


-- ---------------------------------------------------------------------------
-- observations — one row per (indicator, dimensional slice, period).
--
-- The dimension columns are nullable because indicators sit at different
-- grains: a national productivity index has a country but no company; a
-- company's AI capex has a company but no industry-wide meaning.
-- ---------------------------------------------------------------------------
CREATE TABLE observations (
  id             BIGSERIAL PRIMARY KEY,

  indicator_id   TEXT    NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,

  country_iso3   CHAR(3)      REFERENCES countries(iso3),
  industry_code  TEXT         REFERENCES industries(code),
  company_id     BIGINT       REFERENCES companies(id) ON DELETE CASCADE,

  -- A period, not an instant. Quarterly and annual data describe a span, and
  -- collapsing that to a single date is a common source of off-by-one-quarter
  -- bugs when joining series of different cadence. Storing both ends makes
  -- range joins correct and lets the API align cadences honestly.
  period_start   DATE    NOT NULL,
  period_end     DATE    NOT NULL,

  value          NUMERIC,        -- NULL = source reported the period but had no value
  value_status   TEXT,           -- 'provisional', 'revised', 'estimated', 'suppressed'

  -- Row-level provenance. Usually mirrors the indicator, but an individual
  -- observation can be less trustworthy than its series (e.g. one back-filled
  -- estimate inside an otherwise official series).
  confidence_tier confidence_tier,
  source_ref     TEXT,           -- URL / filing accession / article id this row came from

  ingested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT observations_period_ordered CHECK (period_end >= period_start)
);

-- Uniqueness on the dimensional grain.
--
-- A plain composite UNIQUE would not work: in SQL, NULL is not equal to NULL,
-- so two rows both having country_iso3 = NULL would not collide, and re-running
-- an ingestion job would silently duplicate every row. COALESCE-ing the
-- nullable dimensions to sentinels gives us real idempotency, which is what
-- makes ON CONFLICT upserts safe.
CREATE UNIQUE INDEX observations_grain_uniq ON observations (
  indicator_id,
  period_start,
  COALESCE(country_iso3, '~~~'),
  COALESCE(industry_code, '~~~'),
  COALESCE(company_id, -1)
);

-- The workhorse read path: "give me this indicator over time for this slice".
CREATE INDEX observations_series_idx
  ON observations (indicator_id, period_start DESC)
  INCLUDE (value, country_iso3, industry_code, company_id);

CREATE INDEX observations_country_idx  ON observations (country_iso3, indicator_id)
  WHERE country_iso3 IS NOT NULL;
CREATE INDEX observations_industry_idx ON observations (industry_code, indicator_id)
  WHERE industry_code IS NOT NULL;
CREATE INDEX observations_company_idx  ON observations (company_id, indicator_id)
  WHERE company_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- Grain enforcement.
--
-- Declaring the allowed dimensions on `indicators` is only useful if something
-- enforces it. Without this, a buggy ingestion job can quietly attach
-- company-level rows to a national series, and the resulting aggregate is
-- wrong in a way that is very hard to spot on a chart. Failing loudly at write
-- time is much cheaper than debugging a subtly wrong number later.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_observation_grain() RETURNS TRIGGER AS $$
DECLARE
  ind indicators%ROWTYPE;
BEGIN
  SELECT * INTO ind FROM indicators WHERE id = NEW.indicator_id;

  IF NEW.country_iso3 IS NOT NULL AND NOT ind.has_country_dim THEN
    RAISE EXCEPTION 'indicator % does not have a country dimension', NEW.indicator_id;
  END IF;
  IF NEW.industry_code IS NOT NULL AND NOT ind.has_industry_dim THEN
    RAISE EXCEPTION 'indicator % does not have an industry dimension', NEW.indicator_id;
  END IF;
  IF NEW.company_id IS NOT NULL AND NOT ind.has_company_dim THEN
    RAISE EXCEPTION 'indicator % does not have a company dimension', NEW.indicator_id;
  END IF;

  -- Inherit trust tier from the series unless the row overrides it.
  IF NEW.confidence_tier IS NULL THEN
    NEW.confidence_tier := ind.confidence_tier;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER observations_grain_check
  BEFORE INSERT OR UPDATE ON observations
  FOR EACH ROW EXECUTE FUNCTION enforce_observation_grain();
