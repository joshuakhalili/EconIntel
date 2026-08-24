-- ============================================================================
-- 0007_entities.sql — who does what to whom, and what proves it
--
-- The five migrations before this describe MEASUREMENTS: a number, attached to
-- a period, for a place. That model answers "what was US productivity in Q2"
-- and cannot answer "who invested in OpenAI, when, and how much".
--
-- Those are structurally different. A measurement is a scalar on a time axis.
-- A deal is a relationship between two parties with a direction, an amount, a
-- date and a claim to truth that rests on a source rather than on a statistical
-- agency. Forcing deals into `observations` would lose the direction, the
-- counterparty, and the evidence — the three things that make them worth having.
--
-- So this migration adds the second half of the data model. It is what powers
-- the investment graph, the "who invests where" question, expenditure by
-- geography, company timelines, and clicking a point on a chart to see the
-- articles that evidence it.
--
-- ONE RULE GOVERNS EVERYTHING HERE: no event exists without a source. The link
-- to `documents` is not optional metadata; it is the reason a reader should
-- believe the number. A deal we cannot cite is a rumour we invented.
-- ============================================================================

CREATE TYPE entity_kind AS ENUM (
  'company',        -- Nvidia, Microsoft
  'research_lab',   -- OpenAI, Anthropic, DeepMind
  'investor',       -- SoftBank Vision Fund, a16z
  'government',     -- US federal, EU Commission
  'institution'     -- universities, standards bodies
);

CREATE TYPE event_kind AS ENUM (
  'investment',       -- equity or capital into another party
  'acquisition',
  'partnership',      -- commercial agreement, no equity
  'funding_round',    -- a raise, possibly from many investors
  'datacentre_build', -- announced capacity or construction
  'chip_order',       -- compute purchase commitment
  'contract',         -- supply or service agreement
  'divestment'
);

/**
 * Announced is not the same as done. Deals are revised, delayed and abandoned,
 * and a dashboard that silently treats an announcement as a completed
 * transaction overstates investment — systematically, because cancellations are
 * reported far more quietly than announcements.
 */
CREATE TYPE event_status AS ENUM (
  'rumoured',
  'announced',
  'completed',
  'cancelled'
);


