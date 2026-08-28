/**
 * Lenses — reading side.
 *
 * A lens is a way of looking at the AI-economy intersection: money, work,
 * physical build-out, government. Its page carries a thesis, the questions
 * beneath it, and a ticker strip of the prices that give those questions
 * context.
 */

import { query } from '../db/pool.js';

/** All active lenses, for navigation. */
export async function listLenses() {
  const { rows } = await query(
    `SELECT l.id, l.slug, l.name, l.subtitle, l.icon, l.sort_order,
            count(DISTINCT q.id)::int             AS question_count,
            count(DISTINCT t.indicator_id)::int   AS ticker_count
       FROM lenses l
       LEFT JOIN questions q    ON q.lens_id = l.id AND q.is_active
       LEFT JOIN lens_tickers t ON t.lens_id = l.id
      WHERE l.is_active
      GROUP BY l.id
      ORDER BY l.sort_order`
  );
  return rows;
}

/**
 * Every lens with its thesis and one representative number, for the overview.
 *
 * The front page has to make an argument, not present a menu. That means each
 * lens needs to arrive carrying something — a claim and a live figure — rather
 * than a name and a link. Fetching this as five separate ticker requests would
 * put six round trips in front of the first thing a visitor ever sees.
 *
 * The lead indicator is the placement the editorial layer already sorted first,
 * so which number represents a lens stays an editorial decision made in
 * 012_lenses.sql rather than one made here by whichever row came back first.
 */
export async function overview() {
  const { rows } = await query(
    // Resolving the lead placement in its own CTE, BEFORE touching
    // observations, is what makes this cheap. Nesting the observation lookup
    // inside a lateral that ended in `ORDER BY sort_order LIMIT 1` made
    // Postgres evaluate it for every ticker on every lens and then throw all
    // but one away — around thirty scans instead of five, and a 5.9s first
    // load on the page a visitor sees before any other.
    `WITH lead AS (
       SELECT DISTINCT ON (t.lens_id)
              t.lens_id,
              i.id AS indicator_id,
              COALESCE(t.label, i.name) AS label,
              i.unit, i.unit_symbol,
              i.has_country_dim, i.default_country_iso3
         FROM lens_tickers t
         JOIN indicators i ON i.id = t.indicator_id
        ORDER BY t.lens_id, t.sort_order
     ),
     question_counts AS (
       SELECT lens_id, count(*)::int AS question_count
         FROM questions
        WHERE is_active AND lens_id IS NOT NULL
        GROUP BY lens_id
     )
     SELECT l.id, l.slug, l.name, l.subtitle, l.thesis_plain, l.thesis_expert,
            l.sort_order,
            COALESCE(qc.question_count, 0) AS question_count,
            lead.label AS lead_label,
            lead.unit,
            lead.unit_symbol,
            recent.latest_value,
            recent.latest_period,
            recent.previous_value
       FROM lenses l
       LEFT JOIN lead           ON lead.lens_id = l.id
       LEFT JOIN question_counts qc ON qc.lens_id = l.id
       LEFT JOIN LATERAL (
         SELECT max(value)        FILTER (WHERE rn = 1) AS latest_value,
                max(period_start) FILTER (WHERE rn = 1) AS latest_period,
                max(value)        FILTER (WHERE rn = 2) AS previous_value
           FROM (
             SELECT o.value, o.period_start,
                    row_number() OVER (ORDER BY o.period_start DESC) AS rn
               FROM observations o
              WHERE o.indicator_id = lead.indicator_id
                AND o.value IS NOT NULL
                -- See getLensTickers: keying off default_country_iso3 rather
                -- than the dimension flag returns a blank ticker.
                AND (NOT lead.has_country_dim
                     OR lead.default_country_iso3 IS NULL
                     OR o.country_iso3 = lead.default_country_iso3)
              ORDER BY o.period_start DESC
              LIMIT 2
           ) top2
       ) recent ON lead.indicator_id IS NOT NULL
      WHERE l.is_active
      ORDER BY l.sort_order`
  );

  return rows.map((r) => ({
    ...r,
    latest_value: r.latest_value === null ? null : Number(r.latest_value),
    previous_value: r.previous_value === null ? null : Number(r.previous_value),
    latest_period: r.latest_period ? String(r.latest_period).slice(0, 10) : null,
  }));
}

