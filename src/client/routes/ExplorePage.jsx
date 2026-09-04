import { useMemo, useState } from 'react';
import { RiCloseLine, RiSearchLine } from '@remixicon/react';
import { useIndicators, useSeries } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock, EmptyBlock, Section } from '@/components/Page';
import ChartCard from '@/components/charts/ChartCard';
import PageHero from '@/components/PageHero';
import CountrySelect from '@/components/CountrySelect';
import { useContextDrawer } from '@/components/chrome/ContextDrawer';
import SeriesChart from '@/components/charts/SeriesChart';
import { useSeriesPalette, exceedsPalette } from '@/components/charts/palette';
import { displayUnit } from '@/lib/format';

/**
 * The server rejects more than this in one request.
 *
 * It is NOT the honest maximum, and it used to be used as one. See `seriesCap`.
 */
const SERVER_MAX_SERIES = 12;

/** How many rows of the catalogue the picker shows before a reader searches. */
const PICKER_CAP = 40;

/**
 * Build a chart.
 *
 * The one thing this page must get right is that picking two indicators with
 * different units does not produce a chart with two y-axes. When the units
 * differ the request is sent with index=true and the server rebases every
 * series to 100 at a shared base period, which is stated on the chart rather
 * than left for the reader to infer from the numbers.
 *
 * THE PALETTE CEILING BINDS HERE TOO, AND FOR A WHILE IT DID NOT.
 *
 * This page carried `MAX_SERIES = 12` — the series endpoint's fan-out cap —
 * and treated it as the limit on what could be drawn. It is not. Everything
 * here renders through SeriesChart → LineChart, which colours by
 * `colorAt(palette, index)`, and that wraps: with six validated hues, series
 * seven is drawn in series one's colour and SeriesLegend shows two identical
 * swatches for two different indicators. `ChartGroup` was built to refuse
 * exactly that after ISSUE-008 and the guard was added to one caller only —
 * which left the refusal missing from the single page on this site whose whole
 * purpose is letting a reader compose their own chart. See HONESTY.md
 * behaviour 10, and `exceedsPalette` in charts/palette.js.
 */
