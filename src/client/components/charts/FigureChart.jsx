import { RiExternalLinkLine } from '@remixicon/react';

/**
 * A figure read off a page of a report.
 *
 * WHY THIS IS NOT RECHARTS
 *
 * Every other chart here is a time series and needs an axis, a crosshair and a
 * tooltip. This one is a handful of labelled bars where every value is printed
 * on the bar. There is nothing for a tooltip to reveal, so the whole hover
 * layer would be machinery in service of no information — and horizontal bars
 * in CSS reflow correctly at any width without a ResponsiveContainer measuring
 * anything.
 *
 * THE ZERO BASELINE IS NOT A DEFAULT HERE, IT IS THE RULE
 *
 * A line chart's y-axis may start above zero when the series is an index near
 * 100, and `LineChart` does that and discloses it on the chart face. A BAR
 * chart may not, ever. The encoding of a bar is its LENGTH, so cutting the
 * axis does not merely rescale the view — it rescales the claim. 42 next to 38
 * becomes four times as long as its neighbour. There is no disclosure that
 * repairs that, so the option does not exist in this component.
 *
 * Negative values are handled by moving the baseline to where zero actually
 * falls, not by taking absolute values.
 *
 * WHAT THE READER IS TOLD
 *
 * The publisher, the page, the verbatim line the numbers came from, what the
 * figure cannot show, and — until a person has checked it — that nobody has.
 * All five are required by the database; none of them is optional here either.
 */

/** The categorical palette, in its fixed validated order. Never cycled. */
const SERIES_COLOUR = ['var(--c2)', 'var(--c3)', 'var(--c5)', 'var(--c4)', 'var(--c1)', 'var(--c6)'];

export default function FigureChart({ figure }) {
  const points = figure.points ?? [];
  if (points.length === 0) return null;

  // Series order is the order they first appear, which is the order the
  // extraction read them off the page.
  const series = [...new Set(points.map((p) => p.series ?? ''))];
  const labels = [...new Set(points.map((p) => p.label))];

  const values = points.map((p) => Number(p.value));
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;

  // Where zero sits across the track. 0 when nothing is negative, which is the
  // usual case and gives a plain left-anchored bar.
  const zeroAt = (-min / span) * 100;

  return (
    <figure className="rounded-2xl border border-border-button-default bg-panel p-5 sm:p-6">
      <figcaption>
        <p className="text-caption-1-medium text-text-secondary">{figure.publisher}</p>
        <h3 className="mt-1 text-title-3-medium text-text-primary">{figure.title}</h3>
        <p className="mt-1 text-body-regular text-text-tertiary">{figure.subtitle}</p>
      </figcaption>

      {series.length > 1 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {series.map((name, i) => (
            <span key={name} className="flex items-center gap-1.5">
              <span
                className="size-2.5 shrink-0 rounded-[2px]"
                style={{ background: SERIES_COLOUR[i % SERIES_COLOUR.length] }}
                aria-hidden
              />
              <span className="text-caption-1-regular text-text-secondary">{name}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {labels.map((label) => (
          <div key={label} className="grid gap-1.5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
            <span className="self-center text-body-regular leading-snug text-text-secondary">
              {label}
            </span>

            {/* The track stops short of the right edge so the direct label on
                the longest bar has somewhere to go. Margin rather than
                padding: the bars are absolutely positioned, and a percentage
                width resolves against the padding box, so padding here would
                not shrink them. */}
            <div className="mr-11 flex flex-col gap-[2px]">
              {series.map((name, i) => {
                const point = points.find((p) => p.label === label && (p.series ?? '') === name);
                if (!point) return null;
                const value = Number(point.value);
                // Bars are positioned from the zero line rather than from the
                // left edge, so a negative value grows leftwards from it.
                const width = (Math.abs(value) / span) * 100;
                const left = value >= 0 ? zeroAt : zeroAt - width;

                return (
                  <div key={name} className="relative h-6">
                    {/* The zero line, drawn only when there is something on
                        both sides of it — otherwise it is just the left edge
                        and a rule there reads as a chart border. */}
                    {min < 0 && (
                      <span
                        className="absolute inset-y-0 w-px bg-border-button-default"
                        style={{ left: `${zeroAt}%` }}
                        aria-hidden
                      />
                    )}
                    <span
                      className="absolute inset-y-0 rounded-[3px]"
                      style={{
                        left: `${left}%`,
                        width: `${width}%`,
                        background: SERIES_COLOUR[i % SERIES_COLOUR.length],
                      }}
                      aria-hidden
                    />
                    {/* Direct label on every bar. With this few values a
                        legend-and-axis arrangement costs a lookup and gives
                        nothing back. */}
                    <span
                      className="figure absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2 text-caption-1-regular text-text-primary"
                      style={{ left: `${value >= 0 ? left + width : zeroAt}%` }}
                    >
                      {format(value, figure.decimals)}
                      {figure.unit_symbol}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 text-caption-1-regular text-text-tertiary">{figure.unit}</p>

      <div className="mt-4 border-t border-border-button-default pt-4">
        <p className="prose-measure text-body-regular leading-relaxed text-text-tertiary">
          {figure.note}
        </p>

        {/* The quote is what makes an extracted number checkable rather than
            merely asserted, so it is on the page rather than in a tooltip. */}
        <blockquote className="prose-measure mt-3 border-l border-border-button-default pl-3 text-caption-1-regular italic text-text-tertiary">
          &ldquo;{figure.quote}&rdquo;
        </blockquote>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption-1-regular text-text-tertiary">
          <a
            href={figure.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-text-secondary underline decoration-border-button-default underline-offset-2 tint hover:text-text-primary"
          >
            {figure.source_title}
            <RiExternalLinkLine className="size-3.5" aria-hidden />
          </a>
          <span>· {figure.page_ref}</span>
          {figure.figure_source === 'extracted' && (
            <span>· read from the source, not yet checked by a person</span>
          )}
        </p>
      </div>
    </figure>
  );
}

function format(value, decimals = 0) {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
