-- ============================================================================
-- 0011_lens_news_query.sql — which coverage belongs to which lens
--
-- A lens page has to show the news that bears on it, and something has to
-- decide what "bears on it" means. Three options were available:
--
--   1. Ask a model to classify every article. Costs a call per document,
--      gives a different answer on a re-run, and cannot be reviewed.
--   2. Tag documents by hand. Accurate, and impossible at the volume the
--      feeds produce.
--   3. Store a search per lens, and let Postgres answer it.
--
-- The third is chosen for the same reason the relevance scorer is keyword
-- based rather than a model: the result is deterministic, inspectable, and
-- editable by whoever disagrees with it. If the Work lens is surfacing the
-- wrong stories, the fix is a visible line of text in a seed file, not a
-- prompt to tune.
--
-- The column holds websearch syntax ('jobs OR hiring OR -sport'), parsed by
-- websearch_to_tsquery, which cannot raise on malformed input the way
-- to_tsquery does. It runs against the existing documents_search_idx.
--
-- Nullable on purpose: a lens with no query shows no news section at all,
-- which is honest, rather than showing whatever matched nothing in
-- particular.
-- ============================================================================

ALTER TABLE lenses ADD COLUMN news_query TEXT;

COMMENT ON COLUMN lenses.news_query IS
  'websearch_to_tsquery syntax. Editorial, deterministic, reviewable — the '
  'deliberate alternative to classifying each document with a model.';
