-- A review belongs to an exact claim, evidence set and editorial answer.
-- Revisions are append-only review events; changed content invalidates a match.
CREATE TABLE research_claims (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  statement TEXT NOT NULL CHECK (length(btrim(statement)) > 0),
  claim_type TEXT NOT NULL CHECK (claim_type IN ('descriptive','causal','forecast','mechanism')),
  verdict TEXT NOT NULL CHECK (verdict IN ('supported','qualified','contested','unresolved')),
  geography TEXT NOT NULL CHECK (length(btrim(geography)) > 0),
  period TEXT NOT NULL CHECK (length(btrim(period)) > 0),
  limitations TEXT NOT NULL CHECK (length(btrim(limitations)) > 0),
  change_trigger TEXT NOT NULL CHECK (length(btrim(change_trigger)) > 0)
);
CREATE INDEX research_claims_question ON research_claims(question_id);

CREATE TABLE research_evidence (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES research_claims(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL CHECK (source_url ~ '^https://'),
  source_title TEXT NOT NULL CHECK (length(btrim(source_title)) > 0),
  source_version TEXT NOT NULL CHECK (length(btrim(source_version)) > 0),
  locator TEXT NOT NULL CHECK (length(btrim(locator)) > 0),
  finding TEXT NOT NULL CHECK (length(btrim(finding)) > 0),
  method TEXT NOT NULL CHECK (length(btrim(method)) > 0),
  limitations TEXT NOT NULL CHECK (length(btrim(limitations)) > 0),
  relationship TEXT NOT NULL CHECK (relationship IN ('supports','challenges','context','mixed')),
  relevance TEXT NOT NULL CHECK (length(btrim(relevance)) > 0),
  access_basis TEXT NOT NULL CHECK (access_basis IN ('full_text','abstract','metadata')),
  publication_stage TEXT NOT NULL CHECK (publication_stage IN ('published','working_paper','report','official_data')),
  content_hash TEXT
);
CREATE INDEX research_evidence_claim ON research_evidence(claim_id);

CREATE TABLE research_review_events (
  id BIGSERIAL PRIMARY KEY,
  claim_id TEXT NOT NULL REFERENCES research_claims(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('agent','human')),
  reviewer TEXT NOT NULL CHECK (length(btrim(reviewer)) > 0),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT NOT NULL CHECK (length(btrim(notes)) > 0)
);
CREATE INDEX research_review_events_claim ON research_review_events(claim_id, reviewed_at DESC);

CREATE FUNCTION preserve_research_review_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Research review events are append-only; record a new review';
END;
$$;
CREATE TRIGGER research_review_events_immutable
BEFORE UPDATE OR DELETE ON research_review_events
FOR EACH ROW EXECUTE FUNCTION preserve_research_review_event();

CREATE VIEW research_claim_snapshots AS
SELECT c.*, e.evidence,
       jsonb_build_object('answer_plain', q.answer_plain, 'answer_expert', q.answer_expert,
         'theory', q.theory, 'method', q.method, 'caveat', q.caveat) AS editorial_snapshot,
       md5(jsonb_build_object('claim', to_jsonb(c), 'evidence', e.evidence,
         'editorial', jsonb_build_object('answer_plain', q.answer_plain,
          'answer_expert', q.answer_expert, 'theory', q.theory, 'method', q.method,
          'caveat', q.caveat))::text) AS fingerprint
FROM research_claims c
JOIN questions q ON q.id = c.question_id
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) AS evidence
  FROM research_evidence r WHERE r.claim_id = c.id
) e ON true;

COMMENT ON VIEW research_claim_snapshots IS
  'Content identity, not a quality score. Includes source versions and the editorial answer. A changed snapshot needs a new review.';

-- Keep legacy flags for compatibility, but do not infer a human actor from them.
ALTER TABLE report_figures ADD COLUMN review_actor TEXT
  CHECK (review_actor IN ('agent','human'));
ALTER TABLE question_reading ADD COLUMN review_actor TEXT
  CHECK (review_actor IN ('agent','human'));
COMMENT ON COLUMN report_figures.review_actor IS
  'NULL means actor not recorded. Legacy reviewed does not establish human review.';
COMMENT ON COLUMN question_reading.review_actor IS
  'NULL means actor not recorded. Agent review must never be labelled human review.';
