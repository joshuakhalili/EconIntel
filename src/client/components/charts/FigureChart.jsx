import { RiExternalLinkLine } from '@remixicon/react';
import { SERIES_COLORS } from '@/lib/format';
import { figureBasisNote, describeFigureChart, figureTableModel } from './chartModel';
import ChartDataTable from './ChartDataTable';

/*
 * The thirteen chart honesty behaviours this project treats as non-negotiable
 * are written down once, next to this file, in HONESTY.md. Four of them are
 * here: a bar chart may never truncate its axis, no chart draws more series
 * than there are validated hues, a forecast is never drawn in the ink of a
 * measurement, and the numbers are reachable without seeing the picture. Read
 * it before changing anything.
 */

/**
 * A one-word marker for a bar that is not a measurement.
 *
 * The long form lives in BASIS_WORDS and goes above the chart and into the
 * table. This is what fits at the end of a bar, and it is WORDS rather than
 * only the hatch — the same rule the raw-units line follows: a reader who does
 * not know the convention reads a hatched bar as a bar.
 */
const BASIS_MARK = {
  projected: 'projected',
  scenario: 'scenario',
  expectation: 'expected',
};

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

/**
 * Colour for a bar, from the ONE palette order this codebase has.
 *
 * This file used to declare its own array — c2, c3, c5, c4, c1, c6 — under a
 * comment saying it was "the fixed validated order. Never cycled", and then
 * cycled it with `% length` fourteen lines later. Both halves were false. The
 * order matters because CVD separation was measured on ADJACENT pairs (see
 * styles/charts.css): that arrangement put c3 next to c5, a pair the validator
 * never scored.
 *
 * A CSS var() string rather than a resolved hex because these are inline
 * `background` styles, which take var() perfectly well — no theme observer is
 * needed here the way it is for Recharts (see palette.js).
 */
function figureColor(index) {
  return `var(${SERIES_COLORS[index]})`;
}

export default function FigureChart({ figure }) {
  const points = figure.points ?? [];
  if (points.length === 0) return null;

  // Series order is the order they first appear, which is the order the
  // extraction read them off the page.
  const series = [...new Set(points.map((p) => p.series ?? ''))];
  const labels = [...new Set(points.map((p) => p.label))];

  /*
   * More series than there are validated hues, so this cannot be drawn
   * honestly and the bars are not drawn at all — the same refusal ChartGroup
   * makes, for the same reason. The alternative this replaced was a `% length`
   * wrap, which gives series 7 series 1's colour and says nothing.
   *
   * Latent today: the widest report figure carries three series. It is here so
   * that a four-hundred-word extraction with seven of them fails visibly
   * rather than rendering two identical bars under two different legend keys.
   *
   * The publisher, source, note and quote below are still true, so they still
   * render. Only the drawing is refused.
   */
  const tooManySeries = series.length > SERIES_COLORS.length;

  const values = points.map((p) => Number(p.value));
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;

  /*
   * A FORECAST DRAWN IN THE INK OF A MEASUREMENT.
   *
   * Seed 029 wired `value_status` through observations → /api/series →
   * SeriesChart → LineChart, so a projected segment of a series is dashed and
   * carries a note naming the series and the date it starts from. None of that
   * ever reached report figures: `report_figure_points` had no status column,
   * so "Jobs projected to be created and displaced by 2030" and "Expected
   * change in headcount" drew in exactly the ink of a measurement, with the
   * distinction carried only by words in the title.
   *
   * `basis` (db/migrations/0025, seeded by db/seeds/037_chart_form.sql) is the
   * per-POINT counterpart of value_status. Per point rather than per figure
   * because four live figures put a measured series beside an expected one —
   * "Actual decrease over the past year" against "Expected decrease over the
   * next year" — and a figure-level field would mislabel half of each.
   *
   * A point with no recorded basis renders exactly as it did before. An absent
   * classification is not a claim that something was measured, so it is not
   * drawn as one either way.
   */
  const basisNote = figureBasisNote(points);

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

      {tooManySeries ? (
        <div className="mt-4 rounded-2xl border border-border-button-default p-5">
          <p className="text-body-regular text-text-secondary">
            Not drawn: {series.length} series in one figure, and there are only{' '}
            {SERIES_COLORS.length} validated colours. Drawing it would give different series
            the same colour and a legend that says otherwise.
          </p>
          <p className="mt-2 text-caption-1-regular text-text-tertiary">{series.join(' · ')}</p>
        </div>
      ) : (
        <>
        {/* Above the frame, not only in the title — the same place LineChart
            puts its forecast note, for the same reason: a reader looking at
            the shape has to meet the caveat while they are looking at it. */}
        {basisNote && (
          <p className="mt-4 text-caption-1-medium text-warn">{basisNote}</p>
        )}

        {series.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {series.map((name, i) => (
              <span key={name} className="flex items-center gap-1.5">
                <span
                  className="size-2.5 shrink-0 rounded-[2px]"
                  style={{ background: figureColor(i) }}
                  aria-hidden
                />
                <span className="text-caption-1-regular text-text-secondary">{name}</span>
              </span>
            ))}
          </div>
        )}

        <div
          className="mt-5 flex flex-col gap-3"
          role="img"
          aria-label={describeFigureChart(points, {
            unit: figure.unit,
            decimals: figure.decimals,
            unitSymbol: figure.unit_symbol,
          })}
        >
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
                          // Hatched, not solid, when the number is a forecast,
                          // a scenario or an expectation — the bar version of
                          // the dashed line LineChart draws for the same fact.
                          background:
                            point.basis && point.basis !== 'measured'
                              ? `repeating-linear-gradient(135deg, ${figureColor(i)} 0 4px, transparent 4px 8px)`
                              : figureColor(i),
                          border:
                            point.basis && point.basis !== 'measured'
                              ? `1px solid ${figureColor(i)}`
                              : undefined,
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
                        {BASIS_MARK[point.basis] && (
                          <span className="text-warn"> · {BASIS_MARK[point.basis]}</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <ChartDataTable
          model={figureTableModel(points, {
            decimals: figure.decimals,
            unitSymbol: figure.unit_symbol,
          })}
          caption={`Every bar in this figure as numbers: ${figure.title}.`}
        />
        </>
      )}

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
