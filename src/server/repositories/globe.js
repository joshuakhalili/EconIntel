import { query } from '../db/pool.js';

/**
 * Every country, its position, and how much is known about it.
 *
 * This backs the globe on the landing page, which makes two claims at once and
 * must keep them separate:
 *
 *   - how far AI adoption has spread, where that is measured
 *   - where it is not measured at all
 *
 * Conflating those is the failure mode. A country with no adoption survey is
 * not a country with no adoption, and rendering both as darkness would say it
 * was. So `adoption` is null rather than zero for the unmeasured, and the
 * client draws them as outlines rather than as dim points.
 *
 * `indicatorCount` carries the second, blunter admission: the US holds sixty-one
 * series and most countries hold six. A globe that hides that would be
 * decorating over the project's largest known weakness.
 */
export async function globe() {
  /*
   * Adoption is spread across sixteen indicators, one per country, because the
   * source publishes it that way — the country is baked into each series code
   * rather than carried per observation. Collapsing them here rather than in
   * the client keeps that shape a detail of the data layer.
   */
  const { rows } = await query(
    `WITH adoption AS (
       SELECT i.default_country_iso3 AS iso3,
              extract(year FROM o.period_start)::int AS year,
              o.value
         FROM indicators i
         JOIN observations o ON o.indicator_id = i.id
        WHERE (i.id LIKE 'eurostat.ai_any.%' OR i.id LIKE 'oecd.ai_any.%')
          AND o.value IS NOT NULL
          /*
           * Korea's survey changed what it counts in 2022 — 2.7% in 2021 to
           * 28.0% in 2022. Animated, that reads as adoption exploding tenfold
           * in a year, which did not happen. The two halves measure different
           * things, so the earlier half is dropped here rather than spliced:
           * there is no comparable measurement of Korean AI adoption before
           * 2022 on the current definition, and a hollow ring says that
           * correctly where a rising dot would lie.
           */
          AND NOT (i.default_country_iso3 = 'KOR' AND o.period_start < DATE '2022-01-01')
     ),
     depth AS (
       SELECT o.country_iso3 AS iso3, count(DISTINCT o.indicator_id)::int AS n
         FROM observations o
        WHERE o.country_iso3 IS NOT NULL
        GROUP BY 1
     )
     SELECT c.iso3,
            c.name,
            c.latitude::float8  AS lat,
            c.longitude::float8 AS lon,
            COALESCE(d.n, 0) AS indicator_count,
            COALESCE(
              jsonb_object_agg(a.year, round(a.value, 1))
                FILTER (WHERE a.year IS NOT NULL),
              '{}'::jsonb
            ) AS adoption
       FROM countries c
       LEFT JOIN depth d    ON d.iso3 = c.iso3
       LEFT JOIN adoption a ON a.iso3 = c.iso3
      WHERE NOT c.is_aggregate
        AND c.latitude IS NOT NULL
      GROUP BY c.iso3, c.name, c.latitude, c.longitude, d.n
      ORDER BY c.iso3`
  );

  const years = [
    ...new Set(rows.flatMap((r) => Object.keys(r.adoption).map(Number))),
  ].sort((a, b) => a - b);

  return {
    countries: rows.map((r) => ({
      iso3: r.iso3,
      name: r.name,
      lat: r.lat,
      lon: r.lon,
      indicatorCount: r.indicator_count,
      // Numbers, not strings: jsonb_object_agg keys are text.
      adoption: Object.fromEntries(
        Object.entries(r.adoption).map(([y, v]) => [Number(y), Number(v)])
      ),
    })),
    years,
    /*
     * Stated rather than inferred by the client, so the caption on the globe
     * cannot drift from what the globe is drawing. Both are facts about the
     * panel that a reader needs in order to not over-read the animation.
     */
    measured: rows.filter((r) => Object.keys(r.adoption).length > 0).length,
    total: rows.length,
  };
}
