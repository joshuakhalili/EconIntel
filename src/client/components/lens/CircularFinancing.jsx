import { RiArrowRightLine } from '@remixicon/react';
import { useFinancing } from '@/hooks/queries';
import { useReveal, revealClass } from '@/hooks/useReveal';
import { useCollapse, SeeMore } from '@/components/Collapsible';

/**
 * The circles in AI financing.
 *
 * WHY THIS IS NOT A NODE GRAPH
 *
 * The obvious rendering is a force-directed diagram: 59 entities, 23 arrows,
 * drag it around. It would look impressive and it would bury the finding. The
 * claim being made here is specific — money is leaving a company as investment
 * and coming back as revenue — and in a hairball that claim is one path among
 * many that a reader has to trace by eye.
 *
 * So each circle is its own card: who funded whom, how much, and what came
 * back the other way. Five cards, each stating one arrangement.
 *
 * THE TWO SIDES ARE NEVER ADDED, AND THE LAYOUT ENFORCES THAT
 *
 * Microsoft put $13bn into OpenAI; OpenAI committed $250bn back in Azure
 * purchases. Those numbers face in opposite economic directions and "$263bn"
 * describes nothing that happened. They are shown on opposite sides of the
 * card with the arrow between them, and no total appears anywhere — there is
 * deliberately no line this could be added onto.
 *
 * WHAT "CIRCULAR" MEANS HERE, PRECISELY
 *
 * A pair joined by both a capital leg and a commercial one. NOT "money went
 * both ways", which sounds equivalent and is not: NVIDIA is the payer on all
 * three of its CoreWeave edges — it invested, then committed to buying
 * capacity back from the company it had just funded — and a both-ways test
 * calls that two unrelated deals. The definition lives in
 * `repositories/events.js` and is applied in SQL, not here.
 *
 * NOTHING ON THIS COMPONENT IS INFERRED
 *
 * Every amount, date and party is a stored row with at least one citation.
 * Where a deal has no disclosed amount the card says so rather than estimating
 * one, and `loop_status = 'alleged'` is rendered as alleged.
 */
export default function CircularFinancing({ accent }) {
  const { data, isPending, isError } = useFinancing();
  const [ref, revealed] = useReveal();

  // A band that cannot render is absent, not empty. A heading followed by
  // "no data" is worse than the section not existing.
  if (isPending || isError) return null;

  const circles = data?.circles ?? [];
  if (circles.length === 0) return null;

  /*
   * WHETHER A PERSON HAS CHECKED THESE DEALS, STATED RATHER THAN ASSUMED.
   *
   * `is_verified` and `confidence_tier` are selected by financingGraph() and
   * were then dropped on the floor: nothing on this component read either, so
   * no reader was ever told that every one of the 23 deals is unverified.
   *
   * The header comment above says each row carries at least one citation, and
   * that is true — but a citation is a pointer to a claim, not a person having
   * confirmed it. Loading a deal from a report and checking a deal are
   * different acts, and the schema keeps them apart on purpose.
   *
   * Counted from the payload rather than written as a sentence, so this stops
   * saying "none" the moment one is actually verified. A hardcoded caveat goes
   * stale silently and then misrepresents in the other direction.
   */
  const edges = data?.edges ?? [];
  const verified = edges.filter((e) => e.is_verified).length;

  return (
    <section
      ref={ref}
      className={`relative mt-14 overflow-hidden rounded-3xl border border-border-button-default ${revealClass(revealed)}`}
    >
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{ background: `radial-gradient(90% 70% at 12% 0%, ${accent.glow}, transparent 70%)` }}
        aria-hidden
      />
      <div className="relative p-6 sm:p-10">
        <p className="eyebrow" style={{ color: accent.hex }}>
          Circular financing
        </p>
        <h2 className="mt-3 max-w-2xl text-title-1-medium leading-tight text-text-primary">
          {circles.length} arrangements where the money comes back
        </h2>
        <p className="prose-measure mt-3 text-body-regular leading-relaxed text-text-tertiary">
          In each of these, one company funded another and is also on the other
          side of a commercial commitment with it. That is not by itself
          improper — a chip maker investing in a customer is ordinary — but it
          means some of the revenue counted as demand for AI was paid for with
          money the seller supplied. The two sides face opposite ways and are
          never added here.
        </p>

        {/* Sits with the introduction, not in a footnote under the ledger. The
            reader meets the claim and its standing in the same breath — putting
            it below the cards means it is read after the arrangements have
            already been believed. */}
        <p className="prose-measure mt-3 text-body-regular leading-relaxed text-warn">
          {verified === 0
            ? `Every one of these ${edges.length} deals is drawn from public reporting and none has been checked by a person. Amounts and dates are as announced, which is not the same as as happened.`
            : `${verified} of these ${edges.length} deals have been checked by a person against their sources; the remaining ${edges.length - verified} are drawn from public reporting as announced.`}
        </p>

        <ul className="mt-8 flex flex-col gap-4">
          {circles.map((circle) => (
            <li key={`${circle.funder.id}-${circle.funded.id}`}>
              <Circle circle={circle} accent={accent} />
            </li>
          ))}
        </ul>

        <Ledger edges={data.edges ?? []} />
      </div>
    </section>
  );
}

