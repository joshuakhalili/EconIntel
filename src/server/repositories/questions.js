/**
 * The editorial layer — reading side.
 *
 * A question page is an ordered set of charts with stored prose attached. This
 * module resolves that: the question, its answer in both registers, and every
 * indicator placed on it with the caption explaining why it is there.
 *
 * The prose is READ, never generated here. That distinction is the whole point
 * of storing it — an LLM narrating these pages later is handed these rows and
 * asked to connect them, not to invent them.
 */

import { query } from '../db/pool.js';

/** All active questions, for navigation. */
export async function listQuestions() {
  const { rows } = await query(
    `SELECT q.id, q.slug, q.question, q.subtitle, q.icon, q.sort_order, q.lens_id,
            count(qi.*)::int                                     AS indicator_count,
            count(*) FILTER (WHERE qi.role = 'hero')::int         AS hero_count
       FROM questions q
       LEFT JOIN question_indicators qi ON qi.question_id = q.id
      WHERE q.is_active
      GROUP BY q.id
      ORDER BY q.sort_order`
  );
  return rows;
}

/**
 * One question with every indicator placed on it.
 *
 * Indicator metadata is joined here rather than fetched per chart by the client,
 * because a page with eighteen charts would otherwise open with eighteen
 * requests before drawing anything. The observations themselves are still
 * fetched separately — they are large, and the client needs the page structure
 * first in order to know what to ask for.
 */
export async function getQuestion(slug) {
  const { rows: questions } = await query(
    `SELECT q.id, q.slug, q.question, q.subtitle, q.answer_plain, q.answer_expert,
            q.caveat, q.icon, q.lens_id,
            q.theory, q.method, q.strength, q.last_reviewed::text,
            l.name AS lens_name, l.slug AS lens_slug
       FROM questions q
       LEFT JOIN lenses l ON l.id = q.lens_id AND l.is_active
      WHERE q.slug = $1 AND q.is_active`,
    [slug]
  );
  if (questions.length === 0) return null;

  /**
   * Outside literature for this page, plus anything filed against its parent
   * lens.
   *
   * Both are returned because a source can legitimately sit at either level —
   * a paper on youth employment belongs to one question, an institutional
   * report on AI capex belongs to the whole lens — and a reader does not care
   * which table row it hangs from. `scope` is carried through so the UI can
   * say "on this question" versus "on this lens" rather than implying the
   * lens-level source was written about this question specifically.
   *
   * DISTINCT ON (url) because a report can hold both placements at once: the
   * PwC barometer sits on the Labour Markets lens as a whole AND on
   * `entry-level` with the specific finding about early-career postings. Both
   * rows are correct, and rendering both puts the same report on the page
   * twice — once with a takeaway and once without, which reads as a bug and
   * makes the page look padded. The question-scoped row wins, since it is the
   * one written about this page.
   */
  const { rows: reading } = await query(
    `SELECT DISTINCT ON (url)
            id, title, publisher, published::text, url, kind, stance, takeaway,
            takeaway_source, takeaway_ref,
            CASE WHEN question_id IS NULL THEN 'lens' ELSE 'question' END AS scope
       FROM question_reading
      WHERE question_id = $1 OR lens_id = $2
      ORDER BY url, (question_id IS NULL)`,
    [questions[0].id, questions[0].lens_id]
  );

  /*
   * DISTINCT ON forces its own ORDER BY, so the reader-facing order is applied
   * here rather than in SQL: question-scoped sources first, then by the order
   * they were placed, then newest.
   */
  reading.sort(
    (a, b) =>
      (a.scope === 'lens') - (b.scope === 'lens') ||
      (b.published ?? '').localeCompare(a.published ?? '')
  );

  const { rows: indicators } = await query(
    `SELECT qi.indicator_id, qi.role, qi.sort_order, qi.chart_group,
            qi.country_iso3, qi.caption_plain, qi.caption_expert,
            i.name, i.description, i.unit, i.unit_symbol, i.decimals,
            i.cadence, i.quantity_kind, i.confidence_tier, i.source_id,
            i.source_url, i.higher_is_better, i.has_country_dim,
            i.default_country_iso3, i.last_ingested_at,
            s.name       AS source_name,
            s.licence    AS source_licence,
            s.attribution_text,
            o.n          AS observation_count,
            o.first_period, o.last_period
       FROM question_indicators qi
       JOIN indicators i ON i.id = qi.indicator_id
       LEFT JOIN sources s ON s.id = i.source_id
       LEFT JOIN LATERAL (
         SELECT count(*)::int          AS n,
                min(period_start)::text AS first_period,
                max(period_start)::text AS last_period
           FROM observations
          WHERE indicator_id = i.id
       ) o ON true
      WHERE qi.question_id = $1 AND i.is_active
      ORDER BY
        -- Hero first, then supporting, then context. Ordering in SQL rather
        -- than the client keeps layout order and editorial order the same
        -- thing, which is what the role column was added to express.
        -- (No backticks in this comment: it lives inside a JS template
        --  literal, and a backtick here terminates the string.)
        CASE qi.role WHEN 'hero' THEN 0 WHEN 'supporting' THEN 1 ELSE 2 END,
        qi.sort_order,
        qi.indicator_id`,
    [questions[0].id]
  );

  return { ...questions[0], indicators, reading };
}

/**
 * Populated indicators that no question page shows.
 *
 * Exposed through the API deliberately. The pipeline page shows it, so a series
 * that gets ingested and then forgotten is visible rather than silently absent
 * — the failure mode this project keeps rediscovering.
 */
export async function orphanedIndicators() {
  const { rows } = await query('SELECT * FROM orphaned_indicators LIMIT 100');
  return rows;
}
