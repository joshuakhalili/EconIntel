-- ============================================================================
-- 0027_research_triage.sql — the missing half of the OpenAlex corpus
--
-- 0022 gave the 934-paper corpus a usable shape: `research_candidates` names
-- the fields a person needs to choose between papers, and `already_cited`
-- tells them what has been used. What it deliberately did not build is the
-- decision itself, and the consequence is now measurable: `already_cited` is
-- FALSE on all 934 rows, no code anywhere reads the view, and the reading list
-- across every live page is 42 items of consulting decks, multilateral reports
-- and one AI Index chapter, with not a single primary econometric paper on it.
--
-- Four active pages — clerical, entry-level, jobs, vacancies — are labelled
-- `contested` on the strength of methodological disagreement in the
-- literature, and `entry-level` cites its central finding at second hand
-- through two different summaries that give two different numbers. The
-- dashboard argues about identification strategy while citing only summaries
-- of the papers that do the identifying.
--
-- WHAT WAS MISSING WAS NOT A COLUMN, IT WAS A RECORD OF A DECISION
--
-- Working through a thousand papers means rejecting almost all of them, and a
-- rejection nobody wrote down is a rejection the next person has to make
-- again. `already_cited` is a derived fact — a URL match against
-- question_reading — so it can say "this ended up cited" and can never say
-- "this was read and set aside, because …". Those are different statements and
-- only the second compounds.
--
-- WHY A SIDE TABLE RATHER THAN COLUMNS ON `documents`
--
-- The same shape 0022 chose for its metadata — but not for the reason 0022
-- gave, because that reason was never true here. 0022 justified the split on
-- the size of the table ("77,000 rows to serve one source", twice). Measured
-- against the live database on 2026-09-04, `documents` holds 1,455 rows:
-- OpenAlex 934, seven news feeds 499, the Federal Reserve 22.
--
-- The argument survives without the inflated figure, and is better stated as a
-- direction than as a size. A triage column is meaningless for the 521 rows
-- that are not corpus papers, and `documents` is the table every ingest
-- appends to — the news feeds alone add rows daily — so the permanently-NULL
-- share only ever widens, while this table grows only with work actually done.
--
-- 0022 is applied and checksum-locked, so its two occurrences of that figure
-- cannot be corrected in place; they are wrong and this is the note saying so.
--
-- A side table keyed on document_id also makes the absence of a row mean
-- something precise and correct: not yet looked at. The view coalesces that to
-- 'unreviewed' so a caller never has to reason about NULL.
--
-- WHY THE DESTINATION IS RECORDED HERE AND THE CITATION STILL LIVES IN
-- question_reading
--
-- Promotion is not a copy. `question_reading` demands a takeaway written by
-- somebody who opened the document, a `takeaway_ref` locating it, a `stance`
-- against this site's own answer and a `takeaway_source` saying whether a
-- person checked it — none of which is a property of the candidate and none of
-- which a pipeline may fill (0012 and 0014 both say so, at length). So this
-- table records that a decision was made and where it went; the citation
-- itself is still written by hand into question_reading. `promoted_to_*` is
-- the audit trail from corpus to page, not a foreign key to the citation.
--
-- WHAT THIS DOES NOT DO
--
-- It does not rank papers, score them, or infer a stance. It does not make the
-- corpus reader-facing — that is a separate decision recorded in STATUS.md.
-- And it applies to `documents`, so a paper that is NOT in the OpenAlex corpus
-- (the Stanford Digital Economy Lab working paper `entry-level` needs is not)
-- can still be cited: question_reading has never required a candidate row and
-- still does not. Triage is a worklist for the corpus, not a gate on citation.
-- ============================================================================

/**
 * Where a candidate stands.
 *
 * Four values, and the two in the middle carry the weight:
 *
 * `unreviewed`  — nobody has looked. This is the absence of a row, surfaced by
 *                 the view as a value so callers do not branch on NULL.
 * `shortlisted` — read and worth citing, but not yet citable here. The usual
 *                 reason is access: the published version is paywalled and the
 *                 open version is a different draft with different numbers.
 *                 `reason` must say which, because "come back to this" without
 *                 the blocker is the same as no note at all.
 * `promoted`    — a citation now exists on a page. `promoted_to_question` or
 *                 `promoted_to_lens` says where.
 * `rejected`    — read and set aside. `reason` is what stops it, in a sentence
 *                 that saves the next reader the same twenty minutes.
 */
