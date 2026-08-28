-- ============================================================================
-- 0012_editorial.sql — what a question page is allowed to say
--
-- WHY
--
-- A question page currently holds three pieces of prose: an answer in two
-- registers, and a caveat. That is enough to state a finding and admit its
-- limits, and not enough to do the thing this project exists to do — show the
-- reasoning. A reader arriving at "Is it changing work?" cannot see what
-- mechanism is being claimed, how it was measured here, how strong the
-- evidence is, when a person last checked it, or what anyone outside this
-- dashboard has found on the same question.
--
-- The caveat has been absorbing all of that. It is the only field where
-- methodology can go, so it does double duty as "here is how this was
-- measured" and "here is where it misleads", which is why it reads as dense.
--
-- WHAT IS DELIBERATELY NOT ADDED
--
-- No `finding` column. `answer_plain` / `answer_expert` already state what the
-- data shows, and a second field for the same job guarantees the two drift
-- apart — the failure this schema keeps designing against.
--
-- The reading takeaways are single-register, unlike every other piece of
-- reader-facing prose here. The two registers exist because the same finding
-- has to reach a generalist and a researcher; a one-sentence summary of
-- somebody else's paper does not have two registers to write, and asking for
-- one would mean the field goes unfilled.
-- ============================================================================

/**
 * How much weight the evidence on a page can carry.
 *
 * Distinct from indicators.confidence_tier, which grades where a NUMBER came
 * from (official statistic, survey, model). This grades what a body of
 * evidence supports, which is a different claim and a more dangerous one to
 * leave implicit — a page with two agreeing series and a page with two
 * conflicting ones look identical otherwise.
 *
 * `contested` is the one that earns this column: it is the honest state for
 * most of this subject right now, and there was previously no way to say it
 * except in prose a reader might skim past.
 */
CREATE TYPE evidence_strength AS ENUM (
  'insufficient',  -- the data cannot answer this yet, and saying so is the finding
  'suggestive',    -- early signs, one measure, or too short a series to lean on
  'consistent',    -- several independent measures point the same way
  'contested'      -- credible sources disagree; the disagreement IS the finding
);

ALTER TABLE questions
  ADD COLUMN theory        TEXT,
  ADD COLUMN method        TEXT,
  ADD COLUMN strength      evidence_strength,
  ADD COLUMN last_reviewed DATE;

COMMENT ON COLUMN questions.theory IS
  'The mechanism being claimed, stated so it could be wrong. Not what the data shows.';
COMMENT ON COLUMN questions.method IS
  'How this page measures it: the comparison, the control, why these series.';
COMMENT ON COLUMN questions.strength IS
  'What the evidence supports. See the evidence_strength enum.';
COMMENT ON COLUMN questions.last_reviewed IS
  'When a person last checked this prose against the data. Numbers update on '
  'ingestion; the sentences around them do not, and a reader deserves to know '
  'how far apart those two have drifted.';


/**
 * Where a source sits.
 *
 * Kept as a plain label rather than a ranking, deliberately. A peer-reviewed
 * paper and a consulting survey are not the same kind of evidence, but this
 * project does not rank them for the reader — it shows both, says which is
 * which, and lets the disagreement be visible. Methodology, motive and data
 * access differ; that is the interesting part, not a scoring problem.
 */
CREATE TYPE reading_kind AS ENUM (
  'academic',    -- peer-reviewed or working paper
  'consulting',  -- McKinsey, PwC, Deloitte, KPMG, EY, Accenture
  'think_tank',  -- Brookings, WEF and similar
  'official',    -- IMF, OECD, BIS, central banks, statistical agencies
  'industry'     -- a company's own published research
);

/** How a source sits relative to the page's own answer. */
CREATE TYPE reading_stance AS ENUM (
  'supports',     -- reaches broadly the same conclusion
  'complicates',  -- agrees in direction, disagrees on size or mechanism
  'contradicts',  -- reaches the opposite conclusion
  'background'    -- context or method rather than a competing finding
);

/**
 * External reading, attached to a question or to a whole lens.
 *
 * This is where the outside literature lands: the academic corpus and the
 * consulting and institutional reports. Only the citation and a short
 * takeaway are stored, never the document — most of these are free to read
 * and link but not to redistribute, and this repository is public.
 *
 * Attaching to EITHER a question or a lens, exactly one, because the two
 * genuinely occur: a paper on youth employment belongs to one question, while
 * the BIS chapter on AI capex circular financing is about the whole
 * Investment & Capital lens and would be arbitrary to file under either of
 * its questions.
 */
CREATE TABLE question_reading (
  id           BIGSERIAL PRIMARY KEY,
  question_id  TEXT REFERENCES questions(id) ON DELETE CASCADE,
  lens_id      TEXT REFERENCES lenses(id)    ON DELETE CASCADE,

  title        TEXT NOT NULL,
  publisher    TEXT NOT NULL,
  published    DATE,
  url          TEXT NOT NULL,

  kind         reading_kind   NOT NULL,
  stance       reading_stance NOT NULL DEFAULT 'background',

  /**
   * What this source found, in one or two sentences, in its own terms.
   *
   * Written by a person from the source itself — the same rule as every other
   * claim here. A takeaway that paraphrases an abstract nobody opened is worse
   * than no takeaway, because it looks like it was checked.
   */
  takeaway     TEXT,

  sort_order   SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT question_reading_one_parent
    CHECK (num_nonnulls(question_id, lens_id) = 1),

  -- The same report can sit on several pages, but not twice on one.
  CONSTRAINT question_reading_unique_placement
    UNIQUE NULLS NOT DISTINCT (question_id, lens_id, url)
);

CREATE INDEX question_reading_question_idx
  ON question_reading (question_id, sort_order) WHERE question_id IS NOT NULL;
CREATE INDEX question_reading_lens_idx
  ON question_reading (lens_id, sort_order) WHERE lens_id IS NOT NULL;

COMMENT ON TABLE question_reading IS
  'Citations and one-line takeaways for outside literature. Never the documents '
  'themselves — link and cite, do not redistribute.';
COMMENT ON COLUMN question_reading.stance IS
  'How this source sits against our answer. Disagreement is shown, not resolved.';


/**
 * Questions whose prose has fallen behind their data.
 *
 * A view rather than a query someone has to remember, for the same reason
 * orphaned_indicators is one: the failure is silent. A page keeps rendering a
 * confident sentence long after the series under it moved, and nothing
 * anywhere reports that. Six months is arbitrary but a threshold that exists
 * beats a judgement nobody makes.
 */
CREATE VIEW stale_questions AS
SELECT q.id,
       q.slug,
       q.question,
       q.last_reviewed,
       max(o.period_start)::text AS latest_observation
  FROM questions q
  JOIN question_indicators qi ON qi.question_id = q.id
  JOIN observations o         ON o.indicator_id = qi.indicator_id
 WHERE q.is_active
 GROUP BY q.id
HAVING q.last_reviewed IS NULL
    OR q.last_reviewed < current_date - INTERVAL '6 months'
 ORDER BY q.last_reviewed NULLS FIRST;

COMMENT ON VIEW stale_questions IS
  'Question pages not reviewed in six months. Prose does not update itself when '
  'ingestion moves the numbers underneath it.';
