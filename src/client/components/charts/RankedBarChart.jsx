import { useMemo } from 'react';
import { useSeries } from '@/hooks/queries';
import { fmt, fmtDate, displayUnit, inferCadence } from '@/lib/format';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import { useSeriesPalette, colorAt } from './palette';
import {
  rankEntities,
  panelsOf,
  describeRankedChart,
  rankedTableModel,
} from './chartModel';
import ChartDataTable from './ChartDataTable';

/*
 * The thirteen chart honesty behaviours this project treats as non-negotiable
 * are written down once, next to this file, in HONESTY.md — with the file and
 * line implementing each. Four of them are here: the zero baseline a bar chart
 * may never leave, the palette ceiling this form is the answer to, the period
 * printed on every bar, and the screen-reader table. Read it before changing
 * anything.
 */

/**
 * The form for more categorical series than there are hues.
 *
 * WHY THIS COMPONENT EXISTS
 *
 * `chart_group` 'ai-adoption-panel' holds sixteen countries and the validated
 * palette holds six hues, so `ChartGroup` refused to draw it and `/q/adoption`
 * — the question this project is named after — shipped a grey box of apology
 * where its evidence should be. `youth-unemployment` (eight countries, the hero
 * chart of `/q/entry-level`) did the same, and nobody knew.
 *
 * The refusal was right. Sixteen lines cycling six hues is a chart that renders
 * and lies about which line is which, and a wrong chart that renders is worse
 * than one that refuses because nobody investigates it.
 *
 * The answer is a form where COLOUR IS NOT THE ENCODING. Every bar here is the
 * same hue. Rank carries what colour was carrying, length carries the value,
 * and the palette ceiling stops applying because nothing is being distinguished
 * by colour. It scales to 33 entities — the Eurostat expansion — without a
 * redesign, because a row is a row.
 *
 * WHICH GROUPS DRAW THIS WAY IS A PERSON'S DECISION, NOT A COUNT
 *
 * Nothing here inspects `members.length` to decide. The form comes from
 * `chart_forms` in the editorial layer (db/seeds/037_chart_form.sql) and
 * `ChartGroup` dispatches on it. Inferring the form from the number of members
 * would mean a seventh country silently changing the shape of an argument, and
 * would put a presentation decision in a place no editor can see it.
 *
 * WHY THE BARS ARE FETCHED IN CHUNKS
 *
 * /api/series caps a request at twelve ids — a deliberate fan-out limit, not an
 * accident. Sixteen countries is two requests, so the ids are split and the
 * results concatenated. React forbids calling a hook in a loop, so the calls are
 * written out and the unused ones are handed an empty list, which `useSeries`
 * treats as disabled.
 */

/** The server's own limit. Named rather than inlined, because it is not ours. */
const SERIES_PER_REQUEST = 12;

/**
 * Four requests, 48 entities.
 *
 * This was three, sized against "the Eurostat expansion's 33" — and that number
 * was the size of ONE PANEL, not of the group. `chunks` is built from `members`,
 * which is the whole chart_group. Counted from the seeds rather than remembered:
 * ai-adoption-panel becomes 33 Eurostat (10 in seed 020 plus 23 in 042) AND 11
 * OECD (6 in 020 plus 5 in 043) = 44. At 12 per request that is four, so a cap of
 * three would have made /q/adoption refuse to draw again the moment the country
 * seeds were applied — the exact failure this component was built to end, arriving
 * by a new route.
 *
 * 48 leaves room for four more countries. Past that the honest move is splitting
 * the group, which is an editorial decision and has a row in chart_forms.
 */
const MAX_REQUESTS = 4;

