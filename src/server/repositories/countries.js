import { query } from '../db/pool.js';
import { measurementDefinition } from '../lib/measurement-definitions.js';

export async function listCountryCoverage() {
  const { rows } = await query(`SELECT c.iso3, c.name, c.region, c.is_aggregate,
      count(DISTINCT o.indicator_id)::int AS indicator_count,
      count(o.indicator_id)::int AS observation_count,
      min(o.period_start)::text AS first_period, max(o.period_start)::text AS last_period
    FROM countries c LEFT JOIN (
      SELECT o.* FROM observations o JOIN indicators i ON i.id = o.indicator_id
      WHERE o.value IS NOT NULL AND i.is_active
    ) o ON o.country_iso3 = c.iso3
    GROUP BY c.iso3 ORDER BY c.is_aggregate, lower(c.name)`);
  return rows;
}

export async function countryCoverage(iso3) {
  const { rows: countries } = await query('SELECT iso3, name, region, is_aggregate FROM countries WHERE iso3 = $1', [iso3]);
  if (!countries.length) return null;
  const { rows: indicators } = await query(`SELECT i.id, i.name, i.pillar, i.unit, i.cadence, i.source_url,
      s.name AS source_name, s.licence AS source_licence,
      array_agg(DISTINCT o.value_status) FILTER (WHERE o.value_status IS NOT NULL) AS quality_flags,
      (SELECT jsonb_agg(jsonb_build_object('slug', q.slug, 'question', q.question, 'role', qi.role))
        FROM question_indicators qi JOIN questions q ON q.id = qi.question_id
        WHERE qi.indicator_id = i.id AND q.is_active) AS questions,
      count(*)::int AS observation_count,
      min(o.period_start)::text AS first_period, max(o.period_start)::text AS last_period
    FROM observations o JOIN indicators i ON i.id = o.indicator_id
    JOIN sources s ON s.id = i.source_id
    WHERE o.country_iso3 = $1 AND o.value IS NOT NULL AND i.is_active
    GROUP BY i.id, s.name, s.licence ORDER BY i.pillar, lower(i.name)`, [iso3]);
  return { country: countries[0], indicators: indicators.map((row) => ({ ...row, ...measurementDefinition(row) })) };
}

/** Complete placement matrix, including missing country/indicator cells. Global
 * series deliberately remain missing here: a world price is not country data.
 */
export async function countryEvidenceMatrix() {
  const { rows } = await query(`WITH coverage AS (
    SELECT o.country_iso3, o.indicator_id, count(*)::int AS observation_count,
      min(o.period_start)::text AS first_period, max(o.period_start)::text AS last_period,
      array_agg(DISTINCT o.value_status) FILTER (WHERE o.value_status IS NOT NULL) AS quality_flags
    FROM observations o WHERE o.value IS NOT NULL GROUP BY o.country_iso3, o.indicator_id
  ) SELECT c.iso3, c.name AS country_name, q.id AS question_id, q.question, q.lens_id,
    i.id AS indicator_id, i.name AS indicator_name, i.cadence, i.unit, i.source_url,
    i.has_country_dim, qi.role, qi.series_panel, s.name AS source_name, s.licence,
    COALESCE(o.observation_count, 0)::int AS observation_count,
    o.first_period, o.last_period, o.quality_flags
  FROM countries c CROSS JOIN question_indicators qi
  JOIN questions q ON q.id = qi.question_id AND q.is_active
  JOIN indicators i ON i.id = qi.indicator_id AND i.is_active
  JOIN sources s ON s.id = i.source_id
  LEFT JOIN coverage o ON o.country_iso3 = c.iso3 AND o.indicator_id = i.id
  WHERE NOT c.is_aggregate ORDER BY c.iso3, q.id, i.id`);
  return rows.map((row) => ({ ...row, ...measurementDefinition(row) }));
}
