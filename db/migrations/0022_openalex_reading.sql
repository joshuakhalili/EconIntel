-- ============================================================================
-- 0022_openalex_reading.sql — making a 1,000-paper corpus usable by a person
--
-- WHY THERE ARE NO NEW COLUMNS
--
-- The academic corpus lands in `documents`, which already has every field it
-- needs: title, author, the abstract verbatim in `summary`, a resolving URL,
-- a publication date, and `raw` for the provider's own structured metadata.
-- Adding `doi`, `citations` and `venue` columns to a table that also holds
-- Guardian articles and 10-K filings would put four permanently-NULL columns on
-- 77,000 rows to serve one source.
--
-- What was actually missing is the other half: a person cannot USE a thousand
-- papers stored as JSONB. Deciding which paper to cite on a question page means
-- ranking by citations, filtering to what is open-access, seeing the venue, and
-- knowing what has already been used. Every one of those is a `raw->>'…'`
-- expression somebody has to remember and get right, and the shape of `raw` is
-- an adapter's private business that this view is the only place to depend on.
--
-- So: a view that names the fields, and one index so ordering by citations does
-- not scan the whole documents table.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- It does not insert anything into `question_reading`, and it does not rank
-- papers by fit to a question. `question_reading` carries a `stance` — whether
-- a source supports, complicates or contradicts THIS site's answer — and a
-- `takeaway` that 0012 and 0014 both insist is written by a person who opened
-- the document. A pipeline that guessed either would produce a reading list
-- that looks checked and is not, which is the precise failure those two
-- migrations were written to prevent.
--
-- `already_cited` is matched on URL because that is what `question_reading`
-- stores and what its unique constraint is built on. It is a convenience for
-- whoever is working through the corpus, not a foreign key: a paper cited from
-- its publisher's landing page rather than its DOI will not match, and that is
-- a false negative rather than a wrong claim.
-- ============================================================================

/**
 * One row per work in the OpenAlex corpus, with the provider's metadata lifted
 * out of `raw` and named.
 *
 * Ordered by citations descending by default. That is an ordering, not a
 * quality claim — a 2026 working paper with two citations may be the best thing
 * in the corpus, and the `published` column is there so a reader of this view
 * can see when a low count is simply youth.
 */
CREATE VIEW research_candidates AS
SELECT d.id,
       d.title,
       d.author,
       d.published_at::date                     AS published,
       d.url,
       d.summary                                AS abstract,
       d.raw ->> 'openalex_id'                  AS openalex_id,
       d.raw ->> 'doi'                          AS doi,
       (d.raw ->> 'cited_by_count')::int        AS cited_by_count,
       (d.raw ->> 'is_oa')::boolean             AS is_open_access,
       d.raw ->> 'oa_url'                       AS open_access_url,
       d.raw ->> 'venue'                        AS venue,
       d.raw ->> 'venue_type'                   AS venue_type,
       d.raw ->> 'publisher'                    AS publisher,
       d.raw ->> 'topic'                        AS topic,
       d.raw ->> 'strand'                       AS strand,
       EXISTS (SELECT 1 FROM question_reading r WHERE r.url = d.url)
                                                AS already_cited
  FROM documents d
 WHERE d.source_id = 'openalex';

COMMENT ON VIEW research_candidates IS
  'The OpenAlex corpus with its metadata named. Candidates for question_reading '
  '— which of them is cited, against which question, with what stance and what '
  'takeaway, is decided by a person who has read the paper.';

/**
 * Citation-ordered access to the corpus without scanning `documents`.
 *
 * Partial on source_id because the expression is meaningless for every other
 * source: an RSS article's `raw` has no cited_by_count, and an index over
 * 77,000 NULLs to serve a thousand rows is the wrong shape.
 */
CREATE INDEX documents_openalex_citations_idx
  ON documents (((raw ->> 'cited_by_count')::int) DESC NULLS LAST, published_at DESC)
  WHERE source_id = 'openalex';
