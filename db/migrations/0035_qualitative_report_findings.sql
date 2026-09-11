-- A statistically insignificant estimate is not an exact zero. A source may
-- report only a qualitative finding or a bound: preserve it without inventing
-- a numeric bar. Existing numeric observations remain unchanged.
ALTER TABLE report_figure_points ALTER COLUMN value DROP NOT NULL;
ALTER TABLE report_figure_points ADD COLUMN value_note TEXT;
ALTER TABLE report_figure_points ADD CONSTRAINT report_point_value_or_finding
  CHECK (value IS NOT NULL OR NULLIF(btrim(value_note), '') IS NOT NULL);
ALTER TABLE report_figure_points ADD CONSTRAINT report_point_nonempty_finding
  CHECK (value_note IS NULL OR length(btrim(value_note)) > 0);
COMMENT ON COLUMN report_figure_points.value_note IS
  'Explicit qualitative finding or numerical qualifier. NULL value means no numeric bar, never zero. Included automatically in question evidence snapshots via to_jsonb(point).';