CREATE TYPE research_triage_status AS ENUM (
  'unreviewed',
  'shortlisted',
  'promoted',
  'rejected'
);

/**
 * One row per candidate somebody has made a decision about.
 *
 * No row means unreviewed. That is why there is no backfill inserting 934
 * 'unreviewed' rows: it would make the table's size a measure of the corpus
 * rather than a measure of the work done, and `count(*)` here should answer
 * "how far has this got".
 */
CREATE TABLE research_triage (
  document_id  BIGINT PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,

  status       research_triage_status NOT NULL,

  /* Required for every status. A decision with no reason is not a decision
     anybody else can build on, and this table exists so the reading is not
     repeated. */
  reason       TEXT NOT NULL CHECK (length(btrim(reason)) > 0),

  /* Who decided, in whatever form identifies them later — a name, or the agent
     and the date it ran. Recorded because `promoted` rows become citations on
     a public page, and the provenance of that decision should be as traceable
     as the provenance of the number in it. */
  reviewer     TEXT NOT NULL CHECK (length(btrim(reviewer)) > 0),
  decided_on   DATE NOT NULL,

  /* Where a promoted candidate went. Exactly one, or neither — the same
     either-a-question-or-a-lens shape question_reading and report_figures use,
     for the same reason. */
  promoted_to_question TEXT REFERENCES questions(id) ON DELETE SET NULL,
  promoted_to_lens     TEXT REFERENCES lenses(id)    ON DELETE SET NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  /* A promotion has to say where it went, and nothing else may claim one.
     Without this the status is decorative: a row could read 'promoted' with no
     page behind it and nobody would find out. */
  CONSTRAINT research_triage_promotion_has_a_home CHECK (
    (status =  'promoted' AND num_nonnulls(promoted_to_question, promoted_to_lens) = 1)
    OR
    (status <> 'promoted' AND num_nonnulls(promoted_to_question, promoted_to_lens) = 0)
  ),

  /* 'unreviewed' is what the ABSENCE of a row means. Storing it would create
     two ways to say the same thing and a query that has to handle both. */
  CONSTRAINT research_triage_no_stored_unreviewed CHECK (status <> 'unreviewed')
);

CREATE INDEX research_triage_status_idx ON research_triage (status);

COMMENT ON TABLE research_triage IS
  'The decision trail over the OpenAlex corpus: what was read, what was set '
  'aside and why, and what became a citation. Absence of a row means nobody '
  'has looked yet.';

/**
 * The candidate view, now carrying its triage state.
 *
 * CREATE OR REPLACE rather than DROP + CREATE: the existing columns keep their
 * names, types and order exactly as 0022 defined them, and the three triage
 * columns are appended, which is the only shape Postgres will replace a view
 * into. Nothing that selects from this view today can break.
 */
CREATE OR REPLACE VIEW research_candidates AS
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
                                                AS already_cited,
       COALESCE(t.status, 'unreviewed')         AS triage_status,
       t.reason                                 AS triage_reason,
       t.decided_on                             AS triage_decided_on
  FROM documents d
  LEFT JOIN research_triage t ON t.document_id = d.id
 WHERE d.source_id = 'openalex';

COMMENT ON VIEW research_candidates IS
  'The OpenAlex corpus with its metadata named and its triage state attached. '
  'Which of them is cited, against which question, with what stance and what '
  'takeaway, is decided by a person who has read the paper — `triage_status` '
  'records that that decision happened and `triage_reason` says what it was.';

/**
 * What is left to read.
 *
 * The sibling of `unreviewed_figures` and `unreviewed_takeaways`, and it
 * exists for the same reason those do: "what has this project not got to yet"
 * should be one query rather than a remembered WHERE clause. Ordered by
 * citations so the worklist starts where the literature has already voted,
 * which is an ordering and not a quality claim — 0022's caveat about young
 * papers with low counts applies here unchanged.
 */
CREATE VIEW untriaged_research AS
SELECT c.id,
       c.title,
       c.author,
       c.published,
       c.doi,
       c.venue,
       c.cited_by_count,
       c.is_open_access,
       c.open_access_url,
       c.strand
  FROM research_candidates c
 WHERE c.triage_status = 'unreviewed'
 ORDER BY c.cited_by_count DESC NULLS LAST, c.published DESC;

COMMENT ON VIEW untriaged_research IS
  'Corpus papers nobody has made a decision about yet. Should shrink as the '
  'reading is done. It will never reach zero and is not meant to.';
