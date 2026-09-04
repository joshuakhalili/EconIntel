-- ============================================================================
-- 0026_documents_source_index.sql — the unindexed foreign key
--
-- `documents.source_id` is `TEXT NOT NULL REFERENCES sources(id) ON DELETE
-- RESTRICT` (0004:25) and has no index. pg_indexes lists ten on this table and
-- none of them leads on source_id; the closest is
-- documents_openalex_citations_idx, which is partial and only covers
-- source_id = 'openalex'.
--
-- WHAT THAT COST, AND WHAT IT STILL COSTS
--
-- /api/status ran a correlated LATERAL per source, so the plan carried
-- `Seq Scan on documents … loops=25` — twenty-five full passes over the table
-- for twenty-five counts. That query has been rewritten to one grouped pass, so
-- the loops are gone and THIS INDEX IS NOT WHAT FIXED IT. Measured on the same
-- database, same session: 295.678 ms before the rewrite, 37.560 ms after, with
-- no index added in between.
--
-- What is left is the reason to index a foreign key at all, which is not about
-- SELECTs. `ON DELETE RESTRICT` means every DELETE or key UPDATE on `sources`
-- makes Postgres prove no document references that row, and with no index that
-- proof is a sequential scan of `documents`. The table has no upper bound —
-- it gains a row per article per ingest — so the cost of retiring a source
-- grows forever. It also makes any future per-source document query cheap
-- rather than linear, which is the shape /pipeline will want the moment it
-- reports documents per source the way it already reports observations.
--
-- 1,455 rows today, so building it is instant. `CREATE INDEX` rather than
-- `CONCURRENTLY` because migrate.js runs each file inside a transaction and
-- CONCURRENTLY cannot run in one.
-- ============================================================================

CREATE INDEX documents_source_idx ON documents (source_id);

COMMENT ON INDEX documents_source_idx IS
  'Indexes the foreign key to sources. ON DELETE RESTRICT means every write to '
  'a sources row scans this table without it, and documents grows without bound.';
