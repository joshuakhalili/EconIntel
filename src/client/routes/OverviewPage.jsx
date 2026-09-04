import { Link } from 'react-router-dom';
import { RiArrowRightLine, RiAlertLine } from '@remixicon/react';
import { useOverview, useStatus, useQuestions, useScenarios } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import { figureDelta, isFuturePeriod } from '@/components/periodModel';
import { fmt, withUnit, fmtDate, fmtDay, deltaDirection, displayUnit } from '@/lib/format';

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
 *
 * WHAT THIS PAGE WAS MISSING, AND WHY THE ADDITIONS ARE SHAPED AS THEY ARE
 *
 * It was an explainer with no sense of time and one outbound link that was not
 * a lens: /data, /news, /explore and /simulate were unreachable from the page
 * every reader lands on, and nothing differed between a first visit and a
 * fiftieth. Three bands now answer that — "what changed", "start here",
 * "tools" — and every figure in them is read from an endpoint this page
 * already calls, or from one that returns editorial structure. None of it is a
 * stat card: colour is reserved for the one thing on the page a reader might
 * need to act on, which is a failed job.
 *
 * THE FIGURES UNDER THE HEADLINE ARE ALL LOOKED UP NOW
 *
 * "Sources" was the string literal '24' while /pipeline listed 17, /data
 * reported 8 and the register held 25 rows — the one typed number on the front
 * page of a site whose pitch is that nothing is typed, and it was the number
 * describing its own provenance. "Countries" was `count(*) FROM countries`, a
 * row count of a dimension table in which six rows are aggregates. Both now
 * come from /api/status, which computes coverage rather than table size, and
 * each carries the qualifier that stops the headline figure being read as more
 * than it is.
 */