export default function RankedBarChart({ members = [], onPick }) {
  const palette = useSeriesPalette();

  // An empty group would otherwise sit on a loading block for ever: three
  // disabled queries never resolve, and `isPending` is true for every one of
  // them. ChartGroup does not call this with nothing, but a chart that hangs
  // rather than saying so is the failure mode this file exists to avoid.
  const nothingToDraw = members.length === 0;

  const chunks = useMemo(() => {
    const ids = members.map((m) => m.indicator_id);
    const countries = members.map((m) => m.country_iso3 ?? '');
    const out = [];
    for (let i = 0; i < ids.length; i += SERIES_PER_REQUEST) {
      out.push({
        ids: ids.slice(i, i + SERIES_PER_REQUEST),
        countries: countries.slice(i, i + SERIES_PER_REQUEST),
      });
    }
    return out;
  }, [members]);

  const tooWide = chunks.length > MAX_REQUESTS;

  // Written out rather than mapped: hooks cannot be called in a loop, and the
  // empty list disables the request rather than sending an empty one.
  const a = useSeries(chunks[0]?.ids ?? [], { countries: chunks[0]?.countries }, { enabled: !tooWide });
  const b = useSeries(chunks[1]?.ids ?? [], { countries: chunks[1]?.countries }, { enabled: !tooWide });
  const c = useSeries(chunks[2]?.ids ?? [], { countries: chunks[2]?.countries }, { enabled: !tooWide });
  const d = useSeries(chunks[3]?.ids ?? [], { countries: chunks[3]?.countries }, { enabled: !tooWide });
  const requests = [a, b, c, d].slice(0, Math.max(1, chunks.length));

  const unitSymbol = members[0]?.unit_symbol ?? '';
  const unit = members[0]?.unit ?? '';
  const decimals = members[0]?.decimals ?? 1;

  const series = useMemo(() => {
    const payloads = requests.map((r) => r.data).filter(Boolean);
    if (payloads.length !== requests.length) return null;

    const flat = payloads.flatMap((p) => p.series ?? []);
    const names = flat.map((s) => s.meta?.name ?? s.id);
    const trim = sharedSuffix(names);

    return flat.map((s, i) => {
      const member = members.find(
        (m) => m.indicator_id === s.id && (m.country_iso3 ?? '') === (s.country ?? '')
      );
      return {
        label: trimSuffix(names[i], trim),
        panel: member?.series_panel ?? null,
        points: s.points ?? [],
      };
    });
    // `requests` is rebuilt every render; the payloads are what actually change.
  }, [a.data, b.data, c.data, members]);

  const isPending = !tooWide && !nothingToDraw && requests.some((r) => r.isPending);
  const failed = requests.find((r) => r.isError);

  const cadence = useMemo(() => {
    if (!series?.length) return 'annual';
    // Per series, then the finest — the same rule SeriesChart applies, and for
    // the same reason: a declared cadence is not reliably the real one.
    const each = series.filter((s) => s.points.some((p) => p.value != null)).map((s) => inferCadence(s.points));
    const rank = { daily: 0, weekly: 1, monthly: 2, quarterly: 3, annual: 4 };
    return each.length === 0 ? 'annual' : each.sort((x, y) => rank[x] - rank[y])[0];
  }, [series]);

  const ranked = useMemo(
    () => (series ? rankEntities(series, { cadence }) : null),
    [series, cadence]
  );

  if (nothingToDraw) {
    return <p className="text-body-regular text-text-tertiary">No series in this comparison.</p>;
  }

  if (tooWide) {
    return (
      <Refusal>
        Not drawn: {members.length} entities, and this chart can fetch at most{' '}
        {SERIES_PER_REQUEST * MAX_REQUESTS} in one page load. Splitting the group is an editorial
        decision, so it is not made here.
      </Refusal>
    );
  }

  const units = new Set(members.map((m) => displayUnit(m.unit)).filter(Boolean));
  if (units.size > 1) {
    return (
      <Refusal>
        Not drawn: these series are measured in different units ({[...units].join(', ')}), and a
        bar&rsquo;s length can only mean one thing. Two units is two charts.
      </Refusal>
    );
  }

  if (isPending) return <LoadingBlock rows={1} />;
  if (failed) return <ErrorBlock error={failed.error} what="this comparison" />;
  if (!ranked || ranked.entities.length === 0) {
    return <p className="text-body-regular text-text-tertiary">No data for this comparison.</p>;
  }

  const [min, max] = ranked.domain;
  const span = max - min || 1;
  const zeroAt = (-min / span) * 100;
  const hue = colorAt(palette, 0);
  const panels = panelsOf(ranked.entities);

  return (
    <div>
      {/*
       * THE DATES ARE NOT A FOOTNOTE.
       *
       * oecd.ai_any.USA stops in 2021 at 5.65%. Denmark reaches 42.0% in 2025.
       * Ranked side by side with no periods on them, a reader sees the United
       * States near the bottom of a diffusion chart and concludes it is far
       * behind — when the two readings are four years apart. So this is above
       * the frame, in words, and every bar carries its own period as well.
       */}
      {ranked.olderCount > 0 && (
        <p className="mb-2 text-caption-1-medium text-warn">
          These are not readings of the same moment. {ranked.olderCount} of{' '}
          {ranked.entities.length} were taken before {fmtDate(ranked.newestDate, cadence)}
          {ranked.staleCount > 0
            ? `, and ${ranked.staleCount} of those ${ranked.staleCount === 1 ? 'is' : 'are'} more than one period behind and marked below`
            : ''}
          . Each bar carries the period it was measured in, and a lower bar may mean an older
          reading rather than a lower value.
        </p>
      )}

      {ranked.sharedBaselineDate ? (
        <p className="mb-3 text-caption-1-regular text-text-tertiary">
          The muted bar behind each is {fmtDate(ranked.sharedBaselineDate, cadence)}, which every
          one of these shares.
        </p>
      ) : (
        <p className="mb-3 text-caption-1-regular text-text-tertiary">
          The muted bar behind each is that entity&rsquo;s own earliest reading. They do not all
          start in the same period, so the two bars show each one&rsquo;s change and not a common
          baseline.
        </p>
      )}

      {/*
       * `role="img"` collapses everything inside to one graphic for assistive
       * technology, which is what makes the label below a replacement for the
       * picture rather than a duplicate of it. The table that carries the
       * numbers is a SIBLING for exactly that reason — see ChartDataTable.
       */}
      <div role="img" aria-label={describeRankedChart(ranked, { unit, cadence, decimals })}>
        {panels.map((panel) => (
          <section key={panel.name || 'all'} className="mt-4 first:mt-0">
            {/*
             * Two instruments that are not comparable at the level are not
             * ranked against each other in one column. Eurostat's survey is
             * harmonised across member states; the OECD rows are national
             * surveys compiled after the fact. db/seeds/020_ai_adoption_panel
             * says so in its header — this is that statement made visible.
             */}
            {panel.name && (
              <p className="mb-2 text-caption-1-medium text-text-secondary" aria-hidden>
                {panel.name}
              </p>
            )}

            <ul className="flex flex-col gap-2">
              {panel.entities.map((entity) => (
                <li
                  key={entity.label}
                  className="grid gap-1 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-center sm:gap-4"
                >
                  <div className="min-w-0">
                    <span className="block break-words text-body-regular text-text-secondary">
                      {entity.label}
                    </span>
                    {entity.stale && (
                      <span className="block text-caption-1-medium text-warn">
                        {fmtDate(entity.latest.date, cadence)} reading — no newer one exists
                      </span>
                    )}
                    {entity.baseline ? (
                      <span className="block text-caption-1-regular text-text-tertiary">
                        from {fmt(entity.baseline.value, decimals)}
                        {unitSymbol} in {fmtDate(entity.baseline.date, cadence)}
                      </span>
                    ) : (
                      <span className="block text-caption-1-regular text-text-tertiary">
                        one reading only
                      </span>
                    )}
                  </div>

                  {/* The track stops short of the right edge so the value and
                      its period have somewhere to sit outside the bar — never
                      on it, because white on a saturated fill is the one
                      contrast this project has no headroom for. */}
                  <div className="relative mr-24 h-7">
                    {min < 0 && (
                      <span
                        className="absolute inset-y-0 w-px bg-border-button-default"
                        style={{ left: `${zeroAt}%` }}
                        aria-hidden
                      />
                    )}

                    {/* The earlier reading, behind and muted: same hue, because
                        colour on this chart means nothing and must not start
                        meaning something here. */}
                    {entity.baseline && (
                      <span
                        className="absolute inset-y-0 rounded-[3px]"
                        style={{
                          ...barBox(entity.baseline.value, min, span, zeroAt),
                          background: hue,
                          opacity: 0.22,
                        }}
                        aria-hidden
                      />
                    )}

                    {/* The latest reading, inset so the muted bar reads as
                        behind it rather than beside it. */}
                    <span
                      className="absolute inset-y-1 rounded-[3px]"
                      style={{
                        ...barBox(entity.latest.value, min, span, zeroAt),
                        // A stale bar is hatched as well as labelled. The words
                        // are the disclosure; the hatch is what makes a reader
                        // ask what the words say.
                        background: entity.stale
                          ? `repeating-linear-gradient(135deg, ${hue} 0 4px, transparent 4px 8px)`
                          : hue,
                        border: entity.stale ? `1px solid ${hue}` : undefined,
                      }}
                      aria-hidden
                    />

                    <span
                      className="figure absolute top-1/2 -translate-y-1/2 whitespace-nowrap pl-2 text-caption-1-regular text-text-primary"
                      style={{ left: `${labelAt(entity.latest.value, min, span, zeroAt)}%` }}
                    >
                      {fmt(entity.latest.value, decimals)}
                      {unitSymbol}
                      <span className={entity.stale ? 'text-warn' : 'text-text-tertiary'}>
                        {' · '}
                        {fmtDate(entity.latest.date, cadence)}
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <ChartDataTable
        model={rankedTableModel(ranked, { cadence, decimals })}
        caption={`Every bar in this chart as numbers: ${ranked.entities.length} entities, each with the period its reading came from.`}
      />

      {onPick && ranked.newestDate && (
        <button
          type="button"
          onClick={() => onPick(ranked.newestDate, cadence)}
          className="mt-3 text-caption-1-regular text-text-tertiary underline decoration-border-button-default underline-offset-2 tint hover:text-text-primary"
        >
          What else was happening in {fmtDate(ranked.newestDate, cadence)}
        </button>
      )}
    </div>
  );
}

/** Bars grow from the zero line, so a negative value grows leftwards from it. */
function barBox(value, min, span, zeroAt) {
  const width = (Math.abs(value) / span) * 100;
  return { left: `${value >= 0 ? zeroAt : zeroAt - width}%`, width: `${width}%` };
}

function labelAt(value, min, span, zeroAt) {
  const width = (Math.abs(value) / span) * 100;
  return value >= 0 ? zeroAt + width : zeroAt;
}

function Refusal({ children }) {
  return (
    <div className="rounded-2xl border border-border-button-default p-5">
      <p className="text-body-regular text-text-secondary">{children}</p>
    </div>
  );
}

/**
 * The part every series name ends with, so sixteen rows do not each repeat
 * "— Enterprises using AI" beside their country.
 *
 * A display transformation on strings the editorial layer wrote, not an
 * editorial decision: nothing is added, and when the names share no meaningful
 * ending (the FRED youth-unemployment names do not) every label stays whole.
 */
export function sharedSuffix(names, minimum = 6) {
  if (names.length < 2) return '';
  let suffix = names[0];
  for (const name of names.slice(1)) {
    while (suffix && !name.endsWith(suffix)) suffix = suffix.slice(1);
  }
  // Never trim so much that a row loses its identity.
  const shortest = Math.min(...names.map((n) => n.length));
  return suffix.length >= minimum && shortest - suffix.length >= 2 ? suffix : '';
}

export function trimSuffix(name, suffix) {
  if (!suffix || !name.endsWith(suffix)) return name;
  return name.slice(0, -suffix.length).replace(/[\s,\-–—:]+$/, '') || name;
}
