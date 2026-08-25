-- ============================================================================
-- 0009_questions.sql — the editorial layer
--
-- Until now the dashboard's navigation was the `pillar` enum: adoption,
-- infrastructure, policy, effects. Those are filing categories I invented for
-- the database. Nobody arrives at a website wondering how infrastructure is
-- doing. They arrive wondering whether AI is actually changing anything.
--
-- So questions get their own table rather than a hard-coded map in JavaScript,
-- for three reasons:
--
--   1. The ANSWER is the missing piece. A number without a claim attached is
--      trivia. Those claims are editorial, they are written once and checked,
--      and they need somewhere to live that is versioned with the data rather
--      than buried in a view function.
--
--   2. Two audiences, one product. The same finding has to reach an informed
--      generalist and a researcher without patronising the first or losing the
--      second. That is a text variant, not a second application — so both
--      variants sit side by side on the row.
--
--   3. An LLM will eventually narrate these pages. It must be handed a stored
--      claim and stored numbers and asked only to connect them. Anything it can
--      invent, it eventually will, and a fabricated citation destroys trust
--      faster than a wrong number because it looks authoritative.
--
-- Pillars are not removed. They remain the analytical grouping the ingestion
-- layer uses; questions are the reader-facing one. An indicator can appear
-- under several questions, which is why the join table exists.
-- ============================================================================

/**
 * Where an indicator sits on a page, which drives layout rather than meaning.
 *
 * `hero` is the chart that answers the question — one per page, drawn large.
 * `supporting` is evidence for the same claim. `context` is background a reader
 * may want but that does not bear on the answer, drawn smaller and later.
 */
CREATE TYPE indicator_role AS ENUM ('hero', 'supporting', 'context');


CREATE TABLE questions (
  id            TEXT PRIMARY KEY,          -- 'jobs'
  slug          TEXT NOT NULL UNIQUE,      -- URL segment; kept separate so a
                                           -- question can be reworded without
                                           -- breaking a shared link
  question      TEXT NOT NULL,             -- 'Is it changing work?'
  subtitle      TEXT,

  /**
   * The answer, in two registers.
   *
   * Written by a person, stored as data, never generated at render time. This
   * is the sentence the dashboard has been missing: it is what turns a chart
   * from a fact into a claim a reader can agree or disagree with.
   */
  answer_plain  TEXT,
  answer_expert TEXT,

  /**
   * What we CANNOT tell you. Deliberately a first-class column rather than a
   * footnote, because the limits of this data are large and stating them is
   * what separates a dashboard from a sales pitch. A page with no caveat is
   * usually a page that has not been thought about.
   */
  caveat        TEXT,

  sort_order    SMALLINT NOT NULL DEFAULT 0,
  icon          TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX questions_order_idx ON questions (sort_order) WHERE is_active;

COMMENT ON TABLE questions IS
  'Reader-facing questions. The editorial layer: stored claims, not generated prose.';


CREATE TABLE question_indicators (
  question_id   TEXT NOT NULL REFERENCES questions(id)  ON DELETE CASCADE,
  indicator_id  TEXT NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,

  role          indicator_role NOT NULL DEFAULT 'supporting',
  sort_order    SMALLINT NOT NULL DEFAULT 0,

  /**
   * Why this chart is on this page.
   *
   * The single most important text in the schema after the answer itself. An
   * uncaptioned chart asks the reader to work out both what it shows and
   * whether that matters; most will do neither and will conclude the page is
   * noise. The expert variant states what the series actually measures and
   * where it misleads.
   */
  caption_plain  TEXT,
  caption_expert TEXT,

  /**
   * Which country to draw for a multi-country indicator. Without it a
   * country-dimensioned series renders every country interleaved on one line,
   * which produces a plausible-looking sawtooth rather than an obvious error.
   */
  country_iso3  CHAR(3) REFERENCES countries(iso3),

  /**
   * Group indicators that belong on ONE chart together. Series sharing a
   * chart_group are drawn as multiple lines on a single axis, so they must
   * share a unit — the dual-axis chart is banned throughout this project
   * because it lets any two lines be made to cross wherever the author likes.
   * NULL means the indicator gets its own chart.
   */
  chart_group   TEXT,

  PRIMARY KEY (question_id, indicator_id)
);

CREATE INDEX question_indicators_q_idx
  ON question_indicators (question_id, role, sort_order);
CREATE INDEX question_indicators_i_idx
  ON question_indicators (indicator_id);
CREATE INDEX question_indicators_group_idx
  ON question_indicators (question_id, chart_group)
  WHERE chart_group IS NOT NULL;

COMMENT ON COLUMN question_indicators.chart_group IS
  'Series sharing a group are drawn on one axis and MUST share a unit.';


/**
 * Which populated indicators are not yet on any page.
 *
 * A view rather than a one-off query because this is the check that stops the
 * catalogue silently rotting: an indicator ingested but never surfaced is
 * indistinguishable, from the outside, from one that was never collected. At
 * the time this migration was written, 85 of 89 populated indicators were in
 * exactly that state.
 */
CREATE VIEW orphaned_indicators AS
SELECT i.id,
       i.name,
       i.pillar,
       i.unit,
       i.default_country_iso3,
       count(o.*)::int           AS observation_count,
       max(o.period_start)::text AS latest_period
  FROM indicators i
  JOIN observations o ON o.indicator_id = i.id
 WHERE i.is_active
   AND NOT EXISTS (
     SELECT 1 FROM question_indicators qi WHERE qi.indicator_id = i.id
   )
 GROUP BY i.id
 ORDER BY count(o.*) DESC;

COMMENT ON VIEW orphaned_indicators IS
  'Indicators with data that no question page shows. Should tend to empty.';