export default function OverviewPage() {
  const { data: lenses, isPending, isError, error } = useOverview();
  const { data: status } = useStatus();
  const { data: questions } = useQuestions();
  const { data: scenarios } = useScenarios();

  usePageTitle('Diffusion', 'Measuring AI’s effect on the economy');

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="the overview" />;

  const counts = status?.counts;

  /* A figure whose value did not arrive is left out rather than filled in.
     An older server that has not got these columns yet should show three
     honest figures, never a fourth invented one. */
  const figures = [
    ['Observations', counts?.observations, null],
    ['Indicators', counts?.indicators, null],
    [
      'Countries',
      counts?.countries_with_data,
      counts?.countries_with_depth == null
        ? null
        : `${counts.countries_with_depth} with more than six series`,
    ],
    [
      'Sources',
      counts?.sources_supplying,
      counts?.sources_registered == null
        ? null
        : `of ${counts.sources_registered} registered, supplying data today`,
    ],
  ].filter(([, value]) => value != null);

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

        {figures.length > 0 && (
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {figures.map(([label, value, qualifier]) => (
              <div key={label} className="max-w-56">
                <dt className="text-caption-1-regular text-text-tertiary">{label}</dt>
                {/* Exact, not abbreviated. PageHero makes the same argument for
                    the same reason: a page describing the size of a catalogue
                    is the one place a rounded figure undercuts what it is
                    saying, and this page was printing "75.9k" while /pipeline
                    printed 75,934. */}
                <dd className="text-title-3-medium tabular-nums text-text-primary">
                  {value.toLocaleString('en-GB')}
                </dd>
                {qualifier && (
                  <dd className="mt-0.5 text-caption-1-regular text-text-tertiary">
                    {qualifier}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        )}
      </section>

      <WhatChanged status={status} />

      {/* ── The argument, in order ───────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-1 text-title-3-medium text-text-primary">The argument</h2>
        <p className="mb-5 max-w-2xl text-body-regular text-text-tertiary">
          Five ways of looking at the same subject, in the order the causation
          is supposed to run. Each carries one live figure; none of them settles
          the question on its own.
          {/* Conditional, and it removes itself. A row can only state its
              movement once the payload says what kind of quantity it is —
              a rate moves in points, a count in percent — and /api/overview
              does not carry that yet. Saying so is better than a reader
              wondering where the arrows went; hardcoding the sentence would
              leave it on the page after the field lands. */}
          {!lenses.some((lens) => figureDelta(lens).delta) && (
            <>
              {' '}
              Movement since the previous period is shown on each lens page,
              where the series&rsquo; own unit is known.
            </>
          )}
        </p>

        <ol className="flex flex-col gap-3">
          {lenses.map((lens, index) => (
            <li key={lens.id}>
              <LensRow lens={lens} step={index + 1} />
            </li>
          ))}
        </ol>
      </section>

      <StartHere lenses={lenses} questions={questions} counts={counts} />
      <Tools scenarios={scenarios} />

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
          {/* THIS SLOT USED TO DENY THE EXCEPTION IT WAS DESCRIBING.

              It read "No number here was written by a language model — every
              figure is computed in SQL from a named source and every claim is
              written by a person." The first half is true and is the best thing
              this site has. The second half was false two clicks away: every
              lens page renders a paragraph under a heading reading "Written by
              a machine from the figures above", attributed to
              @cf/meta/llama-3.1-8b-instruct — and it was false in the one panel
              a reader opens in order to decide whether to believe the rest.

              NarrationBlock's own header comment states the rule this broke:
              an exception that is not visible is not an exception. It was
              visible on the lens page and denied here.

              Every clause below was checked against what the code does on
              4 September 2026 rather than against what it ought to do:
                • all five lenses hold a narration row matching the current
                  PROMPT_VERSION, unexpired, and all five have tickers, so the
                  block renders on each of them;
                • buildLensGrounding caps the payload at six of that lens's own
                  tickers (lib/narration.js:261);
                • narrate() stores nothing whose figures are not in that payload
                  — validate() rejected an invented 13552 → 9999 on the live
                  investment grounding — so the paragraph cannot carry a number
                  nobody measured;
                • the disclosure button showing that payload is real, and every
                  stored narration carries between three and six series.

              WHAT IS DELIBERATELY NOT CLAIMED HERE. NarrationBlock's disclosure
              panel also says every rise-or-fall claim was checked. That gate
              exists but declines on the prose it actually guards: wrongDirection
              splits clauses on a full stop only when it is not preceded by a
              digit, and the stored bodies end every sentence in a figure, so a
              two-sentence narration collapses into one clause carrying both a
              rise word and a fall word and the check gives up as undecidable.
              Flipping "down" to "up" in the live investment narration is not
              caught. Repeating that promise on the front page would be making
              the same mistake this block exists to fix. */}
          <div>
            <dt className="text-body-medium text-text-primary">
              No figure here is invented — and where a machine wrote the prose, it says so
            </dt>
            <dd className="mt-1 text-body-regular text-text-secondary">
              Every figure is computed in SQL from a named source, and every claim is written by
              a person — with one exception, labelled wherever it appears. Each lens page
              carries a short summary paragraph written by a language model from at most six of
              that lens&rsquo;s own ticker figures. It sits below the figures it describes, under
              a heading saying a machine wrote it, and the exact numbers the model was handed are
              one click away underneath it
              {lenses[0]?.slug && (
                <>
                  {' — '}
                  <Link
                    to={`/lens/${lenses[0].slug}`}
                    className="text-accent-600 underline underline-offset-2 hover:text-accent-500"
                  >
                    see one
                  </Link>
                </>
              )}
              . Sources, licences and the state of each ingestion job are public — see{' '}
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
 * What has moved since the reader was last here.
 *
 * Built entirely from /api/status, which this page already fetches for the
 * figure row, so it costs no extra request. Three sentences, not three tiles:
 * the newest measurement the site holds, what the overnight jobs did, and how
 * much of the catalogue has stopped publishing. The last two are the honest
 * counterweight to the first — a page that says "newest figure: yesterday"
 * and nothing else is describing its fastest series and implying it of all
 * of them.
 *
 * A FORECAST IS NOT THE NEWEST MEASUREMENT. One source in the register carries
 * a valued row dated a year into the future (European Commission projections
 * inside an AMECO history). Taking a plain maximum over source periods would
 * make the site's "newest figure" a number nobody has measured, so future
 * periods are excluded here and marked where they are shown.
 */
function WhatChanged({ status }) {
  if (!status) return null;

  const sources = status.sources ?? [];
  const runs = status.recentRuns ?? [];
  const stale = status.staleIndicators ?? [];

  const measured = sources.filter(
    (s) => s.latest_period && !isFuturePeriod(s.latest_period)
  );
  const newest = measured.reduce(
    (best, s) => (best == null || s.latest_period > best.latest_period ? s : best),
    null
  );

  const failed = runs.filter((r) => r.status === 'failed');
  const wrote = runs.filter((r) => (r.rows_written ?? 0) > 0);
  const worst = stale[0];

  /*
   * THE STALE LIST IS CAPPED, AND THIS PAGE CANNOT SEE THE CAP.
   *
   * /api/status's staleness query ends `LIMIT 40` and the response carries the
   * list with no total, so `stale.length` is the length of a truncated list and
   * not a count of what is late. It is 38 today, which makes the old sentence —
   * "38 series have stopped publishing" — true, and true is exactly the problem:
   * it goes false on its own the moment two more series fall behind, with
   * nothing on the page changing and nothing to notice.
   *
   * "At least" is true whether the list is complete or truncated, so the
   * sentence cannot lie in either state. It is a placeholder for the real fix,
   * which is the endpoint publishing the uncapped count — the branch below uses
   * `counts.stale_indicators` the moment it exists and drops the hedge, so
   * landing that field is a one-line server change with no edit here.
   *
   * `worst` survives the cap untouched: the query orders by days_behind DESC, so
   * the first row is the furthest behind whether or not the list was cut.
   */
  const staleTotal = status.counts?.stale_indicators ?? null;
  const staleCount = staleTotal ?? stale.length;

  const lines = [];

  if (newest) {
    lines.push(
      <>
        The newest measurement held anywhere on this site is{' '}
        <strong className="font-normal text-text-primary">
          {fmtDay(newest.latest_period)}
        </strong>
        , from {newest.name}.
      </>
    );
  }

  if (runs.length > 0) {
    lines.push(
      <>
        Of the last {runs.length} ingestion runs, {wrote.length} brought back new rows and{' '}
        {failed.length === 0 ? (
          <>none failed</>
        ) : (
          <span style={{ color: 'var(--color-neg)' }}>
            {failed.length} failed
          </span>
        )}
        .
      </>
    );
  }

  if (stale.length > 0) {
    lines.push(
      <>
        {staleTotal == null && 'At least '}
        {staleCount} {staleCount === 1 ? 'series has' : 'series have'} stopped publishing inside{' '}
        {staleCount === 1 ? 'its' : 'their'} own cadence
        {worst?.latest_period && (
          <> — the furthest behind is {worst.name}, last updated {fmtDay(worst.latest_period)}</>
        )}
        .
      </>
    );
  }

  if (lines.length === 0) return null;

  return (
    <section className="mb-10 rounded-2xl border border-border-button-default p-5">
      <h2 className="text-title-3-medium text-text-primary">What changed</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {lines.map((line, i) => (
          <li key={i} className="text-body-regular text-text-secondary">
            {line}
          </li>
        ))}
      </ul>
      <Link
        to="/pipeline"
        className="mt-4 inline-flex items-center gap-1.5 text-body-regular text-accent-600 underline underline-offset-2 hover:text-accent-500"
      >
        Every source, job and late series
        <RiArrowRightLine className="size-4 shrink-0" aria-hidden />
      </Link>
    </section>
  );
}

/**
 * Three named ways in, rather than three categories.
 *
 * The question is picked from the data, not typed here: the first question of
 * the first lens, which is the ordering the editorial layer already made in
 * the seed — the same principle `overview()` uses to choose each lens's lead
 * ticker. Naming a slug in this file would be an editorial decision made in
 * the client, and it would rot silently the first time the seed reordered.
 *
 * The right three, per the audit, are the most contested question and the one
 * marked 'consistent' — `questions.strength` decides both. /api/questions does
 * not return that column, so it cannot be done here; see the report.
 */
function StartHere({ lenses, questions, counts }) {
  const firstLensId = lenses?.[0]?.id;
  const opening = (questions ?? [])
    .filter((q) => q.lens_id === firstLensId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0];

  const entries = [];

  if (opening) {
    entries.push({
      to: `/q/${opening.slug}`,
      title: opening.question,
      note: 'The first question in the argument, with its evidence and its limits.',
    });
  }

  if (counts?.indicators != null) {
    entries.push({
      to: '/data',
      title: `Every series behind this — all ${counts.indicators.toLocaleString('en-GB')}`,
      note: 'What each one measures, who publishes it, and on what licence.',
    });
  }

  if (counts?.documents != null) {
    entries.push({
      to: '/news',
      title: 'What is being written about it',
      note: `${counts.documents.toLocaleString('en-GB')} collected. A lens shows the ones its own search matches.`,
    });
  }

  if (entries.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-4 text-title-3-medium text-text-primary">Start here</h2>
      <ul className="grid gap-3 sm:grid-cols-3">
        {entries.map((entry) => (
          <li key={entry.to}>
            <EntryCard {...entry} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The two features that had no front door anywhere on the site.
 *
 * Neither /explore nor /simulate/:slug was linked from the nav, the overview,
 * a lens, a question or the landing page — the simulation, which is the most
 * carefully sourced page here, could be reached only by typing its URL. The
 * scenario's name and slug come from /api/simulations rather than being
 * written down, so a second scenario appears here on its own.
 */
function Tools({ scenarios }) {
  const list = scenarios ?? [];

  return (
    <section className="mb-10">
      <h2 className="mb-4 text-title-3-medium text-text-primary">Tools</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li>
          <EntryCard
            to="/explore"
            title="Build a chart"
            note="Put any series in the catalogue on one axis and see whether they move together."
          />
        </li>
        {list.map((scenario) => (
          <li key={scenario.slug}>
            <EntryCard
              to={`/simulate/${scenario.slug}`}
              title={scenario.name}
              note={
                scenario.subtitle ??
                'A projection, not a measurement — every coefficient carries its citation.'
              }
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One way in: a name, a sentence saying what it is, and nothing else. */
function EntryCard({ to, title, note }) {
  return (
    <Link
      to={to}
      className="group flex h-full flex-col rounded-2xl border border-border-button-default bg-background-primary-default p-4 tint hover:bg-background-secondary-hover"
    >
      <span className="flex items-start gap-2">
        <span className="min-w-0 flex-1 text-body-medium text-text-primary">{title}</span>
        <RiArrowRightLine
          className="mt-0.5 size-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
      <span className="mt-1 block text-caption-1-regular text-text-tertiary">{note}</span>
    </Link>
  );
}

/**
 * One lens as a step in the argument.
 *
 * The number is the lens's lead ticker — an editorial choice made in the seed
 * by sort order, not whichever series happened to come back first. It is shown
 * without a delta badge where there is no previous period to compare, rather
 * than rendering a 0% that implies a measurement.
 *
 * THE DELTA IS COMPUTED BY THE SAME FUNCTION THE TICKER STRIP USES.
 *
 * It used to be computed here, as percent-of-previous for everything, while
 * TickerStrip deliberately reported a rate in percentage points — so the same
 * series printed "↑ 22.4%" on this page and "↑ 11.2pp" one click later, and
 * the ticker's own comment called this page's version the bug. There is one
 * function now, in periodModel.js, and it also refuses to compare a period
 * that has not finished — which is what put "Rules in force ↓ 90.0%" here on
 * the third day of September, comparing three days against a whole August.
 *
 * It reports nothing at all today, because deciding between points and percent
 * needs `quantity_kind` and deciding whether a period is still running needs
 * `previous_period`, and /api/overview carries neither. A value with no arrow
 * is a smaller loss than an arrow that is wrong on two counts, and the moment
 * those two fields appear in the payload the badge returns, correct, with no
 * change here.
 */
function LensRow({ lens, step }) {
  const thesis = lens.thesis_plain;
  // The first sentence is the claim; the rest is support that belongs on the
  // lens page, not on a card someone is scanning.
  const claim = thesis?.split(/(?<=\.)\s/)[0] ?? '';

  // A symbol sits beside the number; a spelled-out unit does not.
  const symbol =
    lens.unit_symbol && lens.unit_symbol.length <= 3 ? lens.unit_symbol : null;

  const { delta, toDate } = figureDelta(lens);
  const direction = deltaDirection(delta);

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
          {delta && (
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
              {Math.abs(delta.value).toFixed(1)}
              {delta.unit}
            </span>
          )}
          {lens.latest_period && (
            <span className="mt-0.5 text-caption-1-regular text-text-tertiary">
              {fmtDate(lens.latest_period, 'monthly')}
              {toDate ? ` · ${toDate}` : ''}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}
