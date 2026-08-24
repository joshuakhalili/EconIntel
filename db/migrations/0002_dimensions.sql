-- ============================================================================
-- 0002_dimensions.sql — the dimensions every fact is sliced by
--
-- Classic star-schema dimensions: country, industry, company, source. Facts
-- (observations, documents, assets) reference these, which is what lets the API
-- answer "AI capex, manufacturing, Germany, last 8 quarters" with one indexed
-- query instead of application-side filtering.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Countries. Keyed on ISO 3166-1 alpha-3 because that is what the World Bank
-- and OECD emit natively, so ingestion needs no translation table for them.
-- iso2 is kept for FRED and for map libraries that expect alpha-2.
-- ---------------------------------------------------------------------------
CREATE TABLE countries (
  iso3          CHAR(3) PRIMARY KEY,
  iso2          CHAR(2) UNIQUE,
  name          TEXT NOT NULL,
  region        TEXT,          -- World Bank region grouping
  income_group  TEXT,          -- World Bank income classification
  is_aggregate  BOOLEAN NOT NULL DEFAULT FALSE  -- TRUE for 'EUU', 'WLD' etc.
);

-- `is_aggregate` matters more than it looks: World Bank returns aggregates
-- (World, Euro area, OECD members) through the same endpoint as real countries.
-- Summing across rows without excluding them double-counts badly.
COMMENT ON COLUMN countries.is_aggregate IS
  'TRUE for supranational aggregates (WLD, EUU, OED). Exclude when summing across countries.';

-- ---------------------------------------------------------------------------
-- Industries. Our own shallow taxonomy, with crosswalk columns to the
-- international standards so we can join to official statistics.
--
-- Why our own codes rather than adopting ISIC wholesale: ISIC is far more
-- granular than this dashboard needs (hundreds of classes), and the AI-adoption
-- surveys we depend on report at a much coarser level. A shallow custom
-- taxonomy with crosswalks keeps the UI legible while preserving the ability to
-- map back to official data.
-- ---------------------------------------------------------------------------
CREATE TABLE industries (
  code         TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  parent_code  TEXT REFERENCES industries(code) ON DELETE RESTRICT,
  isic_rev4    TEXT,   -- crosswalk: UN International Standard Industrial Classification
  nace_rev2    TEXT,   -- crosswalk: EU classification (Eurostat)
  naics        TEXT,   -- crosswalk: North American classification (BLS/BEA)
  sort_order   INT NOT NULL DEFAULT 0
);

CREATE INDEX industries_parent_idx ON industries (parent_code);

-- ---------------------------------------------------------------------------
-- Companies. `cik` is the SEC Central Index Key — the join key for EDGAR
-- filings. It is the only reliable identifier across SEC data; ticker symbols
-- get reused and company names change.
-- ---------------------------------------------------------------------------
CREATE TABLE companies (
  id             BIGSERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  ticker         TEXT,
  cik            CHAR(10) UNIQUE,   -- zero-padded, as SEC emits it
  country_iso3   CHAR(3) REFERENCES countries(iso3),
  industry_code  TEXT REFERENCES industries(code),
  is_ai_native   BOOLEAN NOT NULL DEFAULT FALSE,  -- AI is the product, vs. AI is adopted
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX companies_industry_idx ON companies (industry_code);
CREATE INDEX companies_country_idx  ON companies (country_iso3);

-- Distinguishing AI-native firms (NVIDIA, OpenAI) from AI-adopting firms
-- (a bank deploying AI internally) is essential: their capex means opposite
-- things economically. One is supply, the other is demand.
COMMENT ON COLUMN companies.is_ai_native IS
  'TRUE if the company SELLS AI (supply side). FALSE if it ADOPTS AI (demand side). Never aggregate across this line without splitting.';

-- ---------------------------------------------------------------------------
-- Sources. Every fact in this database must be traceable to a source row.
-- This is what makes the dashboard auditable, and it powers the attribution
-- table in the README and the provenance popover in the UI.
-- ---------------------------------------------------------------------------
CREATE TABLE sources (
  id               TEXT PRIMARY KEY,       -- 'fred', 'worldbank', 'sec_edgar', 'rss:ft'
  name             TEXT NOT NULL,
  homepage_url     TEXT,
  api_base_url     TEXT,
  licence          TEXT,                   -- e.g. 'Public Domain', 'CC BY 4.0'
  attribution_text TEXT,                   -- exact wording the source requires us to display
  credibility      SMALLINT NOT NULL DEFAULT 5
                     CHECK (credibility BETWEEN 1 AND 10),
  requires_key     BOOLEAN NOT NULL DEFAULT FALSE,
  notes            TEXT
);

COMMENT ON COLUMN sources.attribution_text IS
  'Verbatim attribution the licence obliges us to display. Rendered in the UI provenance panel.';
