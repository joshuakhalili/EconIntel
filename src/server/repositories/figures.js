/**
 * Figures read out of the cited literature.
 *
 * These are NOT series. A `report_figure` is a handful of numbers printed on a
 * named page of a named report — a survey breakdown, a model result, a
 * scenario — read once and never refetched. The reasoning for keeping them out
 * of `observations` is in db/migrations/0019_report_figures.sql.
 *
 * Everything a reader needs to check one is returned with it: the page, the
 * verbatim line the numbers came from, what the figure cannot show, and
 * whether a person has verified any of it. None of those is optional, in the
 * schema or here.
 */

import { query } from '../db/pool.js';

/**
 * Figures placed on a question or a lens, with their points.
 *
 * One round trip returning nested JSON rather than a figures query plus a
 * points query. The alternative is a join that repeats every figure's `quote`
 * and `note` — the two longest columns — once per bar, which on an eight-bar
 * figure means carrying those strings eight times to assemble them back into
 * one.
 *
 * Points are ordered by `sort_order`, which is the order they were read off
 * the page. That is deliberate: a report's own ordering is usually editorial
 * (largest first, or a ranking it is making a point about), and re-sorting by
 * value here would quietly restate the chart the publisher drew.
 */
async function figuresWhere(column, id) {
  if (!id) return [];

  const { rows } = await query(
    `SELECT f.id, f.publisher, f.source_title, f.source_url, f.published::text,
            f.title, f.subtitle, f.unit, f.unit_symbol, f.decimals,
            f.axis_kind, f.note, f.page_ref, f.quote, f.figure_source,
            COALESCE(
              (SELECT json_agg(json_build_object(
                        'series', p.series,
                        'label',  p.label,
                        -- ::float8 because pg returns NUMERIC as a string to
                        -- avoid precision loss, and a bar width cannot be
                        -- computed from "42.1". The values are printed
                        -- decimals off a page, so a double holds them exactly
                        -- enough for a chart; the stored column stays NUMERIC.
                        'value',  p.value::float8)
                      ORDER BY p.sort_order, p.label)
                 FROM report_figure_points p
                WHERE p.figure_id = f.id),
              '[]'::json
            ) AS points
       FROM report_figures f
      WHERE f.${column} = $1
      ORDER BY f.sort_order, f.id`,
    [id]
  );
  return rows;
}

/* `column` is never caller-supplied — both call sites pass a literal, and the
   two exported functions exist so that stays true. */
export const figuresForQuestion = (questionId) => figuresWhere('question_id', questionId);
export const figuresForLens = (lensId) => figuresWhere('lens_id', lensId);
