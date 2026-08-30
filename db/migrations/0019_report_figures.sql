-- ============================================================================
-- 0019_report_figures.sql — numbers read out of the literature, chartable
--
-- WHY THIS IS NOT `observations`
--
-- `indicators` and `observations` hold time series ingested from an API on a
-- schedule: one value per period, refetchable, and correct-by-reingestion if
-- the publisher revises it. Almost nothing in a consulting or institutional
-- report is shaped like that. "Share of firms using AI, by business function"
-- is a cross-section. "Wage premium by exposure quartile" is a comparison
-- between groups. Neither has a period, neither will ever be refetched, and
-- forcing them into a time-series table would mean inventing a date.
--
-- So they live here, and the difference in table is the difference in kind: an
-- observation is measured by a statistical agency and re-read every night; a
-- figure is read once, by hand or by an agent, off a specific page of a
-- specific document, and never changes again.
--
-- WHY EVERY FIGURE CARRIES A QUOTE AND A PAGE
--
-- 0014 established the rule for prose takeaways: an extracted claim is only
-- defensible because a reader can go and settle it, so the page reference is
-- required rather than encouraged. The same rule applies with more force to
-- numbers, because a number looks more authoritative than a sentence and is
-- harder to sanity-check.
--
-- `quote` is the verbatim line from the document that carries the values, and
-- it is NOT NULL. `page_ref` is NOT NULL. A figure that cannot say where it
-- came from does not go on the site — enforced by the column definitions
-- rather than by anyone remembering.
--
-- WHY `note` IS NOT NULL
--
-- Every one of these is a survey of executives, a model simulation, or a
-- scenario. Rendered without that context they read as measurements of the
-- economy, which they are not. The caveat is not optional on a question page
-- and it is not optional here.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- No confidence score, no extraction model name — same reasoning as 0014. The
-- distinction a reader needs is binary: has a person checked this page or not.
-- ============================================================================

/**
 * What the horizontal axis means.
 *
 * `category` — a breakdown by industry, country, function or group. Draws as
 *              bars, always from a zero baseline: a truncated bar chart is the
 *              single most misleading thing this project could ship, because a
 *              bar's LENGTH is the encoding and cutting the axis rescales the
 *              claim itself.
 * `year`     — labels are years or periods, and the shape over time is the
 *              point. Still bars rather than a line: these are a handful of
 *              annual points from a report, not a series, and drawing them as
 *              a line would imply the values between them are known.
 */
CREATE TYPE figure_axis AS ENUM ('category', 'year');

CREATE TABLE report_figures (
  id           TEXT PRIMARY KEY,

  /* Placement, exactly one, matching question_reading's rule and for the same
     reason: a figure on AI capex belongs to a lens, one on graduate hiring
     belongs to a question. */
  question_id  TEXT REFERENCES questions(id) ON DELETE CASCADE,
  lens_id      TEXT REFERENCES lenses(id)    ON DELETE CASCADE,

  publisher    TEXT NOT NULL,
  source_title TEXT NOT NULL,
  source_url   TEXT NOT NULL,
  published    DATE,

  title        TEXT NOT NULL,
  /* Who was counted, where, and over what period. Required, because a chart
     titled "AI adoption" with no population is a claim about everyone. */
  subtitle     TEXT NOT NULL,

  unit         TEXT NOT NULL,
  unit_symbol  TEXT,
  decimals     SMALLINT NOT NULL DEFAULT 0 CHECK (decimals BETWEEN 0 AND 4),
  axis_kind    figure_axis NOT NULL,

  /* What it cannot show. See the header. */
  note         TEXT NOT NULL,

  /* The two columns that make extraction acceptable rather than merely fast. */
  page_ref     TEXT NOT NULL,
  quote        TEXT NOT NULL,

  /* Reuses 0014's enum on purpose: it is the same distinction, it is rendered
     the same way, and two enums meaning "a person checked it" would drift. */
  figure_source takeaway_source NOT NULL DEFAULT 'extracted',

  sort_order   SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT report_figures_one_parent
    CHECK (num_nonnulls(question_id, lens_id) = 1)
);

CREATE INDEX report_figures_question_idx
  ON report_figures (question_id, sort_order) WHERE question_id IS NOT NULL;
CREATE INDEX report_figures_lens_idx
  ON report_figures (lens_id, sort_order) WHERE lens_id IS NOT NULL;

/**
 * One bar.
 *
 * `series` is '' for a plain breakdown and carries a group name when the chart
 * compares two of them — 2024 against 2026, say. It is part of the key rather
 * than nullable so a grouped chart cannot half-exist.
 *
 * `value` is NUMERIC, not DOUBLE PRECISION: these are printed decimal figures
 * off a page, and binary floating point would render 42.1 as 42.099999999.
 */
CREATE TABLE report_figure_points (
  figure_id  TEXT NOT NULL REFERENCES report_figures(id) ON DELETE CASCADE,
  series     TEXT NOT NULL DEFAULT '',
  label      TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  value      NUMERIC NOT NULL,

  PRIMARY KEY (figure_id, series, label)
);

CREATE INDEX report_figure_points_order_idx
  ON report_figure_points (figure_id, sort_order);

COMMENT ON TABLE report_figures IS
  'Chartable numbers read off a named page of a named report. Never ingested, '
  'never refetched — see the note in the migration for why these are not '
  'observations.';
COMMENT ON COLUMN report_figures.quote IS
  'The verbatim line from the document carrying these values. Required: the '
  'whole reason an extracted figure may be shown is that a reader can check it.';
COMMENT ON COLUMN report_figures.figure_source IS
  'Whether a person has verified this against the page. An unverified figure '
  'must never render as a verified one.';

/**
 * Figures no person has checked yet.
 *
 * The sibling of `unreviewed_takeaways`, and it exists for the same reason: the
 * question "what on this site is running ahead of its own review process"
 * should be one query, not a remembered WHERE clause.
 */
CREATE VIEW unreviewed_figures AS
SELECT f.id,
       f.publisher,
       f.title,
       f.page_ref,
       f.source_url,
       COALESCE(f.question_id, f.lens_id) AS placed_on,
       count(p.*)::int                    AS points
  FROM report_figures f
  LEFT JOIN report_figure_points p ON p.figure_id = f.id
 WHERE f.figure_source = 'extracted'
 GROUP BY f.id
 ORDER BY f.publisher, f.id;

COMMENT ON VIEW unreviewed_figures IS
  'Extracted figures awaiting human verification. Shown to readers, marked as '
  'unchecked — this view is the worklist for checking them.';
