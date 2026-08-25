-- ============================================================================
-- 0010_lenses.sql — lenses above questions
--
-- Questions were the top level, and that was one level too flat. The way anyone
-- actually approaches this subject is through a LENS: money, work, physical
-- build-out, government. Within a lens, questions carry the argument.
--
-- The distinction matters most for the market data. Thirty-four thousand
-- commodity and price observations were seeded and had nowhere to go, and the
-- obvious home — a "Finance" page that is a wall of tickers — is the wrong
-- answer. A copper price means nothing on its own. Next to R&D spending, data
-- centre construction and the news from that month, it is evidence.
--
-- So `lens_tickers` carries a `why` per placement rather than per indicator:
-- the same copper series appears under Finance because it is an input cost in
-- capital formation, and under Infrastructure because it is physically what a
-- data centre is wired with. Same number, two arguments.
-- ============================================================================

CREATE TABLE lenses (
  id            TEXT PRIMARY KEY,          -- 'finance'
  slug          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,             -- 'Money'
  subtitle      TEXT,

  /**
   * What this lens claims, in both registers. A lens page opens with its own
   * thesis and then lets the questions beneath it do the arguing — so a reader
   * who reads nothing else still leaves with the point.
   */
  thesis_plain  TEXT,
  thesis_expert TEXT,

  sort_order    SMALLINT NOT NULL DEFAULT 0,
  icon          TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX lenses_order_idx ON lenses (sort_order) WHERE is_active;


-- Nullable: questions exist before lenses are assigned, and a question that
-- outgrows its lens should be movable without a data migration.
ALTER TABLE questions
  ADD COLUMN lens_id TEXT REFERENCES lenses(id) ON DELETE SET NULL;

CREATE INDEX questions_lens_idx ON questions (lens_id, sort_order) WHERE is_active;


-- ---------------------------------------------------------------------------
-- Tickers, placed in context.
--
-- Not a table of "financial instruments". A table of placements: this number,
-- on this lens, for this stated reason. Without the reason a ticker strip is
-- decoration, and decoration on a dashboard that claims to be evidence is worse
-- than an empty space.
-- ---------------------------------------------------------------------------
CREATE TABLE lens_tickers (
  lens_id       TEXT NOT NULL REFERENCES lenses(id)     ON DELETE CASCADE,
  indicator_id  TEXT NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,

  sort_order    SMALLINT NOT NULL DEFAULT 0,
  label         TEXT,          -- short form for a strip: 'Copper', not the full name

  /**
   * Why this series belongs on this lens. Shown on hover and to screen readers,
   * so the strip can be read as argument rather than ornament.
   */
  why           TEXT NOT NULL,

  PRIMARY KEY (lens_id, indicator_id)
);

CREATE INDEX lens_tickers_order_idx ON lens_tickers (lens_id, sort_order);

COMMENT ON TABLE lens_tickers IS
  'Placements, not instruments. The same series may appear on several lenses '
  'with a different reason on each.';


/**
 * Lenses with nothing on them.
 *
 * The counterpart to `orphaned_indicators`: that view catches data with no
 * page, this one catches a page with no data. A lens carrying no questions
 * renders as an empty shell and is worse than one that does not exist.
 */
CREATE VIEW empty_lenses AS
SELECT l.id,
       l.name,
       count(DISTINCT q.id)::int  AS question_count,
       count(DISTINCT t.indicator_id)::int AS ticker_count
  FROM lenses l
  LEFT JOIN questions q     ON q.lens_id = l.id AND q.is_active
  LEFT JOIN lens_tickers t  ON t.lens_id = l.id
 WHERE l.is_active
 GROUP BY l.id
HAVING count(DISTINCT q.id) = 0 OR count(DISTINCT t.indicator_id) = 0;
