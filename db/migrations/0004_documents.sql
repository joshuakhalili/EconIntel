-- ============================================================================
-- 0004_documents.sql — unstructured text and what we infer from it
--
-- News articles, government press releases and SEC filings all arrive as text.
-- They share one table because they share one lifecycle: fetch, deduplicate,
-- classify, cite. Splitting them into three near-identical tables would triple
-- the ingestion and dedup code for no analytical benefit.
--
-- Classifications live in a SEPARATE table from documents. This is deliberate
-- and important: a classification is an opinion produced by a model at a point
-- in time with a particular prompt. Keeping it separate means we can re-run a
-- better classifier without touching source text, compare classifier versions
-- against each other, and — crucially — never lose the ability to show a reader
-- the original words behind an inference.
-- ============================================================================

CREATE TYPE document_kind AS ENUM (
  'news', 'gov_release', 'sec_filing', 'research', 'regulatory_text'
);

CREATE TABLE documents (
  id              BIGSERIAL PRIMARY KEY,

  kind            document_kind NOT NULL,
  source_id       TEXT NOT NULL REFERENCES sources(id) ON DELETE RESTRICT,

  url             TEXT NOT NULL,
  title           TEXT NOT NULL,
  author          TEXT,
  summary         TEXT,            -- source-provided excerpt (NOT model-generated)
  body            TEXT,            -- full text where we legitimately have it

  published_at    TIMESTAMPTZ NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Deduplication key. Wire services syndicate the same story to a dozen
  -- outlets with different URLs and slightly different headlines. Hashing
  -- normalised title + publication date catches most of that; without it the
  -- news panel fills up with the same story repeated.
  dedup_hash      TEXT NOT NULL,

  -- Dimensional tagging, so documents join to the same slices as observations.
  -- Arrays rather than join tables: an article routinely touches several
  -- countries, cardinality is low, and GIN-indexed arrays answer
  -- "articles mentioning Germany" fast without a join.
  country_iso3s   CHAR(3)[] NOT NULL DEFAULT '{}',
  industry_codes  TEXT[]    NOT NULL DEFAULT '{}',
  company_ids     BIGINT[]  NOT NULL DEFAULT '{}',

  -- Cheap deterministic relevance score computed at ingestion by keyword
  -- matching — NOT by a model. Used to decide which documents are worth paying
  -- an LLM to classify. Keeping the triage step free is what keeps the running
  -- cost of this project near zero.
  ai_relevance    SMALLINT NOT NULL DEFAULT 0 CHECK (ai_relevance BETWEEN 0 AND 100),

  raw             JSONB,           -- original feed item, for reprocessing without refetching

  CONSTRAINT documents_dedup_uniq UNIQUE (dedup_hash)
);

CREATE INDEX documents_published_idx  ON documents (published_at DESC);
CREATE INDEX documents_kind_idx       ON documents (kind, published_at DESC);
CREATE INDEX documents_relevance_idx  ON documents (ai_relevance DESC, published_at DESC)
  WHERE ai_relevance >= 40;
CREATE INDEX documents_countries_idx  ON documents USING GIN (country_iso3s);
CREATE INDEX documents_industries_idx ON documents USING GIN (industry_codes);
CREATE INDEX documents_companies_idx  ON documents USING GIN (company_ids);

-- Full-text search over title + summary, maintained by Postgres itself.
-- A generated column means the tsvector can never drift out of sync with the
-- text, which is the usual failure mode of trigger-maintained search columns.
ALTER TABLE documents ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')),   'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  ) STORED;

CREATE INDEX documents_search_idx ON documents USING GIN (search_tsv);


-- ---------------------------------------------------------------------------
-- Policy stance classifications.
--
-- One row per (document, classifier version). Versioning the classifier is what
-- lets us improve the prompt later and measure whether it actually got better,
-- instead of silently overwriting history and hoping.
-- ---------------------------------------------------------------------------
CREATE TABLE policy_classifications (
  id                  BIGSERIAL PRIMARY KEY,

  document_id         BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  country_iso3        CHAR(3) REFERENCES countries(iso3),

  stance              policy_stance NOT NULL,

  -- The two independent axes behind the stance label, kept as numbers so they
  -- can be charted and averaged. -100 (hostile) .. +100 (enthusiastic).
  investment_score    SMALLINT CHECK (investment_score BETWEEN -100 AND 100),
  regulation_score    SMALLINT CHECK (regulation_score BETWEEN -100 AND 100),

  -- The model's own confidence, 0..100. Low-confidence rows are shown greyed
  -- rather than hidden: hiding them would make the classifier look better than
  -- it is, which is precisely the kind of flattery this dashboard should avoid.
  confidence          SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),

  -- The verbatim sentence(s) the classifier based its call on. Non-negotiable:
  -- an inference a reader cannot trace back to source text is not evidence, and
  -- this column is what makes the policy pillar defensible rather than a
  -- black box.
  evidence_quote      TEXT,

  classifier_version  TEXT NOT NULL,   -- e.g. 'stance-v1:gpt-4o-mini'
  classified_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT policy_classifications_uniq UNIQUE (document_id, classifier_version)
);

CREATE INDEX policy_class_country_idx ON policy_classifications (country_iso3, classified_at DESC);
CREATE INDEX policy_class_stance_idx  ON policy_classifications (stance);

COMMENT ON COLUMN policy_classifications.evidence_quote IS
  'Verbatim source text supporting the classification. An inference with no traceable quote must not be displayed as evidence.';
