-- ============================================================================
-- 0006_analysis.sql — derived metrics, LLM narration cache, ingestion audit
--
-- Three concerns that share a theme: everything here is COMPUTED rather than
-- ingested, so everything here must record what it was computed from.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LLM narration cache.
--
-- The rule this table enforces: an LLM never invents a number. It is handed
-- numbers that SQL already computed and asked to describe them in prose. This
-- is the single most important safeguard in the project — a dashboard that lets
-- a language model generate statistics is worse than no dashboard, because it
-- is confidently wrong.
--
-- `input_hash` is a digest of the exact grounding data passed to the model.
-- Cache hits key on it, so the narration regenerates if and only if the
-- underlying numbers changed. That keeps cost near zero on a dashboard people
-- refresh constantly, and — more importantly — makes it impossible for stale
-- prose to sit above fresh figures, which would be a correctness bug, not
-- merely a cosmetic one.
-- ---------------------------------------------------------------------------
CREATE TABLE narrations (
  id             BIGSERIAL PRIMARY KEY,

  scope          TEXT NOT NULL,        -- 'pillar:adoption', 'indicator:fred.OPHNFB', 'brief:daily'
  input_hash     TEXT NOT NULL,        -- sha256 of the grounding payload

  body           TEXT NOT NULL,        -- the generated prose
  headline       TEXT,

  -- The exact data the model was given. Retained so a reader can audit the
  -- claim, and so we can regression-test prompt changes against fixed inputs.
  grounding      JSONB NOT NULL,

  -- Which indicators the narration is allowed to have discussed. Lets the UI
  -- render "sources" links under generated prose, and lets us detect a model
  -- that wandered off its evidence.
  indicator_ids  TEXT[] NOT NULL DEFAULT '{}',

  model          TEXT NOT NULL,        -- 'gpt-4o-mini', 'claude-sonnet-4'
  prompt_version TEXT NOT NULL,        -- bump to invalidate every cached narration
  token_cost     INT,

  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ,          -- belt-and-braces TTL for time-sensitive scopes

  CONSTRAINT narrations_cache_uniq UNIQUE (scope, input_hash, prompt_version)
);

CREATE INDEX narrations_scope_idx ON narrations (scope, generated_at DESC);

COMMENT ON TABLE narrations IS
  'LLM prose grounded on precomputed SQL results. The model describes numbers; it never produces them.';
COMMENT ON COLUMN narrations.grounding IS
  'Exact payload given to the model. Enables auditing a claim and regression-testing prompt changes.';


-- ---------------------------------------------------------------------------
-- Derived metrics.
--
-- Computed in SQL from observations: growth rates, z-scores, rankings,
-- adoption-vs-productivity correlations. Materialised rather than computed per
-- request because these run over the full history and the dashboard reads them
-- on every page load.
--
-- Kept in its own table rather than mixed into `observations` so that the
-- provenance boundary stays sharp: everything in `observations` came from
-- outside, everything here we produced.
-- ---------------------------------------------------------------------------
CREATE TABLE derived_metrics (
  id              BIGSERIAL PRIMARY KEY,

  metric_key      TEXT NOT NULL,       -- 'yoy_growth', 'zscore_5y', 'rank_within_pillar'
  indicator_id    TEXT NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,

  country_iso3    CHAR(3) REFERENCES countries(iso3),
  industry_code   TEXT    REFERENCES industries(code),
  company_id      BIGINT  REFERENCES companies(id) ON DELETE CASCADE,

  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,

  value           NUMERIC,

  -- How this was computed, in words, so the UI can explain itself and so nobody
  -- has to reverse-engineer the SQL to know what a number means.
  method          TEXT NOT NULL,
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT derived_period_ordered CHECK (period_end >= period_start)
);

CREATE UNIQUE INDEX derived_metrics_grain_uniq ON derived_metrics (
  metric_key,
  indicator_id,
  period_start,
  COALESCE(country_iso3, '~~~'),
  COALESCE(industry_code, '~~~'),
  COALESCE(company_id, -1)
);

CREATE INDEX derived_metrics_lookup_idx
  ON derived_metrics (indicator_id, metric_key, period_start DESC);


-- ---------------------------------------------------------------------------
-- Ingestion runs — the operational audit log.
--
-- Every scheduled job writes a row. Without this, "why is the German
-- productivity series three weeks stale?" is unanswerable, and silent ingestion
-- failure is the most common way a dashboard like this rots: the page still
-- renders, the numbers are just quietly old. The UI reads this table to show a
-- freshness indicator per source.
-- ---------------------------------------------------------------------------
CREATE TYPE run_status AS ENUM ('running', 'succeeded', 'failed', 'partial');

CREATE TABLE ingestion_runs (
  id             BIGSERIAL PRIMARY KEY,

  job_name       TEXT NOT NULL,         -- 'fred.productivity', 'rss.government'
  source_id      TEXT REFERENCES sources(id),

  status         run_status NOT NULL DEFAULT 'running',

  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at    TIMESTAMPTZ,

  rows_written   INT NOT NULL DEFAULT 0,
  rows_skipped   INT NOT NULL DEFAULT 0,
  error_message  TEXT,
  details        JSONB
);

CREATE INDEX ingestion_runs_job_idx ON ingestion_runs (job_name, started_at DESC);
CREATE INDEX ingestion_runs_failed_idx ON ingestion_runs (started_at DESC)
  WHERE status IN ('failed', 'partial');


-- ---------------------------------------------------------------------------
-- Freshness view. Backs the "last updated" badge on every panel.
--
-- A dashboard that does not tell you how old its numbers are invites the reader
-- to assume they are current. For economic data, where series lag by weeks or
-- quarters by nature, that assumption is usually wrong.
-- ---------------------------------------------------------------------------
CREATE VIEW indicator_freshness AS
SELECT
  i.id                AS indicator_id,
  i.name,
  i.pillar,
  i.cadence,
  i.confidence_tier,
  s.name              AS source_name,
  i.last_ingested_at,
  MAX(o.period_end)   AS latest_period,
  COUNT(o.id)         AS observation_count,
  now() - i.last_ingested_at AS since_ingest
FROM indicators i
JOIN sources s ON s.id = i.source_id
LEFT JOIN observations o ON o.indicator_id = i.id
WHERE i.is_active
GROUP BY i.id, i.name, i.pillar, i.cadence, i.confidence_tier, s.name, i.last_ingested_at;