function Circle({ circle, accent }) {
  const { funder, funded, capital, commercial, capitalUsd, commercialUsd, reverses } = circle;

  /*
   * `.some`, NOT `.every` — and the difference was a live honesty bug.
   *
   * This read `.every((l) => l.loop_status === 'alleged')`, so the "reported,
   * not confirmed" warning appeared only when EVERY leg was alleged. One
   * confirmed leg among several alleged ones silenced it entirely.
   *
   * Measured against the shipped data, that is not hypothetical. Of the five
   * circles, exactly one mixes statuses — microsoft <-> mistral, three legs,
   * two `alleged` and one `forms_loop`. The single confirmed leg made `every`
   * false, so THE MOST SPECULATIVE ARRANGEMENT IN THE SET was the only one
   * rendering with no warning at all. The other four are uniformly
   * `forms_loop` and correctly showed nothing, which is why it looked right.
   *
   * A caveat that switches off as a circle gets more speculative is worse than
   * no caveat, because the reader learns to trust its absence. If any leg is
   * only reported, the arrangement as a whole is only reported.
   */
  const alleged = [...capital, ...commercial].some((l) => l.loop_status === 'alleged');

  return (
    <div className="rounded-2xl border border-border-button-default bg-panel p-5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-body-medium text-text-primary">{funder.name}</span>
        <RiArrowRightLine className="size-4 shrink-0 text-text-tertiary" aria-hidden />
        <span className="text-body-medium text-text-primary">{funded.name}</span>
        {alleged && (
          <span className="text-caption-1-regular" style={{ color: 'var(--color-warn)' }}>
            reported, not confirmed
          </span>
        )}
      </div>

      {/* The two sides, opposed. A grid rather than a list so the opposition is
          spatial: capital going right, commitment coming back left. */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Leg
          label={`${funder.name} put in`}
          amountUsd={capitalUsd}
          legs={capital}
          accent={accent}
        />
        <Leg
          label={
            reverses
              ? `${funded.name} committed back`
              : `${funder.name} committed to buy back`
          }
          amountUsd={commercialUsd}
          legs={commercial}
          accent={accent}
          reversed
        />
      </div>

      <p className="mt-4 text-caption-1-regular text-text-tertiary">
        {reverses
          ? 'Money moves in both directions between these two.'
          : 'The same company is on the paying side of both legs — it funded the counterparty, then bought capacity back from it.'}
      </p>
    </div>
  );
}

function Leg({ label, amountUsd, legs, accent, reversed = false }) {
  return (
    <div
      className={`rounded-xl border border-border-button-default p-4 ${reversed ? 'sm:text-right' : ''}`}
      style={{ boxShadow: `inset 2px 0 0 ${reversed ? 'transparent' : accent.ring}` }}
    >
      <p className="text-caption-1-regular text-text-tertiary">{label}</p>
      <p className="figure mt-1 text-title-2-medium text-text-primary">
        {amountUsd > 0 ? usd(amountUsd) : 'undisclosed'}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {legs.map((leg) => (
          <li key={leg.event_id} className="text-caption-1-regular text-text-tertiary">
            <span className="figure">{leg.announced_date}</span>
            {' · '}
            {leg.kind.replace(/_/g, ' ')}
            {leg.amount_usd ? ` · ${usd(Number(leg.amount_usd))}` : ' · amount not disclosed'}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Every deal, not only the circular ones.
 *
 * A page that showed only the five circles would be selecting the evidence
 * that supports its own headline. The other eighteen edges are here, collapsed
 * behind the same See more primitive the news bento uses.
 */
function Ledger({ edges }) {
  const { visible, hiddenCount, expanded, expand, collapse } = useCollapse(edges, {
    initial: 6,
    step: 12,
  });

  if (edges.length === 0) return null;

  return (
    <div className="mt-10 border-t border-border-button-default pt-6">
      <h3 className="text-title-3-medium text-text-primary">Every deal held</h3>
      <p className="prose-measure mt-2 text-body-regular text-text-tertiary">
        All {edges.length}, circular or not. Nine more were found and rejected —
        six of them because the source URL was dead — and the reasons are
        recorded in the repository.
      </p>

      <ul className="mt-5 flex flex-col">
        {visible.map((edge) => (
          <li
            key={edge.event_id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-border-button-default py-3 first:border-t-0 first:pt-0"
          >
            <span className="figure w-24 shrink-0 text-caption-1-regular text-text-tertiary">
              {edge.announced_date}
            </span>
            <span className="min-w-0 flex-1 text-body-regular text-text-secondary">
              {edge.from_name}
              <span className="text-text-tertiary"> → </span>
              {edge.to_name ?? '—'}
            </span>
            <span className="text-caption-1-regular text-text-tertiary">
              {edge.kind.replace(/_/g, ' ')}
            </span>
            <span className="figure w-24 shrink-0 text-right text-caption-1-regular text-text-primary">
              {edge.amount_usd ? usd(Number(edge.amount_usd)) : '—'}
            </span>
          </li>
        ))}
      </ul>

      <SeeMore
        hiddenCount={hiddenCount}
        expanded={expanded}
        onExpand={expand}
        onCollapse={collapse}
        label="more deals"
      />
    </div>
  );
}

/**
 * Billions, to one decimal, or millions below a billion.
 *
 * Never abbreviated past the point of being checkable: these are the headline
 * numbers of the whole feature and a reader should be able to match one
 * against the filing it came from.
 */
function usd(value) {
  if (!Number.isFinite(value) || value === 0) return '—';
  if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}bn`;
  if (Math.abs(value) >= 1e6) return `$${Math.round(value / 1e6)}m`;
  return `$${value.toLocaleString()}`;
}
