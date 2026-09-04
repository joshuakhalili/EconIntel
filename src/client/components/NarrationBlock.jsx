import { useState } from 'react';
import { RiSparkling2Line, RiArrowDownSLine } from '@remixicon/react';
import { displayUnit, fmtDate, fmtDay, narrationStaleness, prefixSymbol } from '@/lib/format';

/**
 * The one piece of prose on this site written by a machine, labelled as such.
 *
 * WHY THE LABEL IS NOT NEGOTIABLE
 *
 * Every other sentence here was written by a person, and the project's first
 * rule is that no figure or claim is written by a model. This block is the
 * single exception, and an exception that is not visible is not an exception —
 * it is a quiet abandonment of the rule. So it says what it is, in the
 * heading, before the reader has read a word of it.
 *
 * WHY THE GROUNDING IS ON THE PAGE
 *
 * The guarantee this site can actually make about machine prose is narrow and
 * worth stating precisely: every number in it was handed to the model, and
 * every direction claim was checked against the data. Neither is a promise
 * that the sentence is *true* — see the limits in `lib/narration.js`.
 *
 * A reader has no reason to take that on trust, so the exact payload the model
 * was given is one click away. That is the same standard the report figures
 * hold themselves to, where the verbatim line from the PDF sits under the
 * chart: the claim is checkable or it does not belong here.
 *
 * WHY IT IS VISUALLY QUIET
 *
 * No fill, no accent, no card. This is the least authoritative thing on the
 * page and it should look it — it sits BELOW the figures it describes, on both
 * pages that mount it (`LensPage` puts it under the ticker strip, deliberately;
 * `SimulationPage` puts it under the chart), and if a reader skips it they have
 * lost nothing at all. The heading used to say "from the figures below" from
 * when the block sat above the strip, and pointed a reader in the wrong
 * direction on the one component whose whole job is being scrupulous about
 * what they are looking at.
 *
 * WHY IT SAYS WHEN THE FIGURES ARE FROM
 *
 * Narrations are generated offline and stored; the tickers beside them are
 * live. On /lens/regulation that produced two irreconcilable sets of numbers on
 * one screen — four tiles reading "Rules in force 1" for September, and forty
 * pixels below, under a heading asserting the figures came from those tiles, a
 * paragraph describing August: "increased from 6 to 10 documents per month".
 * Nothing on screen said they were different months.
 *
 * So the heading carries the narration's own period, and when the caller can
 * supply the tickers the block says outright that it has fallen behind them and
 * drops to the tertiary text colour (#ababab, 9.09:1 on the page — quieter, not
 * unreadable). Suppressing the block entirely was the alternative; it was
 * rejected because a reader who saw the paragraph yesterday would find it
 * silently gone, which teaches them nothing about why.
 */
