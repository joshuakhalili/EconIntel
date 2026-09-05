import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RiFlaskLine, RiErrorWarningLine } from '@remixicon/react';
import {
  useScenario,
  useSimulationRun,
  useScenarioEvidence,
  useSeries,
} from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import { useContextDrawer } from '@/components/chrome/ContextDrawer';
import NarrationBlock from '@/components/NarrationBlock';
import SimulationChart from '@/components/charts/SimulationChart';
import SeriesChart from '@/components/charts/SeriesChart';
import ChartCard from '@/components/charts/ChartCard';
import { fmtDate, inferCadence, displayUnit } from '@/lib/format';

/**
 * A scenario page: the one place on this site where the numbers were not
 * measured.
 *
 * Everything else here reports something an agency published. This reports
 * arithmetic performed on published coefficients, and the page is built around
 * saying so rather than around hiding it — the caveat sits above the chart
 * rather than below it, every line is dashed, and the coefficients are listed
 * with their citations on the same screen as the result they produced.
 *
 * That ordering is the argument. A projection with its assumptions a scroll
 * away is a projection presented as a finding.
 *
 * AND THE MEASURED HALF IS DRAWN, BECAUSE THE PAGE SAYS IT IS.
 *
 * `thesis_plain` says, in its second and third sentences, "The charts
 * underneath are measured. Semiconductor
 * prices and information-sector employment run through both booms, which is
 * what makes the comparison possible at all." For a long time that was false:
 * `useScenarioEvidence` fetched four real series — 439, 439, 146 and 438 points
 * back to 1990, every one `official` tier — and the page rendered only the
 * twelve financing deals, so the scenario named "read through the lens of the
 * dot-com bubble" contained nothing whatsoever about the dot-com bubble. On a
 * site whose entire claim is that measured and modelled are never confused,
 * asserting evidence that is not shown is the worst available version of the
 * mistake. See `MeasuredHalf` below, and the note in it about what is still
 * missing.
 */

/**
 * The window the page marks on the measured series.
 *
 * IT IS NOT IN THE SEED, and the copy says "marked here" rather than stating it
 * as a fact about the dot-com era, because nothing in this repository records a
 * ruling on those dates: `034_scenario_ai-capex-dotcom.sql` names no period at
 * all. It came from the review that asked for the measured half to be drawn.
 * Anyone changing it is making an editorial decision, not correcting a value,
 * and it belongs in the seed the moment there is a second scenario.
 */
const DOTCOM_WINDOW = { from: '1995-01-01', to: '2002-12-31', label: '1995–2002' };

/**
 * The measured record the unemployment projection is sized against.
 *
 * WHY THERE IS A COMPARISON HERE AT ALL, AND WHY IT IS ARITHMETIC.
 *
 * The engine refuses to invent a floor under unemployment and it is right to —
 * "below about 2% is implausible" is a judgement, and a judgement written as a
 * constant looks exactly as sourced as a coefficient. See the docblock at
 * `checkRange` in `lib/simulation.js`. The consequence was a cliff: every path
 * down to 0.00% drew as an ordinary projection with no signal, and one
 * hundredth of a point further the chart truncated with four paragraphs of
 * explanation. A reader watching the line pass 1% had been given no reason to
 * doubt it.
 *
 * So nothing here decides where absurdity begins. Two facts are stated instead,
 * both computed from data already on the page: how far the model moved the rate
 * from its own baseline, and how that distance compares with the largest move
 * the measured series has actually made over the same number of years. "This
 * run moves unemployment further than any five-year move on record" is
 * decidable — it is subtraction over `wb.SL.UEM.TOTL.ZS`, which the database
 * holds for all four countries of this scenario, annually, 2000 onward.
 *
 * It is the same series the seed cites for `unemployment_baseline`, which is
 * what makes the two figures comparable at all: the baseline the model departs
 * from is a print of this record, so a distance measured from one is a distance
 * measured in the other's units.
 */
const UNEMPLOYMENT_RECORD = 'wb.SL.UEM.TOTL.ZS';

/** Wait for the drag to stop before asking the server. */
function useDebounced(value, ms = 200) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/**
 * The output series a reader can put on the chart.
 *
 * IN THE ORDER THE MODEL COMPUTES THEM, which is the order the page argues in:
 * spending → output → jobs → wages → prices. Output was missing entirely —
 * `investmentShockModel` returns `output_gap_pp` for every year and only three
 * of its four outputs were offered — so a reader could see the end of the chain
 * and not the link everything else derives from, which makes the rest look as
 * though it comes from nowhere.
 *
 * Unemployment and inflation are LEVELS because both have a baseline somebody
 * published — a measured unemployment rate, a stated inflation target. Wage
 * growth and the output gap are DEVIATIONS because nobody publishes a trend for
 * either here, and deriving one would be this project inventing the number it
 * claims never to invent. The label says which is which; see `REQUIRED_PARAMS`
 * in `lib/simulation.js`.
 *
 * `intervalKeys` NAMES THE UNCERTAINTY THAT BELONGS TO THIS LINE.
 *
 * `simulation_parameters` carries `value_low` and `value_high` for eight of the
 * thirteen rows and the citations panel at the bottom of the page has always
 * shown them — a full screen below the chart, in a list of thirteen. That is
 * not where a reader needs them. The inflation tab is the case that makes it
 * plain: at France's default it draws a confident five-point line, the
 * coefficient driving it is published at 1.00 with a range of 0.39 to 1.00 and
 * significance only at the 10% level, and the seed's own note calls it "the
 * most fragile number on the page". So each tab names the coefficients that set
 * ITS line and shows their published range beside it.
 *
 * Where a coefficient has no interval, that is said rather than left blank —
 * Okun's is a point estimate with nothing published around it, and a reader
 * comparing the unemployment tab against the inflation tab should be able to
 * see which of the two the literature is more precise about.
 */
