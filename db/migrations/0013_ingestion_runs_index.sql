-- ============================================================================
-- 0013_ingestion_runs_index.sql — the one index the schema was actually missing
--
-- /api/status runs this on every hit:
--
--     SELECT … FROM ingestion_runs ORDER BY started_at DESC LIMIT 15
--
-- and no index serves it. The two that exist are (job_name, started_at DESC),
-- whose leading column this query does not filter on, and a partial index
-- covering only failed and partial runs. So the planner sorts the whole table.
--
-- That is cheap today at a few hundred rows and gets steadily worse forever:
-- ingestion_runs gains a row per job per run and nothing prunes it, making it
-- the only unbounded table in the schema with an unindexed sort. The rest of
-- this schema is unusually well indexed — every hot read path in the
-- repositories already has one — which is why this is the only addition.
-- ============================================================================

CREATE INDEX ingestion_runs_recent_idx ON ingestion_runs (started_at DESC);

COMMENT ON INDEX ingestion_runs_recent_idx IS
  'Serves the pipeline page''s "recent runs" list. The table grows without '
  'bound, so this sort must not be a seq scan.';