/** One lens with its questions. Charts are fetched per question, not here. */
export async function getLens(slug) {
  const { rows: lenses } = await query(
    // The query itself is not exposed — it is an editorial control, and
    // publishing it invites gaming the search. Whether one exists is exposed,
    // because the client needs it to decide between rendering a news section
    // and rendering nothing at all.
    `SELECT id, slug, name, subtitle, thesis_plain, thesis_expert, icon,
            (news_query IS NOT NULL) AS has_news
       FROM lenses WHERE slug = $1 AND is_active`,
    [slug]
  );
  if (lenses.length === 0) return null;

  const { rows: questions } = await query(
    `SELECT q.id, q.slug, q.question, q.subtitle, q.answer_plain, q.answer_expert,
            q.caveat, q.sort_order,
            count(qi.*)::int AS indicator_count
       FROM questions q
       LEFT JOIN question_indicators qi ON qi.question_id = q.id
      WHERE q.lens_id = $1 AND q.is_active
      GROUP BY q.id
      ORDER BY q.sort_order`,
    [lenses[0].id]
  );

  // Reading filed against the lens itself. Question-level sources are not
  // pulled up here — they belong to their own page, and hoisting them would
  // make a lens look better read than it is.
  const { rows: reading } = await query(
    `SELECT id, title, publisher, published::text, url, kind, stance, takeaway
       FROM question_reading
      WHERE lens_id = $1
      ORDER BY sort_order, published DESC NULLS LAST`,
    [lenses[0].id]
  );

  return { ...lenses[0], questions, reading };
}

/**
 * The ticker strip for a lens.
 *
 * Returns only the two most recent observations per indicator, not the series.
 * A strip needs a value and a direction; fetching decades of history for each
 * of seven tickers would cost more than the rest of the page combined.
 *
 * `why` comes from the PLACEMENT rather than the indicator, because the same
 * copper price argues something different on Money (an input cost) than on
 * Infrastructure (physical build-out). Without it a strip is decoration, and
 * decoration on a dashboard claiming to be evidence is worse than blank space.
 */
export async function getLensTickers(slug) {
  const { rows } = await query(
    `WITH placements AS (
       SELECT t.indicator_id, t.sort_order, t.label, t.why
         FROM lens_tickers t
         JOIN lenses l ON l.id = t.lens_id
        WHERE l.slug = $1 AND l.is_active
     )
     SELECT p.indicator_id,
            p.sort_order,
            COALESCE(p.label, i.name)  AS label,
            p.why,
            i.name,
            i.unit,
            i.unit_symbol,
            i.decimals,
            i.quantity_kind,
            i.source_url,
            recent.latest_value,
            recent.latest_period,
            recent.previous_value,
            recent.previous_period
       FROM placements p
       JOIN indicators i ON i.id = p.indicator_id
       LEFT JOIN LATERAL (
         SELECT max(value)      FILTER (WHERE rn = 1) AS latest_value,
                max(period_start) FILTER (WHERE rn = 1) AS latest_period,
                max(value)      FILTER (WHERE rn = 2) AS previous_value,
                max(period_start) FILTER (WHERE rn = 2) AS previous_period
           FROM (
             SELECT o.value, o.period_start,
                    row_number() OVER (ORDER BY o.period_start DESC) AS rn
               FROM observations o
              WHERE o.indicator_id = i.id
                AND o.value IS NOT NULL
                -- Filter on has_country_dim, NOT on default_country_iso3.
                -- An indicator can name a default country while its
                -- observations carry none, and keying off the name then
                -- matched nothing and returned a blank ticker. The dimension
                -- flag is what actually says whether country is on the row.
                AND (NOT i.has_country_dim
                     OR i.default_country_iso3 IS NULL
                     OR o.country_iso3 = i.default_country_iso3)
              ORDER BY o.period_start DESC
              LIMIT 2
           ) top2
       ) recent ON true
      ORDER BY p.sort_order`,
    [slug]
  );

  return rows.map((r) => ({
    ...r,
    latest_value: r.latest_value === null ? null : Number(r.latest_value),
    previous_value: r.previous_value === null ? null : Number(r.previous_value),
    latest_period: r.latest_period ? String(r.latest_period).slice(0, 10) : null,
    previous_period: r.previous_period ? String(r.previous_period).slice(0, 10) : null,
  }));
}