const SERIES_OPTIONS = [
  {
    key: 'output_gap_pp',
    label: 'Output',
    baselineKey: 'output_gap_pp',
    /* No published level for output, so nothing to name as a baseline. */
    baselineName: null,
    intervalKeys: [
      'fiscal_multiplier_y1',
      'fiscal_multiplier_y2',
      'fiscal_multiplier_y3',
      'fiscal_multiplier_y4',
      'fiscal_multiplier_y5',
    ],
    axisNote:
      'Points of output above where it sits with no injection. Shown as a deviation ' +
      'because this parameter set carries no published level for output — only the ' +
      'multiplier that moves it.',
  },
  {
    key: 'unemployment_pct',
    label: 'Unemployment',
    baselineKey: 'unemployment_pct',
    baselineName: 'its measured baseline',
    intervalKeys: ['okun_coefficient'],
    /* The one output series with a measured counterpart in this database. */
    measuredRecord: UNEMPLOYMENT_RECORD,
    axisNote: 'Projected rate, against the measured baseline.',
  },
  {
    key: 'wage_growth_gap_pp',
    label: 'Wage growth vs trend',
    baselineKey: 'wage_growth_gap_pp',
    /* A deviation whose baseline is zero by construction, not a published
       level — naming it as one would assert a trend nobody publishes. */
    baselineName: null,
    intervalKeys: ['wage_phillips_slope', 'wage_persistence'],
    axisNote:
      'Points above or below trend. Shown as a deviation because no published ' +
      'figure for trend nominal wage growth is carried here.',
  },
  {
    key: 'inflation_pct',
    label: 'Inflation',
    baselineKey: 'inflation_pct',
    baselineName: 'the central bank’s target',
    intervalKeys: ['price_phillips_slope', 'wage_price_passthrough'],
    axisNote: 'Projected rate, against the central bank’s target.',
  },
];

/**
 * The chart's own title has to agree with the chart.
 *
 * "Unemployment, projected 5 years" over a two-year line is the same false
 * claim the refusal was added to stop, just in smaller type — and it is the
 * version that survives, because a title is read as a label rather than as an
 * assertion and nobody checks it against the axis. So when a run leaves the
 * range where its coefficients mean anything, the count here is the number of
 * years actually drawn.
 *
 * A missing `validity` is treated as a run that passed, matching
 * `SimulationChart`: absent is "not checked", never "failed".
 */
function chartTitle(run, option) {
  if (run.validity?.ok !== false) {
    return `${option.label}, projected ${run.horizon_years} years`;
  }

  const drawn = run.validity.first_invalid_year - 1;
  return drawn > 0
    ? `${option.label}, projected ${drawn} of ${run.horizon_years} years`
    : `${option.label}, not projected at this size`;
}