export default function NarrationBlock({ narration, tickers }) {
  const [showGrounding, setShowGrounding] = useState(false);

  // Absent is normal, not an error: the gate rejects, and the page renders
  // without a summary. Nothing here should draw attention to the gap.
  if (!narration?.body) return null;

  const series = narration.grounding?.series ?? [];

  // The comparison lives in lib/format.js so it can be tested without a DOM.
  const { narrationPeriod, tickerPeriod, stale } = narrationStaleness(series, tickers);

  return (
    <section className="mt-10 border-t border-border-button-default pt-6">
      <h2 className="eyebrow flex items-center gap-2 text-text-tertiary">
        <RiSparkling2Line className="size-3.5 shrink-0" aria-hidden />
        Written by a machine from the figures above
        {narrationPeriod ? `, as they stood in ${fmtDate(narrationPeriod, 'monthly')}` : ''}
      </h2>

      {stale && (
        <p className="prose-measure mt-3 text-caption-1-regular text-warn">
          The figures above have been updated since this was written — they now
          run to {fmtDate(tickerPeriod, 'monthly')}. This paragraph describes{' '}
          {fmtDate(narrationPeriod, 'monthly')} and has not been rewritten, so
          the two do not describe the same period.
        </p>
      )}

      <p
        className={`prose-measure mt-3 text-body-regular leading-relaxed ${
          stale ? 'text-text-tertiary' : 'text-text-secondary'
        }`}
      >
        {narration.body}
      </p>

      {series.length > 0 ? (
        <>
          <button
            type="button"
            onClick={() => setShowGrounding((open) => !open)}
            aria-expanded={showGrounding}
            className="tint mt-3 inline-flex items-center gap-1 text-caption-1-regular text-text-tertiary hover:text-text-secondary"
          >
            {showGrounding ? 'Hide' : 'Show'} the {series.length}{' '}
            {series.length === 1 ? 'figure' : 'figures'} it was given
            <RiArrowDownSLine
              className={`size-4 transition-transform ${showGrounding ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>

          {showGrounding && (
            <div className="mt-4 rounded-2xl border border-border-button-default p-4">
              <p className="prose-measure text-caption-1-regular text-text-tertiary">
                This is the whole of what the model received. It was permitted to
                write these numbers and no others, and every statement it made about
                something rising or falling was checked against them before this was
                stored. That is a guarantee about the arithmetic, not about the
                sentence — a real number can still be used to say something wrong.
              </p>

              <ul className="mt-4 flex flex-col">
                {series.map((row) => (
                  <li
                    key={row.name}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border-button-default py-2 first:border-t-0 first:pt-0"
                  >
                    <span className="text-caption-1-regular text-text-secondary">{row.name}</span>
                    <span className="figure text-caption-1-regular text-text-tertiary">
                      <GroundingValue value={row.previous} unit={row.unit} arrow />
                      <span className="text-text-primary">
                        <GroundingValue value={row.latest} unit={row.unit} />
                      </span>
                      {/* The period is printed exactly as the grounding holds
                          it. A lens grounding carries an ISO date; a simulation
                          grounding carries a phrase ("no injection → year 5"),
                          and neither is reformatted here — this panel's promise
                          is that it shows the payload, not a reading of it. */}
                      {row.period ? ` · ${row.period}` : ''}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-caption-1-regular text-text-tertiary">
                {narration.model}
                {narration.generated_at ? ` · written ${fmtDay(String(narration.generated_at))}` : ''}
              </p>
            </div>
          )}
        </>
      ) : (
        /*
         * NO SERIES MEANS NO AUDIT, AND SAYING SO IS THE WHOLE POINT.
         *
         * This used to render the disclosure unconditionally, so a grounding
         * with no `series` key produced a button reading "Show the 0 figures it
         * was given" over an empty list — under a paragraph asserting "This is
         * the whole of what the model received". A panel that claims
         * completeness while showing nothing is the exact inversion of what
         * this component exists to do.
         *
         * The simulation generator's grounding is `{scenario, country, series}`
         * today (lib/narration.js buildSimulationGrounding), so this branch is
         * unreachable for anything currently stored — verified against the
         * narrations table on 4 September 2026, where all eight rows carry
         * between 3 and 6 series. It is here because the shape is produced by a
         * script that can change, and the failure it guards against is silent.
         */
        <p className="mt-3 text-caption-1-regular text-text-tertiary">
          The figures this was written from were not stored in a form this panel
          can show, so there is nothing here to check it against.
        </p>
      )}
    </section>
  );
}

/**
 * One figure from the grounding, verbatim.
 *
 * NOT `withUnit`: that abbreviates above ten thousand, and an audit panel whose
 * promise is "these are the numbers the model was handed" cannot round them.
 * What it does borrow is the symbol position, because a grounding unit of "$"
 * was rendering as "13543 $".
 */
function GroundingValue({ value, unit, arrow = false }) {
  if (value == null) return null;
  const prefix = prefixSymbol(unit);
  const suffix = prefix ? '' : displayUnit(unit);
  // A percent sign closes up against its number; a word does not.
  const glue = suffix === '%' ? '' : ' ';
  return (
    <>
      {prefix}
      {value}
      {suffix ? `${glue}${suffix}` : ''}
      {arrow ? ' → ' : ''}
    </>
  );
}