-- ---------------------------------------------------------------------------
-- Entities.
--
-- Slug rather than a generated id as the primary key: these are referenced from
-- seed files, extraction prompts and URLs, and a stable human-readable key
-- ('nvidia') survives a reseed where a serial integer would not.
-- ---------------------------------------------------------------------------
CREATE TABLE entities (
  id              TEXT PRIMARY KEY,          -- 'nvidia', 'openai'
  name            TEXT NOT NULL,             -- 'NVIDIA Corporation'
  kind            entity_kind NOT NULL,

  country_iso3    CHAR(3) REFERENCES countries(iso3),
  description     TEXT,
  homepage_url    TEXT,

  -- Identifiers that let an entity join to data we already hold. `cik` links to
  -- SEC filings, so a company's deal history and its reported capex can sit on
  -- one page without a fuzzy name match.
  ticker          TEXT,
  cik             BIGINT,
  founded_year    SMALLINT,

  -- Whether a human has confirmed this entity is real and correctly described,
  -- as opposed to having been created by extraction. Mirrors the confidence
  -- distinction used throughout the indicator model.
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX entities_kind_idx    ON entities (kind);
CREATE INDEX entities_country_idx ON entities (country_iso3);
CREATE UNIQUE INDEX entities_cik_idx ON entities (cik) WHERE cik IS NOT NULL;


-- ---------------------------------------------------------------------------
-- Aliases.
--
-- The same company appears as 'Nvidia', 'NVIDIA Corp', 'NVDA' and
-- 'Nvidia Corporation' across sources. Without a resolution table, extraction
-- creates four entities and the investment graph splits one company into four
-- disconnected nodes — which looks like a data problem to us and like a wrong
-- answer to a reader.
-- ---------------------------------------------------------------------------
CREATE TABLE entity_aliases (
  alias       TEXT PRIMARY KEY,              -- stored lowercased
  entity_id   TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE
);

CREATE INDEX entity_aliases_entity_idx ON entity_aliases (entity_id);

COMMENT ON TABLE entity_aliases IS
  'Name variants resolving to one entity. Lowercase the alias before lookup.';


-- ---------------------------------------------------------------------------
-- Events — the deals themselves.
-- ---------------------------------------------------------------------------
CREATE TABLE events (
  id              BIGSERIAL PRIMARY KEY,

  kind            event_kind   NOT NULL,
  status          event_status NOT NULL DEFAULT 'announced',

  -- Direction is the point. from_entity acts on to_entity: Nvidia invests in
  -- OpenAI, not the reverse. Reversing an arrow in a financing diagram inverts
  -- the story completely, which is why extraction of this field needs review.
  from_entity_id  TEXT NOT NULL REFERENCES entities(id) ON DELETE RESTRICT,
  to_entity_id    TEXT          REFERENCES entities(id) ON DELETE RESTRICT,

  -- Nullable because plenty of real, important deals are announced without a
  -- figure. Recording the deal with a null amount is honest; inventing a
  -- plausible number to fill a chart is not.
  amount_usd      NUMERIC(20, 2),
  amount_is_estimate BOOLEAN NOT NULL DEFAULT FALSE,

  -- Data-centre announcements are measured in megawatts as often as in money,
  -- and the two are not interchangeable.
  capacity_mw     NUMERIC(12, 2),

  announced_date  DATE NOT NULL,
  completed_date  DATE,

  -- Where the money or capacity lands, which is frequently not where either
  -- party is headquartered — a US firm building in Ireland is the normal case.
  location_iso3   CHAR(3) REFERENCES countries(iso3),
  industry_code   TEXT     REFERENCES industries(code),

  headline        TEXT NOT NULL,
  detail          TEXT,

  -- Defaults to news_derived because that is where most events will come from.
  -- A deal read out of an SEC filing should be upgraded to 'official' on
  -- ingestion; the default is the weakest claim, not the most convenient one.
  confidence_tier confidence_tier NOT NULL DEFAULT 'news_derived',
  is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by     TEXT,
  verified_at     TIMESTAMPTZ,

  /**
   * Deduplication key. The same deal is reported by dozens of outlets and
   * extracted repeatedly across ingestion runs. Hashing the parties, kind and
   * announcement date collapses those into one event, which then accumulates
   * many sources rather than appearing many times.
   */
  dedup_hash      TEXT NOT NULL UNIQUE,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A completed deal cannot complete before it was announced.
  CONSTRAINT events_dates_ordered
    CHECK (completed_date IS NULL OR completed_date >= announced_date),
  -- Amounts are magnitudes; a negative investment is a divestment, which is its
  -- own event kind.
  CONSTRAINT events_amount_nonneg
    CHECK (amount_usd IS NULL OR amount_usd >= 0),
  CONSTRAINT events_capacity_nonneg
    CHECK (capacity_mw IS NULL OR capacity_mw >= 0)
);

CREATE INDEX events_from_idx      ON events (from_entity_id, announced_date DESC);
CREATE INDEX events_to_idx        ON events (to_entity_id, announced_date DESC);
CREATE INDEX events_date_idx      ON events (announced_date DESC);
CREATE INDEX events_kind_idx      ON events (kind, announced_date DESC);
CREATE INDEX events_location_idx  ON events (location_iso3) WHERE location_iso3 IS NOT NULL;


-- ---------------------------------------------------------------------------
-- Event sources — MANY documents per event.
--
-- This is the evidence layer, and the cardinality is the whole point. Fifty
-- outlets reporting one deal is not fifty deals; it is one deal with fifty
-- citations. That distinction gives two things a single foreign key could not:
--
--   1. Clicking a point on a chart can list the articles behind it.
--   2. Corroboration becomes measurable. A deal carried by thirty independent
--      outlets is better attested than one carried by a single blog, and the
--      interface can say so instead of presenting both with equal confidence.
-- ---------------------------------------------------------------------------
CREATE TABLE event_sources (
  event_id     BIGINT NOT NULL REFERENCES events(id)    ON DELETE CASCADE,
  document_id  BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

  -- The sentence the claim was drawn from. Stored so a reader can be shown the
  -- actual words rather than asked to trust a summary of them, and so a
  -- disputed figure can be traced to its origin without refetching.
  quote        TEXT,
  is_primary   BOOLEAN NOT NULL DEFAULT FALSE,   -- the filing or press release
  added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (event_id, document_id)
);

CREATE INDEX event_sources_document_idx ON event_sources (document_id);


-- ---------------------------------------------------------------------------
-- Views. Kept in SQL rather than assembled in JavaScript so the definition of
-- "an investment edge" lives in one place and cannot drift between the chart,
-- the API and the graph.
-- ---------------------------------------------------------------------------

/**
 * Edges for the investment graph, with corroboration counts.
 * Cancelled deals are excluded: a diagram of money that did not move is
 * misleading, and the cancellation is better told as a timeline entry.
 */
CREATE VIEW investment_edges AS
SELECT e.id                                   AS event_id,
       e.from_entity_id,
       f.name                                 AS from_name,
       e.to_entity_id,
       t.name                                 AS to_name,
       e.kind,
       e.status,
       e.amount_usd,
       e.capacity_mw,
       e.announced_date,
       e.location_iso3,
       e.headline,
       e.is_verified,
       e.confidence_tier,
       count(s.document_id)::int              AS source_count
  FROM events e
  JOIN entities f ON f.id = e.from_entity_id
  LEFT JOIN entities t ON t.id = e.to_entity_id
  LEFT JOIN event_sources s ON s.event_id = e.id
 WHERE e.status <> 'cancelled'
 GROUP BY e.id, f.name, t.name;

COMMENT ON VIEW investment_edges IS
  'One row per non-cancelled deal, with how many documents attest to it.';

/**
 * Monthly announced investment — the expenditure time series, computed from
 * events rather than stored as observations.
 *
 * Deliberately a view: the underlying events get revised as extraction improves
 * and as deals complete or collapse. A materialised copy would drift out of
 * agreement with the evidence it claims to summarise, and the volume here is
 * thousands of rows, not millions.
 */
CREATE VIEW monthly_investment AS
SELECT date_trunc('month', announced_date)::date       AS month,
       kind,
       COALESCE(location_iso3, 'UNK')                  AS location_iso3,
       count(*)::int                                   AS deal_count,
       sum(amount_usd) FILTER (WHERE NOT amount_is_estimate) AS reported_usd,
       sum(amount_usd)                                 AS total_usd,
       sum(capacity_mw)                                AS total_mw
  FROM events
 WHERE status <> 'cancelled'
 GROUP BY 1, 2, 3;

COMMENT ON VIEW monthly_investment IS
  'Announced investment by month. reported_usd excludes estimated figures so a '
  'chart can show what was actually stated separately from what was inferred.';