export default function SimulationPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: scenario, isPending, isError, error } = useScenario(slug);
  const { data: evidence } = useScenarioEvidence(slug);
  const { open } = useContextDrawer();

  const [country, setCountry] = useState(null);
  const [inputs, setInputs] = useState(null);
  const [shown, setShown] = useState('unemployment_pct');

  /*
   * Seed the controls from the scenario's own defaults, and from the URL where
   * it names a value. The URL wins: a link to a specific result must open that
   * result, or sharing one is pointless.
   */
  useEffect(() => {
    if (!scenario || inputs) return;
    const seeded = {};
    for (const def of scenario.inputs) {
      const fromUrl = searchParams.get(def.key);
      seeded[def.key] = fromUrl !== null ? Number(fromUrl) : Number(def.default_value);
    }
    setInputs(seeded);
    setCountry(searchParams.get('country') ?? scenario.countries[0] ?? null);
  }, [scenario, inputs, searchParams]);

  const debouncedInputs = useDebounced(inputs);

  const {
    data: run,
    isError: runFailed,
    error: runError,
    isFetching,
  } = useSimulationRun(slug, country, debouncedInputs ?? {}, {
    enabled: Boolean(debouncedInputs && country),
  });

  /*
   * The measured unemployment record for the country on screen.
   *
   * Fetched whichever tab is open, because it is 26 annual points and it is the
   * same request for every tab — asking for it only when the unemployment tab
   * is selected would refetch on every tab change and show the comparison a
   * moment late. See `UNEMPLOYMENT_RECORD` for why this series and not another.
   */
  const { data: measured } = useSeries(
    [UNEMPLOYMENT_RECORD],
    { countries: [country] },
    { enabled: Boolean(country) }
  );

  usePageTitle(scenario?.name ?? 'Simulation', scenario?.subtitle);

  /* Keep the URL in step, so the address bar always describes what is on screen. */
  useEffect(() => {
    if (!debouncedInputs || !country) return;
    const next = new URLSearchParams({ country });
    for (const [key, value] of Object.entries(debouncedInputs)) next.set(key, String(value));
    setSearchParams(next, { replace: true });
  }, [debouncedInputs, country, setSearchParams]);

  const citations = useMemo(() => {
    if (!scenario || !country) return [];
    return scenario.parameters.filter((p) => p.country_iso3 === country);
  }, [scenario, country]);

  /*
   * Which coefficients actually move when the country picker moves.
   *
   * Read off the parameter rows themselves rather than written down, because
   * the sentence under the picker used to be written down and was wrong: it
   * said "Each country carries its own published estimates" while eight of the
   * thirteen rows are one advanced-economy panel number inserted for all four
   * countries by a cross join. The seed's own header says so in capitals —
   * "WHAT IS ACTUALLY PER-COUNTRY, STATED HERE BECAUSE THE UI CANNOT" — and
   * that header is itself out of step with the table it loaded (it lists
   * inflation_anchor as per-country, and every country carries 2.0). Deriving
   * it from the rows is the only version that cannot drift.
   */
  const split = useMemo(
    () => parameterSplit(scenario?.parameters ?? []),
    [scenario]
  );

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="this scenario" />;

  const option = SERIES_OPTIONS.find((s) => s.key === shown) ?? SERIES_OPTIONS[0];
  const baseline = run?.baseline?.[option.baselineKey];
  const drawnYears = drawnRows(run);
  const movement = deviationText(
    drawnYears,
    option.key,
    option.label,
    baseline,
    option.baselineName
  );

  /*
   * How far this run travels, and what the record says about a move that size.
   *
   * Only where the series has a measured counterpart — the record is an
   * unemployment rate, so it can size an unemployment projection and nothing
   * else. `run.horizon_years` sets the window on both sides so the comparison is
   * like for like; when the chart truncates, the model has covered its distance
   * in FEWER years than the record's window, which makes the sentence stronger
   * rather than weaker.
   */
  const record =
    option.measuredRecord && measured?.series?.[0]?.points
      ? largestMove(measured.series[0].points, run?.horizon_years ?? 5)
      : null;
  const improbability = record
    ? recordText(
        widestGap(drawnYears, option.key, baseline),
        record,
        option.label,
        run?.horizon_years ?? 5
      )
    : null;

  /* The published interval behind the line on screen — see `intervalKeys`. */
  const intervals = intervalText(
    (option.intervalKeys ?? [])
      .map((key) => citations.find((p) => p.param_key === key))
      .filter(Boolean)
      .map((p) => ({
        name: paramMeta(p.param_key).short,
        value: p.value,
        low: p.value_low,
        high: p.value_high,
      }))
  );

  return (
    <article className="pb-16">
      <header className="mb-8">
        <p className="eyebrow flex items-center gap-2 text-text-tertiary">
          <RiFlaskLine className="size-3.5 shrink-0" aria-hidden />
          Simulation
        </p>
        <h1 className="mt-2 text-display-4-medium leading-tight text-text-primary">{scenario.name}</h1>
        {scenario.subtitle && (
          <p className="prose-measure mt-2 text-headline-regular text-text-secondary">{scenario.subtitle}</p>
        )}
        {scenario.thesis_plain && (
          <p className="mt-4 max-w-2xl text-body-regular text-text-secondary">
            {scenario.thesis_plain}
          </p>
        )}
      </header>

      {/*
        The caveat, ABOVE the chart.
        A reader who scrolls no further has still read what the model cannot do.

        It is an H2 rather than a paragraph in bold. On the one page here whose
        numbers are modelled rather than measured, the strongest warning on the
        site was unreachable by heading while QuestionPage made its equivalent a
        real heading — so a screen-reader user skimming by heading met the
        projection and never met this.
      */}
      <aside className="mb-8 flex gap-3 rounded-2xl border border-border-button-default bg-background-secondary-default p-4">
        <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-text-tertiary" aria-hidden />
        <div>
          <h2 className="text-body-medium text-text-primary">What this cannot tell you</h2>
          <p className="mt-1 text-body-regular text-text-secondary">{scenario.caveat}</p>
        </div>
      </aside>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ── Controls ───────────────────────────────────────────────── */}
        <section aria-label="Model inputs" className="space-y-6">
          {scenario.countries.length > 1 && (
            <label className="block">
              <span className="text-body-medium text-text-primary">Country</span>
              <select
                value={country ?? ''}
                onChange={(e) => setCountry(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2 text-body-regular text-text-primary"
              >
                {scenario.countries.map((iso3) => (
                  <option key={iso3} value={iso3}>
                    {scenario.parameters.find((p) => p.country_iso3 === iso3)?.country_name ?? iso3}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-caption-1-regular text-text-tertiary">
                Changes the coefficients, not the model — and only{' '}
                {split.varying.length} of the {split.varying.length + split.shared.length} of them:{' '}
                {split.varying.map((key) => paramMeta(key).short).join(', ')}. The other{' '}
                {split.shared.length} hold the same value for every country here, and each row
                below says whether it was estimated for one country or for a panel of them.
              </span>
            </label>
          )}

          {scenario.inputs.map((def) => {
            /*
             * A TWO-POSITION SLIDER IS NOT A CHOICE, IT IS A PUZZLE.
             *
             * `sustained` came through the generic loop as an <input
             * type=range> with min 0, max 1, step 1 and no unit symbol, so its
             * readout was the bare digit 0 or 1 beside "Repeat the injection
             * every year". It is the control that changes the answer most —
             * flipping it moves France's breaking point from $420bn to $130bn —
             * and the one a reader is least likely to notice they have moved.
             * The `unit` column already carries 'flag', so the branch has
             * something real to key on rather than a name match.
             */
            const options = flagOptions(def);
            const value = Number(inputs?.[def.key] ?? def.default_value);

            if (options) {
              return (
                <fieldset key={def.key} className="block">
                  <legend className="text-body-medium text-text-primary">{def.label}</legend>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {options.map((opt) => {
                      const active = value === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className={
                            'cursor-pointer focus-within:ring-1 focus-within:ring-signal ' +
                            (active
                              ? 'tint rounded-full px-3 py-1 text-caption-1-medium text-on-fill'
                                + ' [background:var(--color-electric)]'
                              : 'rounded-full border border-border-button-default px-3 py-1 text-caption-1-medium text-text-secondary')
                          }
                        >
                          <input
                            type="radio"
                            name={def.key}
                            className="sr-only"
                            checked={active}
                            onChange={() =>
                              setInputs((prev) => ({ ...prev, [def.key]: opt.value }))
                            }
                          />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                  {def.help_text && (
                    <p className="mt-1 text-caption-1-regular text-text-tertiary">
                      {def.help_text}
                    </p>
                  )}
                </fieldset>
              );
            }

            return (
              <label key={def.key} className="block">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-body-medium text-text-primary">{def.label}</span>
                  <span className="tabular-nums text-body-regular text-text-secondary">
                    {value}
                    {def.unit_symbol ? ` ${def.unit_symbol}` : ''}
                  </span>
                </span>
                <input
                  type="range"
                  min={def.min_value}
                  max={def.max_value}
                  step={def.step}
                  value={value}
                  onChange={(e) =>
                    setInputs((prev) => ({ ...prev, [def.key]: Number(e.target.value) }))
                  }
                  className="mt-2 w-full accent-[var(--color-text-primary)]"
                />
                {def.help_text && (
                  <span className="mt-1 block text-caption-1-regular text-text-tertiary">
                    {def.help_text}
                  </span>
                )}
              </label>
            );
          })}
        </section>

        {/* ── Result ─────────────────────────────────────────────────── */}
        <section aria-label="Projection" className="min-w-0">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {SERIES_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setShown(s.key)}
                aria-pressed={shown === s.key}
                className={
                  shown === s.key
                    ? 'tint rounded-full px-3 py-1 text-caption-1-medium text-on-fill'
                      + ' [background:var(--color-electric)]'
                    : 'rounded-full border border-border-button-default px-3 py-1 text-caption-1-medium text-text-secondary'
                }
              >
                {s.label}
              </button>
            ))}
          </div>

          {runFailed ? (
            <ErrorBlock error={runError} what="this run" />
          ) : run ? (
            <ChartCard
              title={chartTitle(run, option)}
              caption={
                /*
                 * THE DEFAULT POSITION DRAWS WHAT LOOKS LIKE A BROKEN CHART.
                 *
                 * At $100bn one-off the projected path sits within a few pixels
                 * of the no-injection line for all five years, on an axis that
                 * starts at zero — a dead-flat dashed line, as the first thing
                 * a reader sees on the most carefully sourced page here. The
                 * effect is real and it is small, so the size of it is stated
                 * rather than the default being moved to somewhere more
                 * dramatic. Computed from the years actually drawn, so it stays
                 * true at every slider position instead of describing one.
                 */
                [
                  run.shock
                    ? `A ${run.shock.sustained ? 'sustained' : 'one-off'} injection of ` +
                      `$${run.shock.usd_bn}bn — ${run.shock.share_of_gdp_pct}% of output.`
                    : null,
                  movement,
                  /* The distance, sized against the measured record. Nothing
                     here says where a result becomes absurd; it says how far
                     this one has travelled and how far the record ever has. */
                  improbability,
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              footer={
                [
                  intervals,
                  option.axisNote,
                  `Model ${run.model_key} ${run.model_version} — modelled, not measured.`,
                ]
                  .filter(Boolean)
                  .join(' ')
              }
              className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}
            >
              <SimulationChart
                years={run.years}
                series={[option]}
                baseline={baseline}
                /* Whether the run produced something that can exist. The chart
                   stops where it stops — see the note at the top of that file. */
                validity={run.validity}
              />
            </ChartCard>
          ) : (
            <LoadingBlock rows={2} />
          )}

          {/*
            No paragraph about numbers the chart refused to draw.

            Narrations are written offline, for the default slider position
            only, so in practice this never fires — the flagship's default is
            well inside the model's range. It is here because "in practice" is
            doing load-bearing work in that sentence: a default that moves, or a
            country added with different coefficients, would put prose asserting
            a negative unemployment rate directly under a panel explaining that
            a negative unemployment rate cannot happen. The prose would win. It
            reads as a conclusion and the panel reads as a disclaimer.
          */}
          <NarrationBlock
            narration={run?.validity?.ok === false ? null : run?.narration}
          />
        </section>
      </div>

      {/* ── Where the numbers came from ──────────────────────────────── */}
      {citations.length > 0 && (
        <section className="mt-12 border-t border-border-button-default pt-6">
          <h2 className="eyebrow text-text-tertiary">Every coefficient, and its source</h2>
          <p className="mt-2 max-w-2xl text-body-regular text-text-secondary">
            None of these were estimated from this database. Each is a published estimate,
            carried with the citation that lets you check it.
          </p>

          {/*
            NAMED, NOT KEYED, AND SORTED INTO WHAT MOVES AND WHAT DOES NOT.

            This list is the page's provenance panel — the thing that earns the
            reader's trust — and it read as a database dump: thirteen rows
            headed `fiscal_multiplier_y3`, `wage_price_passthrough`,
            `okun_coefficient`, two of them with no unit at all, and nothing
            marking a panel average as different from a country estimate. A
            reader who cannot tell which row is "how much output a dollar of
            spending adds in year one" cannot check any of it, which is the only
            reason the section exists. The key stays, in mono, because it is
            what the API and the seed call the row.
          */}
          <CitationGroup
            heading={`Changes with the country (${split.varying.length})`}
            blurb={
              'These do not hold the same value for every country in this scenario. ' +
              'Each row’s citation and note say whether the number was estimated for ' +
              'this country or carried from a panel.'
            }
            rows={citations.filter((p) => split.varying.includes(p.param_key))}
          />
          <CitationGroup
            heading={`The same for all ${scenario.countries.length} countries (${split.shared.length})`}
            blurb={
              'These hold one value for every country here, and the reason is not the ' +
              'same in every case: some are panel estimates across a group of advanced ' +
              'economies rather than country estimates, and some are country figures ' +
              'that happen to coincide. Each row says which.'
            }
            rows={citations.filter((p) => split.shared.includes(p.param_key))}
          />
        </section>
      )}

      {/* ── The measured half ────────────────────────────────────────── */}
      <MeasuredHalf series={evidence?.series} onPick={open} />

      {/* ── What actually happened ───────────────────────────────────── */}
      {evidence?.events?.length > 0 && (
        <section className="mt-12 border-t border-border-button-default pt-6">
          <h2 className="eyebrow text-text-tertiary">Measured, not modelled: the deals</h2>
          <p className="mt-2 max-w-2xl text-body-regular text-text-secondary">
            Real deals from the financing graph. These are recorded transactions, not
            projections — the other half of the comparison this page is making.
          </p>
          <ul className="mt-4 divide-y divide-border-button-default">
            {evidence.events.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span className="text-body-regular text-text-primary">
                  {e.from_name} → {e.to_name}
                  <span className="ml-2 text-caption-1-regular text-text-tertiary">
                    {e.kind.replace(/_/g, ' ')}
                  </span>
                </span>
                <span className="tabular-nums text-body-regular text-text-secondary">
                  {e.amount_usd
                    ? `$${(Number(e.amount_usd) / 1e9).toFixed(1)}bn`
                    : '—'}
                  {e.amount_is_estimate && (
                    <span className="ml-1 text-text-tertiary" title="Estimated">≈</span>
                  )}
                  <span className="ml-2 text-caption-1-regular text-text-tertiary">
                    {e.announced_date}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/* ── The measured half ─────────────────────────────────────────────────── */

/**
 * The real series this scenario is read against.
 *
 * FOUR CHARTS, NOT ONE, AND THAT IS THE DECISION.
 *
 * The four series carry four different units — a producer-price index, a count
 * of persons in thousands, billions of dollars, and a share-price index — and
 * this project's first chart rule is one unit on one pair of axes and never a
 * second axis. That leaves two honest options: rebase all four to 100 at a
 * shared period and draw one chart, or draw four. Four wins, because the levels
 * are half of what these series are for — "semiconductor prices at 28.99
 * against 153.4 in 1990" is the fact; an index of it is the shape with the fact
 * removed. Indexing is the right answer when the reader chose the combination
 * (see /explore); it is the wrong answer when the point is the magnitudes.
 *
 * Every line is SOLID. `SimulationChart` above dashes unconditionally because
 * nothing on it was observed; these are observations, so they get the ink the
 * rest of the site uses for measurements.
 *
 * WHAT IS STILL MISSING, SAID OUT LOUD: the dot-com window is named in numbers
 * under each chart rather than shaded across the frame. A period band needs a
 * prop on LineChart, which is not this file's to add.
 */
function MeasuredHalf({ series, onPick }) {
  if (!series?.length) return null;

  return (
    <section className="mt-12 border-t border-border-button-default pt-6">
      <h2 className="eyebrow text-text-tertiary">Measured, not modelled: the series</h2>
      <p className="mt-2 max-w-2xl text-body-regular text-text-secondary">
        Observed and published, not computed here. These are the series the comparison
        rests on: they run through both build-outs, which is what makes it possible at
        all. Each series gets its own chart because their units differ, and nothing
        here shares an axis with anything it cannot be measured against.
      </p>
      <p className="mt-2 max-w-2xl text-body-regular text-text-tertiary">
        {DOTCOM_WINDOW.label} is the window marked here for the dot-com build-out. Each
        chart names its first and last reading inside it rather than shading it across
        the frame.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {series.map((row) => {
          const payload = evidencePayload(row);
          const points = payload.series[0].points;
          const cadence = inferCadence(points);
          const inWindow = windowSlice(row.points, DOTCOM_WINDOW.from, DOTCOM_WINDOW.to);
          const span = windowSlice(row.points);

          return (
            <ChartCard
              key={row.id}
              title={row.name}
              caption={
                span
                  ? `Measured. ${displayUnit(row.unit)} · ${fmtDate(span.first.period, cadence)} to ` +
                    `${fmtDate(span.last.period, cadence)} · ${span.count} readings.`
                  : undefined
              }
              footer={
                <span className="flex flex-wrap items-center gap-x-2">
                  <span>
                    {row.id} · {row.confidence_tier}
                  </span>
                  {inWindow && (
                    <span>
                      · {DOTCOM_WINDOW.label}: {inWindow.first.value} in{' '}
                      {fmtDate(inWindow.first.period, cadence)}, {inWindow.last.value} in{' '}
                      {fmtDate(inWindow.last.period, cadence)}
                    </span>
                  )}
                </span>
              }
            >
              <SeriesChart payload={payload} height={220} onPick={onPick} />
            </ChartCard>
          );
        })}
      </div>
    </section>
  );
}

/** One block of the citations list — the rows that move, or the rows that do not. */
function CitationGroup({ heading, blurb, rows }) {
  if (rows.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-body-medium text-text-primary">{heading}</h3>
      <p className="mt-1 max-w-2xl text-caption-1-regular text-text-tertiary">{blurb}</p>
      <ul className="mt-3 space-y-3">
        {rows.map((p) => {
          const meta = paramMeta(p.param_key);
          return (
            <li
              key={p.param_key}
              className="rounded-xl border border-border-button-default p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="min-w-0">
                  <span className="block text-body-medium text-text-primary">{meta.label}</span>
                  <code className="mt-0.5 block text-caption-1-regular text-text-tertiary">
                    {p.param_key}
                    {meta.unit ? ` · ${meta.unit}` : ''}
                  </code>
                </span>
                <span className="tabular-nums text-body-medium text-text-primary">
                  {paramValueText(p.value, meta.symbol)}
                  {p.value_low !== null && p.value_high !== null && (
                    <span className="ml-1.5 text-body-regular text-text-tertiary">
                      ({paramValueText(p.value_low, meta.symbol)} to{' '}
                      {paramValueText(p.value_high, meta.symbol)})
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-1 text-body-regular text-text-secondary">
                {p.citation_url ? (
                  <a
                    href={p.citation_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline underline-offset-2"
                  >
                    {p.citation_text}
                  </a>
                ) : (
                  p.citation_text
                )}
              </p>
              {p.notes && (
                <p className="mt-1 text-caption-1-regular text-text-tertiary">{p.notes}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Pure decisions, exported so `reader-pages.test.js` can reach them ──── */

/**
 * Which parameter keys differ between countries, and which do not.
 *
 * Compared as strings so 0 and "0" from two drivers cannot read as a
 * difference, and a key present for only one country counts as shared rather
 * than varying — one value is not a disagreement. Order is the order the rows
 * arrive in, which the API sorts by `param_key`.
 */
export function parameterSplit(parameters) {
  const seen = new Map();
  for (const row of parameters ?? []) {
    const values = seen.get(row.param_key) ?? new Set();
    values.add(String(row.value));
    seen.set(row.param_key, values);
  }
  const varying = [];
  const shared = [];
  for (const [key, values] of seen) {
    (values.size > 1 ? varying : shared).push(key);
  }
  return { varying, shared };
}

/**
 * A plain-English name, a unit and a short form for one coefficient.
 *
 * Every string here is read off the model's own comments in
 * `src/server/lib/simulation.js` — the units especially, which are the file's
 * statements about what its arithmetic means, not a reading of the numbers. An
 * unknown key falls back to itself rather than to a guess, so a coefficient
 * added tomorrow renders as its key instead of as a wrong description.
 */
export function paramMeta(key) {
  const table = {
    gdp_usd_bn: {
      label: 'Annual output (GDP)',
      short: 'GDP',
      unit: 'billions of US dollars',
      symbol: 'usd_bn',
    },
    okun_coefficient: {
      label: 'Okun’s coefficient — how far output moves unemployment',
      short: 'Okun’s coefficient',
      unit: 'points of unemployment per point of output gap',
      symbol: null,
    },
    unemployment_baseline: {
      label: 'Unemployment with no injection',
      short: 'baseline unemployment',
      unit: 'per cent of the labour force',
      symbol: 'percent',
    },
    inflation_anchor: {
      label: 'Inflation with no injection',
      short: 'the inflation anchor',
      unit: 'per cent a year',
      symbol: 'percent',
    },
    price_phillips_slope: {
      label: 'Price response to a tighter labour market',
      short: 'the price Phillips slope',
      unit: 'points of inflation per point of unemployment gap',
      symbol: null,
    },
    wage_phillips_slope: {
      label: 'Wage response to a tighter labour market',
      short: 'the wage Phillips slope',
      unit: 'points of wage growth per point of unemployment gap',
      symbol: null,
    },
    wage_persistence: {
      label: 'How much of last year’s wage deviation carries forward',
      short: 'wage persistence',
      unit: 'share of last year’s deviation',
      symbol: null,
    },
    wage_price_passthrough: {
      label: 'Share of excess wage growth that reaches prices',
      short: 'wage-to-price pass-through',
      unit: 'share of the wage deviation',
      symbol: null,
    },
  };
  const multiplier = key.match(/^fiscal_multiplier_y(\d+)$/);
  if (multiplier) {
    return {
      label: `Output added per unit of spending, year ${multiplier[1]}`,
      short: `the year ${multiplier[1]} multiplier`,
      unit: 'points of output per point of spending',
      symbol: null,
    };
  }
  return table[key] ?? { label: key, short: key, unit: '', symbol: null };
}

/**
 * A coefficient's value with its unit attached, where the unit is a symbol.
 *
 * Only two of the thirteen carry one, and both were rendered bare: `gdp_usd_bn`
 * showed "29298" and `inflation_anchor` showed "2". Everything else is a ratio
 * with no symbol in English, so it is printed as the number and its unit is
 * spelled out beside the key instead of invented as notation.
 */
export function paramValueText(value, symbol) {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  if (symbol === 'usd_bn') return `$${n.toLocaleString('en-GB')}bn`;
  if (symbol === 'percent') return `${n}%`;
  return String(n);
}

/**
 * The two positions of a flag input, or null when it is not one.
 *
 * `sustained`'s labels come from its own `help_text`, which describes position
 * 0 as "one year's cheque" and position 1 as repeating "every year of the
 * horizon". A flag this does not recognise gets No/Yes rather than a guess at
 * what it means, and anything that is not a genuine two-position control stays
 * a slider — a `flag` with three positions is a seed mistake and must not be
 * silently drawn as two.
 */
export function flagOptions(def) {
  if (!def || def.unit !== 'flag') return null;
  const min = Number(def.min_value);
  const max = Number(def.max_value);
  const step = Number(def.step);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min !== step) return null;
  if (def.key === 'sustained') {
    return [
      { value: min, label: 'One year only' },
      { value: max, label: 'Every year' },
    ];
  }
  return [
    { value: min, label: 'No' },
    { value: max, label: 'Yes' },
  ];
}

/**
 * The years a run actually draws — the same filter `SimulationChart` applies.
 *
 * A caption describing five years over a chart showing two is the false claim
 * `chartTitle` was written to stop, in a different slot.
 */
export function drawnRows(run) {
  const years = run?.years ?? [];
  const cutoff = run?.validity?.ok === false ? run.validity.first_invalid_year : null;
  return cutoff === null ? years : years.filter((y) => y.year < cutoff);
}

/**
 * How far the projection gets from the line it is a deviation from.
 *
 * Stated at every slider position rather than only when it is small: at the
 * default the answer explains a chart that otherwise looks broken, and further
 * along it is the number the reader is looking for anyway. Rounded to the two
 * decimals the model itself rounds to, so this can never show precision the
 * engine did not produce.
 *
 * `baselineName` NAMES THE LINE, AND THAT IS THE POINT OF IT.
 *
 * "moves at most 6.06 percentage points from the no-injection line" is a
 * distance with nothing to judge it against. "moves at most 6.06 percentage
 * points below its measured baseline of 7.4%" is the same arithmetic and it is
 * legible: a reader can see that the model has taken most of the rate away
 * without this page having to hold an opinion about where that becomes absurd.
 * The engine deliberately holds no such opinion either — see `checkRange` in
 * `lib/simulation.js`.
 *
 * Passed only for the two series that HAVE a published level to name. Wage
 * growth and output are deviations whose baseline is zero by construction, and
 * calling zero "the baseline" would imply somebody published a trend for them.
 *
 * The direction is stated only when every drawn year is on one side of the
 * line. A path that crosses it says "from", because "below" would be a claim
 * about the whole path that only part of it supports.
 */
export function deviationText(years, key, label, baseline, baselineName) {
  const values = (years ?? []).map((y) => y?.[key]).filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  const base = typeof baseline === 'number' ? baseline : 0;
  let widest = 0;
  for (const value of values) widest = Math.max(widest, Math.abs(value - base));
  const gap = Math.round(widest * 100) / 100;
  const span = values.length === 1 ? 'the year drawn' : `the ${values.length} years drawn`;
  const points = gap === 1 ? 'percentage point' : 'percentage points';

  let reference = typeof baseline === 'number' ? 'from the no-injection line' : 'from zero';
  if (baselineName && typeof baseline === 'number') {
    const side = values.every((v) => v < base)
      ? 'below'
      : values.every((v) => v > base)
        ? 'above'
        : 'from';
    reference = `${side} ${baselineName} of ${baseline}%`;
  }
  return `Across ${span}, ${label.toLowerCase()} moves at most ${gap} ${points} ${reference}.`;
}

/**
 * The same distance as a number, for the sentence that compares it to the record.
 *
 * Deliberately a second copy of three lines rather than a helper `deviationText`
 * calls. `reader-pages.test.js` lifts the exported functions out of this file by
 * regex and evaluates them in isolation, so a function that calls a sibling only
 * works if the test happens to have lifted that sibling too — a coupling that
 * breaks a test in another file when this one is refactored, and breaks it with
 * a ReferenceError that says nothing about the cause.
 */
export function widestGap(years, key, baseline) {
  const values = (years ?? []).map((y) => y?.[key]).filter((v) => typeof v === 'number');
  if (values.length === 0) return null;
  const base = typeof baseline === 'number' ? baseline : 0;
  let widest = 0;
  for (const value of values) widest = Math.max(widest, Math.abs(value - base));
  return Math.round(widest * 100) / 100;
}

/**
 * The largest move the measured series makes across a window of `years`.
 *
 * Every window, not the extremes: the biggest gap between the highest and
 * lowest readings in a series is not a five-year move, and quoting it as one
 * would overstate what the record contains and make the model's own travel look
 * ordinary. So this walks each year that has a partner `years` later and takes
 * the largest absolute difference between the pair.
 *
 * Annual data is assumed because the series this is used on is annual; a point
 * whose date does not parse to a year is skipped rather than guessed at, and a
 * year with no partner contributes nothing.
 *
 * Returns null when the series cannot support the comparison — too short, or
 * missing — and the caller then says nothing at all. An absent record must cost
 * a sentence, never produce one.
 */
export function largestMove(points, years) {
  const byYear = new Map();
  for (const point of points ?? []) {
    const year = Number(String(point?.date ?? '').slice(0, 4));
    const value = Number(point?.value);
    if (!Number.isInteger(year) || !Number.isFinite(value)) continue;
    byYear.set(year, value);
  }
  if (byYear.size === 0 || !Number.isInteger(years) || years < 1) return null;

  let best = null;
  for (const [year, value] of byYear) {
    const later = byYear.get(year + years);
    if (!Number.isFinite(later)) continue;
    const move = Math.abs(later - value);
    if (best === null || move > best.move) {
      best = { move: Math.round(move * 100) / 100, from: year, to: year + years };
    }
  }
  if (best === null) return null;

  const observed = [...byYear.keys()].sort((a, b) => a - b);
  return { ...best, spanFrom: observed[0], spanTo: observed[observed.length - 1] };
}

/**
 * The improbability of this run, reported as arithmetic rather than as judgement.
 *
 * The sentence states the record and then says whether this run exceeds it. It
 * never says a run is impossible, implausible or unlikely — those are opinions,
 * and the one place this project holds an opinion about a projection is
 * `scenario.caveat`, which is prose written by a person. Everything here is
 * subtraction over two figures the reader can find: the model's own distance
 * from its baseline, and the largest move of that size the measured series has
 * made since it began.
 */
export function recordText(gap, record, label, years) {
  if (typeof gap !== 'number' || !record) return null;
  const points = record.move === 1 ? 'point' : 'points';
  const sentence =
    `The largest ${years}-year move in the measured record — ${record.spanFrom} to ` +
    `${record.spanTo} — is ${record.move} ${points}, between ${record.from} and ${record.to}.`;
  return gap > record.move
    ? `${sentence} This run moves ${label.toLowerCase()} further than that.`
    : sentence;
}

/**
 * The published range behind the line on screen, or the fact that there is none.
 *
 * WHY THIS SITS ON THE CHART AND NOT ONLY IN THE CITATIONS PANEL.
 *
 * The panel has always shown `value_low` and `value_high`; it is a screen below
 * the projection, inside a list of thirteen rows, and a reader looking at a
 * five-point line to 10% inflation does not scroll to it. The interval belongs
 * where the claim is made. France is the case that forces it: its price Phillips
 * slope is published at 1.00 with a range running down to 0.39 and significance
 * only at the 10% level, and it draws the steepest inflation path in the set.
 *
 * A coefficient with no interval is reported as having none rather than left
 * out, because a blank would read as "no uncertainty".
 *
 * WHY THIS SAYS "RECORDED" AND NOT "PUBLISHED"
 *
 * It said "Published range" first, and that was a claim the repository itself
 * contradicts. Most of these intervals are NOT ranges any paper prints: seed 034's
 * note on every multiplier row reads "the point estimate plus and minus one
 * published standard error — arithmetic on the paper's cells, not a range the
 * paper prints", and both wage rows are the same shape. For year one the paper
 * does print a range and it is 0.4 to 0.57, while this panel shows 0.31 to 0.604.
 * The citations list one screen below carried the contradicting note the whole time.
 *
 * The absent case was worse: "no interval in the source" is a positive claim ABOUT
 * A PAPER inferred from two NULL columns. Nothing in the seed or in docs/research
 * records that Ball, Leigh & Loungani print no interval for Okun's coefficient —
 * nobody checked. What is actually known is what this database holds, so that is
 * what the sentence now says, and each row's own note carries its provenance.
 */
export function intervalText(entries) {
  const rows = entries ?? [];
  if (rows.length === 0) return null;

  const number = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const ranged = [];
  const bare = [];
  for (const row of rows) {
    const low = number(row.low);
    const high = number(row.high);
    const value = number(row.value);
    if (low === null || high === null || value === null) bare.push(row.name);
    else ranged.push(`${row.name} ${value} (${low} to ${high})`);
  }

  if (ranged.length === 0) {
    const verb = bare.length === 1 ? 'is recorded' : 'are recorded';
    return `Recorded range: none — ${bare.join(' and ')} ${verb} here as a point with no interval. See the citation below for how it was estimated.`;
  }
  const tail = bare.length > 0 ? ` No interval recorded for ${bare.join(' or ')}.` : '';
  return `Recorded range: ${ranged.join(' · ')}.${tail} How each was derived is in its citation below — several are one standard error either side rather than a range the paper prints.`;
}

/**
 * The readings inside a date window, or null when there are none.
 *
 * Points arrive ordered by period from the evidence query, so first and last
 * are the ends of the window rather than the extremes of the values — which is
 * the point: this says where a series started and finished inside a period, and
 * characterises neither.
 *
 * Either bound may be omitted, which is how the whole span of a series is
 * asked for without inventing a sentinel date to compare against.
 */
export function windowSlice(points, from, to) {
  const inside = (points ?? []).filter(
    (p) =>
      p &&
      p.value !== null &&
      p.value !== undefined &&
      (!from || p.period >= from) &&
      (!to || p.period <= to)
  );
  if (inside.length === 0) return null;
  return { first: inside[0], last: inside[inside.length - 1], count: inside.length };
}

/**
 * One evidence series in the shape `/api/series` returns, so `SeriesChart` can
 * draw it with every disclosure it already carries.
 *
 * The evidence endpoint names its dates `period` and the series endpoint names
 * them `date`; this is the whole of the difference. `indexed: false` is stated
 * rather than omitted, because these are levels and nothing rebased them.
 */
export function evidencePayload(row) {
  return {
    indexed: false,
    series: [
      {
        id: row.id,
        meta: { name: row.name, unit: row.unit },
        points: (row.points ?? []).map((p) => ({ date: p.period, value: p.value })),
      },
    ],
  };
}
