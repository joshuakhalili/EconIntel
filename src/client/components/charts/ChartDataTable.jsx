/*
 * The thirteen chart honesty behaviours this project treats as non-negotiable
 * are written down once, next to this file, in HONESTY.md. This component IS
 * the thirteenth: the numbers behind a chart, reachable without seeing it.
 * Read it before changing anything.
 */

/**
 * The chart's own points, as a table only a screen reader (or a printer, or a
 * copy-paste) meets.
 *
 * WHY A TABLE AND NOT A LONGER LABEL
 *
 * The `aria-label` on the chart wrapper says what the chart shows — how many
 * series, over what range, ending where. That is the equivalent of glancing at
 * it. This is the equivalent of reading it: every point, addressable, in a
 * structure a screen reader can navigate by row and column.
 *
 * The site's structure is "the answer, then the evidence". Before this, a
 * blind reader got the answer and none of the evidence, on a site whose whole
 * argument is that you should check the working.
 *
 * WHY IT SITS OUTSIDE THE `role="img"` WRAPPER
 *
 * `role="img"` makes an element a single opaque graphic: assistive technology
 * stops descending into it and announces the label instead. So a table nested
 * INSIDE the wrapper would be unreachable — the fix would look right in the
 * source and do nothing. It is a sibling for that reason, not by accident.
 *
 * `sr-only` rather than `hidden`: `display: none` is removed from the
 * accessibility tree as well as from the page, which is the same mistake in a
 * different spelling.
 */
export default function ChartDataTable({ model, caption }) {
  if (!model || model.rows.length === 0) return null;

  return (
    <table className="sr-only">
      <caption>
        {caption}
        {model.truncated && (
          <>
            {' '}
            Showing the most recent {model.rows.length} of {model.total} periods; the whole series
            is on this indicator&rsquo;s own page.
          </>
        )}
      </caption>
      <thead>
        <tr>
          {model.columns.map((column) => (
            <th key={column} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {model.rows.map((row) => (
          <tr key={row.key}>
            {row.cells.map((cell, i) =>
              // The first cell is the row's identity — a period, or an entity —
              // so it is a header, which is what lets a screen reader announce
              // "Denmark, 42.0" rather than an unmoored number.
              i === 0 ? (
                <th key={model.columns[i]} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={model.columns[i]}>{cell}</td>
              )
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
