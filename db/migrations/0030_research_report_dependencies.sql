-- Extend 0029 without changing the view's public columns or its dependants.
-- A question inherits its lens's readings and report evidence. Conservatively
-- include all placements, even when a duplicate URL is collapsed in the UI.
CREATE OR REPLACE VIEW question_evidence_snapshots AS
SELECT q.id AS question_id,
  jsonb_build_object(
    'answer_plain', q.answer_plain, 'answer_expert', q.answer_expert,
    'theory', q.theory, 'method', q.method, 'caveat', q.caveat,
    'chart_placements', placements.snapshot,
    'observations_fingerprint', facts.fingerprint,
    'readings', readings.snapshot,
    'report_figures', figures.snapshot
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
) facts ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb) AS snapshot
  FROM question_reading r WHERE r.question_id = q.id OR r.lens_id = q.lens_id
) readings ON true
LEFT JOIN LATERAL (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'figure', to_jsonb(f), 'points', points.snapshot
  ) ORDER BY f.id), '[]'::jsonb) AS snapshot
  FROM report_figures f
  LEFT JOIN LATERAL (
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.series, p.label), '[]'::jsonb) AS snapshot
    FROM report_figure_points p WHERE p.figure_id = f.id
  ) points ON true
  WHERE f.question_id = q.id OR f.lens_id = q.lens_id
) figures ON true;
