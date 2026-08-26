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

  return { ...lenses[0], questions };
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