export default function ExplorePage() {
  const { data: indicators, isPending, isError, error } = useIndicators({ hasData: true });
  const [chosen, setChosen] = useState([]);
  // Country per chosen indicator, keyed by id. Many indicators hold every
  // country under one id, and asking without naming one returns them all
  // flattened together.
  const [countries, setCountries] = useState({});
  const [search, setSearch] = useState('');
  const { open } = useContextDrawer();
  const palette = useSeriesPalette();

  usePageTitle('Build a chart', 'Put any indicators on one pair of axes');

  const maxSeries = seriesCap(palette.length, SERVER_MAX_SERIES);

  const chosenMeta = useMemo(
    () => chosen.map((id) => indicators?.find((i) => i.id === id)).filter(Boolean),
    [chosen, indicators]
  );

  // Different units cannot share a scale. Indexing is the only honest way to
  // put them on one axis; a second axis is not an option.
  const units = new Set(chosenMeta.map((i) => displayUnit(i.unit)).filter(Boolean));
  const mustIndex = units.size > 1;

  // Positional: the endpoint pairs the nth country with the nth id, so a blank
  // is sent for indicators that do not need one.
  const countryList = chosen.map((id) => countries[id] ?? '');

  // Never send a request that could only come back as a chart which repeats a
  // colour. `toggle` already refuses the seventh; this is the same fact stated
  // where the request is made, so a chosen list arriving from anywhere else —
  // a restored state, a future URL parameter — cannot get past it either.
  const tooManySeries = exceedsPalette(chosen.length, palette);

  const { data: payload, isPending: seriesPending, isError: seriesError, error: seriesErrorObj } =
    useSeries(chosen, { countries: countryList, index: mustIndex }, { enabled: !tooManySeries });

  const found = useMemo(
    () => pickMatches(indicators, search, PICKER_CAP),
    [indicators, search]
  );

  if (isPending) return <LoadingBlock rows={3} />;
  if (isError) return <ErrorBlock error={error} what="the indicator list" />;

  const atCap = chosen.length >= maxSeries;

  const toggle = (id) => setChosen((current) => nextChosen(current, id, maxSeries));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHero eyebrow="Workbench" title="Build a chart">
        Put any indicators on one pair of axes. Where the units differ they are
        rebased to 100 at a shared period and the chart says so — there is no
        second y-axis here, because a second scale lets any two lines be made to
        cross wherever the author chooses.
      </PageHero>

      <section className="mt-10 rounded-3xl border border-border-button-default bg-panel p-5 sm:p-6">
        <h2 className="text-title-3-medium text-text-primary">Pick the indicators</h2>
        <p className="mt-1 text-body-regular text-text-tertiary">
          Up to {maxSeries} at once — one for each colourblind-validated hue.
        </p>

        <label className="tint mt-4 flex items-center gap-2 rounded-2xl bg-raised px-4 py-3 focus-within:ring-1 focus-within:ring-signal">
          <RiSearchLine className="size-4 shrink-0 text-text-tertiary" aria-hidden />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            /* Counted, not hardcoded. This said "Search 110 indicators…" while
               the catalogue held 128 with data — a number frozen at whatever
               it was the day the placeholder was typed. */
            placeholder={`Search ${indicators?.length ?? 0} indicators…`}
            className="min-w-0 flex-1 bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-tertiary"
          />
        </label>

        {chosen.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {chosenMeta.map((indicator) => (
              <li key={indicator.id} className="flex flex-wrap items-center gap-2">
                {/* The fill, with white on it — the site's one interactive
                    colour. Not a BoardUI chip: those carry their own palette,
                    and `color="blue"` there is a different blue from this
                    site's. */}
                <button
                  type="button"
                  onClick={() => toggle(indicator.id)}
                  aria-label={`Remove ${indicator.name}`}
                  className="tint inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-caption-1-medium text-on-fill"
                  style={{ background: 'var(--color-electric)' }}
                >
                  {indicator.name}
                  <RiCloseLine className="size-3.5 shrink-0" aria-hidden />
                </button>
                <CountrySelect
                  indicator={indicator}
                  value={countries[indicator.id]}
                  onChange={(iso3) =>
                    setCountries((current) => ({ ...current, [indicator.id]: iso3 }))
                  }
                />
              </li>
            ))}
          </ul>
        )}

        {/*
          ABOVE the list, not below it.

          A reader who has reached the ceiling meets rows that no longer
          respond, and a refusal printed under a scroller they have already
          scrolled past is a refusal nobody reads. Same sentence ChartGroup
          gives, for the same reason.
        */}
        {atCap && (
          <p className="mt-4 rounded-xl border border-border-button-default p-3 text-body-regular text-text-secondary">
            {maxSeries} is the most this chart can carry: there are {palette.length}{' '}
            colourblind-validated colours and they are never repeated, because two
            indicators drawn in one colour with a legend claiming otherwise is a chart
            that lies about which line is which. Remove one to add another.
          </p>
        )}

        <ul className="mt-4 max-h-72 overflow-y-auto">
          {found.rows.map((indicator) => {
            const isChosen = chosen.includes(indicator.id);
            return (
              <li key={indicator.id}>
                <button
                  type="button"
                  onClick={() => toggle(indicator.id)}
                  aria-pressed={isChosen}
                  disabled={atCap && !isChosen}
                  className="tint flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-raised disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-body-regular text-text-primary">
                      {indicator.name}
                    </span>
                    <span
                      className="block truncate text-caption-1-regular text-text-tertiary"
                      title={indicator.unit ?? undefined}
                    >
                      {displayUnit(indicator.unit)} · {indicator.cadence} ·{' '}
                      {indicator.confidence_tier}
                    </span>
                  </span>
                  {isChosen && (
                    <span className="shrink-0 text-caption-1-medium" style={{ color: 'var(--color-signal)' }}>
                      Added
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {found.rows.length === 0 && (
            <li className="px-3 py-3 text-body-regular text-text-tertiary">
              Nothing matches “{search}”.
            </li>
          )}
        </ul>

        {/*
          THE LIST WAS TRUNCATED SILENTLY AND THE PLACEHOLDER SAID OTHERWISE.

          `pool.slice(0, 40)` inside a `max-h-72` scroller showing six rows at a
          time meant a reader scrolled to the end of a list that had stopped 94
          indicators short, next to a placeholder correctly offering to search
          all of them. A series that exists reads as one the catalogue does not
          hold. The count is stated, and a search lifts the cap outright — a
          reader who has typed something has narrowed the list themselves.
        */}
        {found.rows.length > 0 && (
          <p className="mt-3 text-caption-1-regular text-text-tertiary">
            {found.capped
              ? `Showing the first ${found.rows.length} of ${found.total} indicators — search to see the rest.`
              : found.matched === found.total
                ? `All ${found.total} indicators.`
                : `${found.matched} of ${found.total} indicators match “${search.trim()}”.`}
          </p>
        )}
      </section>

      <Section title="The chart">
        {chosen.length === 0 ? (
          <EmptyBlock>Pick an indicator above to draw it.</EmptyBlock>
        ) : tooManySeries ? (
          /*
           * Unreachable through the picker, which refuses the seventh. Kept
           * anyway: the refusal belongs where the chart is drawn as well as
           * where the choice is made, and a state arriving from anywhere but a
           * click must meet it too.
           */
          <div className="rounded-2xl border border-border-button-default p-5">
            <p className="text-body-regular text-text-secondary">
              Not drawn: {chosen.length} series on one pair of axes, and there are only{' '}
              {palette.length} validated colours. Drawing it would give different series
              the same colour and a legend that says otherwise.
            </p>
            <p className="mt-2 text-caption-1-regular text-text-tertiary">
              {chosenMeta.map((i) => i.name).join(' · ')}
            </p>
          </div>
        ) : (
          <ChartCard
            title={chosenMeta.map((i) => i.name).join(' · ')}
            caption={
              // What the request asked for (`mustIndex`) and what the
              // response actually managed (`payload.indexed`, per-series
              // `indexed`) can differ — a series anchored at 0, or no shared
              // period at all, means "every series" would be a lie. See the
              // per-series raw/dashed handling in SeriesChart for the case
              // where only some of them got rebased.
              mustIndex && payload?.indexed
                ? 'These indicators use different units, so series are rebased to 100 at their first shared period (dashed lines stayed in raw units — see the chart below). The shape is comparable; the levels are not.'
                : mustIndex && payload?.indexNote
                  ? payload.indexNote
                  : undefined
            }
            footer={
              <span>
                {[...new Set(chosenMeta.map((i) => i.source_id).filter(Boolean))].join(', ')}
              </span>
            }
          >
            {seriesPending && <LoadingBlock rows={1} />}
            {seriesError && <ErrorBlock error={seriesErrorObj} what="the series" />}
            {payload && <SeriesChart payload={payload} height={320} onPick={open} />}
          </ChartCard>
        )}
      </Section>
    </div>
  );
}

/**
 * The honest maximum number of series this page will draw.
 *
 * TWO CEILINGS, AND THE LOWER ONE WINS. The server refuses more than twelve ids
 * in one request; the palette refuses more than there are validated hues. Only
 * the second is about whether the result can be READ, so it is the one that has
 * to be enforced in the interface — the endpoint cap arrives as a 400 written
 * for an API caller, and a wrapped colour arrives as a chart that looks fine.
 *
 * Exported so `reader-pages.test.js` can hold it to seven series without a DOM.
 */
export function seriesCap(paletteLength, serverCap) {
  return Math.min(serverCap, paletteLength);
}

/**
 * Add or remove one indicator, refusing to go past the cap.
 *
 * Returns the list unchanged when it is full, which is what the disabled rows
 * and the sentence above them are describing.
 */
export function nextChosen(chosen, id, cap) {
  if (chosen.includes(id)) return chosen.filter((x) => x !== id);
  if (chosen.length >= cap) return chosen;
  return [...chosen, id];
}

/**
 * Which indicators the picker lists, and what it has to admit about that.
 *
 * The cap is a first-screen convenience — 134 rows in a scroller is not a
 * chooser — so it applies only to the unsearched list, and `capped` says when
 * it bit. A reader who has typed a term has already narrowed the catalogue and
 * gets every match, however many that is.
 */
export function pickMatches(indicators, term, cap) {
  const list = indicators ?? [];
  const needle = String(term ?? '').trim().toLowerCase();
  const pool = needle
    ? list.filter(
        (i) =>
          (i.name ?? '').toLowerCase().includes(needle) ||
          (i.id ?? '').toLowerCase().includes(needle) ||
          (i.pillar ?? '').toLowerCase().includes(needle)
      )
    : list;
  const rows = needle ? pool : pool.slice(0, cap);
  return { rows, matched: pool.length, total: list.length, capped: rows.length < pool.length };
}
