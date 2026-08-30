import { useState } from 'react';
import { RiSparkling2Line, RiArrowDownSLine } from '@remixicon/react';

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
 * page and it should look it — it sits above the ticker strip whose numbers it
 * describes, and if a reader skips it they have lost nothing at all.
 */
export default function NarrationBlock({ narration }) {
  const [showGrounding, setShowGrounding] = useState(false);

  // Absent is normal, not an error: the gate rejects, and the page renders
  // without a summary. Nothing here should draw attention to the gap.
  if (!narration?.body) return null;

  const series = narration.grounding?.series ?? [];

  return (
    <section className="mt-10 border-t border-border-button-default pt-6">
      <h2 className="eyebrow flex items-center gap-2 text-text-tertiary">
        <RiSparkling2Line className="size-3.5 shrink-0" aria-hidden />
        Written by a machine from the figures below
      </h2>

      <p className="prose-measure mt-3 text-body-regular leading-relaxed text-text-secondary">
        {narration.body}
      </p>

      <button
        type="button"
        onClick={() => setShowGrounding((open) => !open)}
        aria-expanded={showGrounding}
        className="tint mt-3 inline-flex items-center gap-1 text-caption-1-regular text-text-tertiary hover:text-text-secondary"
      >
        {showGrounding ? 'Hide' : 'Show'} the {series.length} figures it was given
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
                  {row.previous != null && <>{row.previous} → </>}
                  <span className="text-text-primary">{row.latest}</span>
                  {row.unit ? ` ${row.unit}` : ''}
                  {row.period ? ` · ${row.period}` : ''}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-caption-1-regular text-text-tertiary">
            {narration.model}
            {narration.generated_at
              ? ` · written ${new Date(narration.generated_at).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`
              : ''}
          </p>
        </div>
      )}
    </section>
  );
}
