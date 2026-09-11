-- Conservative dependency boundary: a review covers the question's plotted
-- evidence too. Changed values/flags/captions invalidate it, unchanged fetches
-- do not. Hash the scoped observations rather than storing duplicate histories.
CREATE VIEW question_evidence_snapshots AS
SELECT q.id AS question_id,
  jsonb_build_object(
    'answer_plain', q.answer_plain, 'answer_expert', q.answer_expert,
    'theory', q.theory, 'method', q.method, 'caveat', q.caveat,
    'chart_placements', placements.snapshot,
    'observations_fingerprint', facts.fingerprint
  ) AS snapshot
FROM questions q
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg(to_jsonb(qi) ORDER BY qi.indicator_id, qi.country_iso3), '[]'::jsonb) AS snapshot
  FROM question_indicators qi WHERE qi.question_id = q.id
) placements ON true
LEFT JOIN LATERAL (
  SELECT md5(COALESCE(string_agg(jsonb_build_array(
    o.indicator_id, o.country_iso3, o.industry_code, o.company_id,
    o.period_start, o.period_end, o.value, o.value_status, o.source_ref,
    i.unit, i.cadence, i.description
  )::text, '|' ORDER BY o.indicator_id, o.period_start, o.country_iso3,
     o.industry_code, o.company_id), '')) AS fingerprint
  FROM observations o JOIN indicators i ON i.id = o.indicator_id
  WHERE EXISTS (
    SELECT 1 FROM question_indicators qi
    WHERE qi.question_id = q.id AND qi.indicator_id = o.indicator_id
      AND (NOT i.has_country_dim OR o.country_iso3 = COALESCE(qi.country_iso3, i.default_country_iso3))
  )
) facts ON true;

CREATE OR REPLACE VIEW research_claim_snapshots AS
SELECT c.*, e.evidence, qs.snapshot AS editorial_snapshot,
       md5(jsonb_build_object('claim', to_jsonb(c), 'evidence', e.evidence,
         'editorial', qs.snapshot)::text) AS fingerprint
FROM research_claims c
JOIN question_evidence_snapshots qs ON qs.question_id = c.question_id
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) AS evidence
  FROM research_evidence r WHERE r.claim_id = c.id
) e ON true;
