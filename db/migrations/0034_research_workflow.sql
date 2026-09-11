CREATE TABLE research_study_families (
  id TEXT PRIMARY KEY,
  canonical_title TEXT NOT NULL,
  identity_basis TEXT NOT NULL CHECK(identity_basis IN ('provider_work','reviewed_link')),
  identity_note TEXT NOT NULL
);
CREATE TABLE research_study_versions (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES research_study_families(id),
  provider_work_id TEXT NOT NULL,
  title TEXT NOT NULL,
  doi TEXT,
  source_url TEXT NOT NULL CHECK(source_url ~ '^https://'),
  version_label TEXT NOT NULL,
  publication_date DATE,
  affiliation_countries TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX research_study_versions_family ON research_study_versions(family_id);
CREATE INDEX research_study_versions_doi ON research_study_versions(doi);
CREATE TABLE research_discovery_runs (
  id BIGSERIAL PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id),
  plan JSONB NOT NULL,
  checkpoint JSONB NOT NULL DEFAULT '{}',
  provider_usage JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK(status IN ('running','complete','bounded','failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error TEXT
);
CREATE INDEX research_discovery_runs_question ON research_discovery_runs(question_id,started_at DESC);
CREATE TABLE research_discovery_candidates (
  question_id TEXT NOT NULL REFERENCES questions(id),
  version_id TEXT NOT NULL REFERENCES research_study_versions(id),
  routes TEXT[] NOT NULL,
  first_run_id BIGINT NOT NULL REFERENCES research_discovery_runs(id),
  PRIMARY KEY(question_id,version_id)
);
ALTER TABLE research_evidence
  ADD COLUMN study_family_id TEXT REFERENCES research_study_families(id),
  ADD COLUMN study_version_id TEXT REFERENCES research_study_versions(id),
  ADD COLUMN sample TEXT,
  ADD COLUMN exposure TEXT,
  ADD COLUMN outcome TEXT,
  ADD COLUMN estimate NUMERIC,
  ADD COLUMN estimate_unit TEXT,
  ADD COLUMN uncertainty JSONB CHECK(uncertainty IS NULL OR jsonb_typeof(uncertainty)='object'),
  ADD COLUMN identification TEXT,
  ADD COLUMN geography_studied TEXT[],
  ADD COLUMN study_period TEXT,
  ADD CONSTRAINT research_estimate_unit CHECK(estimate IS NULL OR length(btrim(estimate_unit))>0 AND estimate_unit IS NOT NULL);
CREATE INDEX research_evidence_study_version ON research_evidence(study_version_id);
CREATE INDEX research_evidence_study_family ON research_evidence(study_family_id);
COMMENT ON COLUMN research_evidence.geography_studied IS
  'Study population geography, explicitly assessed from the source; never derived from author affiliations. NULL means unassessed.';
CREATE TABLE research_source_refresh_events (
  id BIGSERIAL PRIMARY KEY,
  evidence_id TEXT NOT NULL REFERENCES research_evidence(id),
  source_url TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK(status IN ('baseline','unchanged','changed','inaccessible')),
  observed_hash TEXT,
  baseline_hash TEXT,
  content_type TEXT,
  bytes INTEGER,
  detail TEXT NOT NULL,
  CHECK((status='inaccessible') OR observed_hash ~ '^[a-f0-9]{64}$')
);
CREATE INDEX research_source_refresh_evidence ON research_source_refresh_events(evidence_id,id DESC);
CREATE TRIGGER research_source_refresh_immutable BEFORE UPDATE OR DELETE ON research_source_refresh_events
FOR EACH ROW EXECUTE FUNCTION preserve_research_review_event();

-- Bind source-byte identity and assessed study version, but not fetch timestamps.
CREATE OR REPLACE VIEW research_claim_snapshots AS
SELECT c.*, e.evidence, qs.snapshot AS editorial_snapshot,
  md5(jsonb_build_object('claim',to_jsonb(c),'evidence',e.evidence,'editorial',qs.snapshot)::text) AS fingerprint
FROM research_claims c JOIN question_evidence_snapshots qs ON qs.question_id=c.question_id
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg(to_jsonb(r) || jsonb_build_object(
    'study_version', to_jsonb(v) - 'fetched_at',
    'source_refresh', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object(
      'accessible',f.status<>'inaccessible','observed_hash',f.observed_hash,
      'baseline_hash',f.baseline_hash,'source_url',f.source_url) END
  ) ORDER BY r.id),'[]'::jsonb) AS evidence
  FROM research_evidence r
  LEFT JOIN research_study_versions v ON v.id=r.study_version_id
  LEFT JOIN LATERAL (SELECT * FROM research_source_refresh_events f
    WHERE f.evidence_id=r.id AND f.source_url=r.source_url ORDER BY f.id DESC LIMIT 1) f ON true
  WHERE r.claim_id=c.id
) e ON true;

CREATE VIEW research_review_queue AS
SELECT c.id AS claim_id,c.question_id,c.statement,
  CASE WHEN r.id IS NULL THEN 'draft' ELSE 'stale' END AS reason,
  CASE WHEN r.id IS NULL THEN 'Assess the claim and its source methods; record an exact-version review.'
       ELSE 'Compare the changed source, study version and question evidence with the stored review snapshot.' END AS next_action
FROM research_claim_snapshots c
LEFT JOIN LATERAL (SELECT * FROM research_review_events r WHERE r.claim_id=c.id
  ORDER BY r.reviewed_at DESC,r.id DESC LIMIT 1) r ON true
WHERE r.id IS NULL OR r.fingerprint<>c.fingerprint;
