-- ============================================================================
-- 0014_reading_provenance.sql — say how a takeaway was produced
--
-- WHY
--
-- `question_reading.takeaway` has sat NULL on all twelve citations since
-- 0012, on a deliberate rule: a takeaway is a claim about what a source found,
-- and 014_reading.sql's header says filling one in "means reading the reports,
-- which is a separate job done with a person". That rule is right, and the
-- reason it is right is stated there too — "a takeaway paraphrased from an
-- abstract nobody opened is worse than none, because it looks like it was
-- checked."
--
-- The takeaways are now being filled by extraction: an agent reads the actual
-- PDF and reports what a specific page says, with the page number. That is a
-- genuinely different act from paraphrasing a title, and the earlier decision
-- record (CONCEPT-GRILL-LOG, Q13) already anticipated it — "extraction is
-- Claude-assisted... into seed data".
--
-- But it is also not the same as a person having read it. The README promises
-- readers that every claim here is written by a person and dated, and a
-- machine-extracted takeaway rendered identically to a human-written one would
-- quietly make that promise false. The failure mode is exactly the one the
-- 014 header names: it would LOOK like it was checked.
--
-- So the fix is not to withhold the takeaway. It is to carry how it was
-- produced, alongside it, and render that. A reader can then see the finding,
-- see the page it came from, and see that no human has verified it yet — which
-- is more information than a blank field gave them, and more honest than an
-- unmarked one would.
--
-- Promoting one to `reviewed` is then a single UPDATE, not a rewrite.
--
-- WHAT IS DELIBERATELY NOT ADDED
--
-- No `extracted_by` / model-name column. It would date instantly, it invites
-- treating one model's output as more trustworthy than another's, and the
-- distinction that matters to a reader is binary: has a person checked this or
-- not.
--
-- No `confidence` score. The extraction process produces one, and it is useful
-- while reviewing, but a number a reader cannot audit is worse than the page
-- reference, which they can.
-- ============================================================================

/**
 * Whether a person has verified this takeaway against the source.
 *
 * `extracted` — read out of the document by a machine, page reference given,
 *               not yet checked by a person. Rendered with that stated.
 * `reviewed`  — a person has read the cited page and confirmed the takeaway.
 */
CREATE TYPE takeaway_source AS ENUM ('extracted', 'reviewed');

ALTER TABLE question_reading
  ADD COLUMN takeaway_source takeaway_source,
  ADD COLUMN takeaway_ref    TEXT;

COMMENT ON COLUMN question_reading.takeaway_source IS
  'How the takeaway was produced. NULL where there is no takeaway. '
  'Rendered to the reader — an unverified claim must not look verified.';

COMMENT ON COLUMN question_reading.takeaway_ref IS
  'Where in the source the takeaway came from — page numbers, or a named '
  'section. Required for an extracted takeaway: the whole reason extraction is '
  'acceptable is that a reader can go and check it.';

/*
 * A takeaway must say where it came from, and a provenance must have something
 * to describe. Enforced rather than documented, because the one thing that
 * makes an unreviewed takeaway defensible is that it is checkable — a takeaway
 * with no reference is exactly the "looks like it was checked" failure.
 */
ALTER TABLE question_reading
  ADD CONSTRAINT question_reading_takeaway_provenance
    CHECK (
      (takeaway IS NULL AND takeaway_source IS NULL)
      OR (takeaway IS NOT NULL AND takeaway_source IS NOT NULL AND takeaway_ref IS NOT NULL)
    );

/**
 * Citations carrying a claim no person has checked yet.
 *
 * The sibling of `stale_questions`: both answer "what on this site is running
 * ahead of its own review process". Kept as a view so the answer is one query
 * rather than a remembered WHERE clause.
 */
CREATE VIEW unreviewed_takeaways AS
SELECT r.id,
       r.title,
       r.publisher,
       r.takeaway_ref,
       COALESCE(q.slug, l.slug) AS page,
       CASE WHEN r.question_id IS NULL THEN 'lens' ELSE 'question' END AS scope
  FROM question_reading r
  LEFT JOIN questions q ON q.id = r.question_id
  LEFT JOIN lenses    l ON l.id = r.lens_id
 WHERE r.takeaway_source = 'extracted'
 ORDER BY r.publisher;

COMMENT ON VIEW unreviewed_takeaways IS
  'Takeaways extracted from a source but not yet verified by a person. '
  'Should tend to empty as the reports are read.';
