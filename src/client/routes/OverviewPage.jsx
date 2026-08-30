import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiAlertLine } from '@remixicon/react';
import { useOverview, useStatus } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import { fmt, withUnit, fmtDate, deltaDirection, displayUnit } from '@/lib/format';

/**
 * The front page.
 *
 * This route exists because the site previously had none: a visitor landed
 * inside whichever lens sorted first, with no statement of what the dashboard
 * is, what it currently finds, or how the five lenses relate. Five parallel
 * silos read as a menu, and a menu invites picking one at random.
 *
 * They are not a menu. They are one argument in order — money is committed,
 * then it either shows up in output or it does not, and what it does to work,
 * to prices and to the law follows from that. So the lenses are numbered and
 * stacked rather than gridded, and each arrives carrying a claim and a live
 * number instead of a name and a link.
 *
 * The "how to read this" section is not filler. The honesty rules — evidence
 * strength stated up front, caveats as sections rather than footnotes, never
 * asking a model to invent a figure — are the thing that distinguishes this
 * from a hype dashboard, and they were previously discoverable only by
 * noticing a toggle at the bottom of the sidebar.
 */
export default function OverviewPage() {
  const { data: lenses, isPending, isError, error } = useOverview();
  const { data: status } = useStatus();

  usePageTitle('Diffusion', 'Measuring AI’s effect on the economy');

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="the overview" />;

  const counts = status?.counts;

  return (
    <div className="mx-auto max-w-4xl">
      {/* ── The question, and the honest state of the answer ─────────────── */}
      <section className="mb-10">
        <h1 className="text-display-4-medium text-text-primary">
          Is AI changing the economy?
        </h1>
        <p className="mt-4 max-w-2xl text-headline-regular text-text-secondary">
          Enormous sums are being spent, and that part is not in doubt. Whether
          it has yet moved output, employment or prices is a different question,
          and the honest answer is that it is too early to see it in most of the
          statistics. This tracks both — what is measurable now, and what would
          have to change for the rest to show up.
        </p>

        {counts && (
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {[
              ['Observations', fmt(counts.observations, 0)],
              ['Indicators', fmt(counts.indicators, 0)],
              ['Countries', fmt(counts.countries, 0)],
              ['Sources', '24'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-caption-1-regular text-text-tertiary">{label}</dt>
                <dd className="text-title-3-medium tabular-nums text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* ── The argument, in order ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-title-3-medium text-text-primary">The argument</h2>
        <p className="mb-5 max-w-2xl text-body-regular text-text-tertiary">
          Five ways of looking at the same subject, in the order the causation
          is supposed to run. Each carries one live figure; none of them settles
          the question on its own.
        </p>

        <ol className="flex flex-col gap-3">
          {lenses.map((lens, index) => (
            <li key={lens.id}>
              <LensRow lens={lens} step={index + 1} />
            </li>
          ))}
        </ol>
      </section>

      {/* ── The rules the project holds itself to ────────────────────────── */}
      <section className="rounded-2xl border border-border-button-default bg-background-secondary-default p-5">
        <h2 className="text-title-3-medium text-text-primary">How to read this</h2>
        <dl className="mt-4 flex flex-col gap-4">
          {/* This slot used to promise two reading registers and tell the
              reader to "switch register in the header". The control it pointed
              at was wired to nothing and has been removed, so the promise went
              with it. Replaced by the one honesty rule that was not already
              stated in this list — the third entry below already covers
              model-written prose, and saying it twice would be worse than
              saying it once. */}
          <div>
            <dt className="text-body-medium text-text-primary">
              &ldquo;Not enough evidence&rdquo; is a real answer here
            </dt>
            <dd className="mt-1 text-body-regular text-text-secondary">
              Every question carries how far its own evidence goes, before you open it, and
              several of them say the data cannot settle the question yet. Where credible sources
              measuring the same period disagree, the page reports the disagreement rather than
              picking a side.
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 text-body-medium text-text-primary">
              <RiAlertLine className="size-4 shrink-0 text-warn" aria-hidden />
              What the data cannot show is a section, not a footnote
            </dt>
            <dd className="mt-1 text-body-regular text-text-secondary">
              Every question page states its own limits at the same weight as its answer, above
              the charts rather than buried under them. A page with no caveat is usually a page
              that has not been thought about.
            </dd>
          </div>
          <div>
            <dt className="text-body-medium text-text-primary">
              No number here was written by a language model
            </dt>
            <dd className="mt-1 text-body-regular text-text-secondary">
              Every figure is computed in SQL from a named source and every claim is written by
              a person. Sources, licences and the state of each ingestion job are public — see{' '}
              <Link
                to="/pipeline"
                className="text-accent-600 underline underline-offset-2 hover:text-accent-500"
              >
                where this comes from
              </Link>
              , including what is currently stale or broken.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

/**
 * One lens as a step in the argument.
 *
 * The number is the lens's lead ticker — an editorial choice made in the seed
 * by sort order, not whichever series happened to come back first. It is shown
 * without a delta badge where there is no previous period to compare, rather
 * than rendering a 0% that implies a measurement.
 */
function LensRow({ lens, step }) {
  const thesis = lens.thesis_plain;
  // The first sentence is the claim; the rest is support that belongs on the
  // lens page, not on a card someone is scanning.
  const claim = thesis?.split(/(?<=\.)\s/)[0] ?? '';

  // A symbol sits beside the number; a spelled-out unit does not.
  const symbol =
    lens.unit_symbol && lens.unit_symbol.length <= 3 ? lens.unit_symbol : null;

  const hasDelta =
    lens.latest_value != null && lens.previous_value != null && lens.previous_value !== 0;
  const change = hasDelta
    ? ((lens.latest_value - lens.previous_value) / Math.abs(lens.previous_value)) * 100
    : null;
  const direction = deltaDirection(change == null ? null : { value: change });

  return (
    <Link
      to={`/lens/${lens.slug}`}
      className="group flex gap-4 rounded-2xl border border-border-button-default bg-background-primary-default p-4 tint hover:bg-background-secondary-hover"
    >
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-background-secondary-default text-caption-1-medium tabular-nums text-text-tertiary"
        aria-hidden
      >
        {step}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-body-medium text-text-primary">{lens.name}</span>
          <RiArrowRightLine
            className="size-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
        <span className="mt-0.5 block text-caption-1-regular text-text-tertiary">
          {lens.subtitle}
        </span>
        <span className="mt-2 block text-body-regular text-text-secondary">{claim}</span>
        <span className="mt-2 block text-caption-1-regular text-text-tertiary">
          {lens.question_count} {lens.question_count === 1 ? 'question' : 'questions'}
        </span>
      </span>

      {lens.latest_value != null && (
        <span className="flex w-32 shrink-0 flex-col items-end text-right">
          <span className="w-full truncate text-caption-1-regular text-text-tertiary">
            {lens.lead_label}
          </span>
          {/* Only a real symbol ($, %) goes next to the figure. Several
              indicators carry a descriptive unit instead ("Index Dec
              1998=100", "documents per month"), which is longer than the
              number and belongs underneath it, not beside it.
              w-full matters: items-end lets a nowrap child exceed the column
              and escape the truncate entirely. */}
          <span className="mt-0.5 w-full truncate text-title-3-medium tabular-nums text-text-primary">
            {symbol ? withUnit(lens.latest_value, symbol) : fmt(lens.latest_value)}
          </span>
          {!symbol && lens.unit && (
            <span className="w-full truncate text-caption-1-regular text-text-tertiary" title={lens.unit}>
              {displayUnit(lens.unit)}
            </span>
          )}
          {change != null && (
            <span
              className={`mt-0.5 text-caption-1-medium tabular-nums ${
                direction === 'up'
                  ? 'text-pos'
                  : direction === 'down'
                    ? 'text-neg'
                    : 'text-text-tertiary'
              }`}
            >
              {direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→'}{' '}
              {Math.abs(change).toFixed(1)}%
            </span>
          )}
          {lens.latest_period && (
            <span className="mt-0.5 text-caption-1-regular text-text-tertiary">
              {fmtDate(lens.latest_period, 'monthly')}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
