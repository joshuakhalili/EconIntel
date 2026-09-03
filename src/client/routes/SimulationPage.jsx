import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { RiFlaskLine, RiErrorWarningLine } from '@remixicon/react';
import {
  useScenario,
  useSimulationRun,
  useScenarioEvidence,
} from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import NarrationBlock from '@/components/NarrationBlock';
import SimulationChart from '@/components/charts/SimulationChart';
import ChartCard from '@/components/charts/ChartCard';

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
 */

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
 * Unemployment and inflation are LEVELS because both have a baseline somebody
 * published — a measured unemployment rate, a stated inflation target. Wage
 * growth is a DEVIATION because nobody publishes trend nominal wage growth, and
 * deriving one would be this project inventing the number it claims never to
 * invent. The label says which is which; see `REQUIRED_PARAMS` in
 * `lib/simulation.js`.
 */
const SERIES_OPTIONS = [
  {
    key: 'unemployment_pct',
    label: 'Unemployment',
    baselineKey: 'unemployment_pct',
    axisNote: 'Projected rate, against the measured baseline.',
  },
  {
    key: 'inflation_pct',
    label: 'Inflation',
    baselineKey: 'inflation_pct',
    axisNote: 'Projected rate, against the central bank’s target.',
  },
  {
    key: 'wage_growth_gap_pp',
    label: 'Wage growth vs trend',
    baselineKey: 'wage_growth_gap_pp',
    axisNote:
      'Points above or below trend. Shown as a deviation because no published ' +
      'figure for trend nominal wage growth is carried here.',
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

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="this scenario" />;

  const option = SERIES_OPTIONS.find((s) => s.key === shown) ?? SERIES_OPTIONS[0];

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
      */}
      <aside className="mb-8 flex gap-3 rounded-2xl border border-border-button-default bg-background-secondary-default p-4">
        <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-text-tertiary" aria-hidden />
        <div>
          <p className="text-body-medium text-text-primary">What this cannot tell you</p>
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
                Changes the coefficients, not the model. Each country carries its own
                published estimates.
              </span>
            </label>
          )}

          {scenario.inputs.map((def) => (
            <label key={def.key} className="block">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-body-medium text-text-primary">{def.label}</span>
                <span className="tabular-nums text-body-regular text-text-secondary">
                  {inputs?.[def.key] ?? def.default_value}
                  {def.unit_symbol ? ` ${def.unit_symbol}` : ''}
                </span>
              </span>
              <input
                type="range"
                min={def.min_value}
                max={def.max_value}
                step={def.step}
                value={inputs?.[def.key] ?? def.default_value}
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
          ))}
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
                run.shock
                  ? `A ${run.shock.sustained ? 'sustained' : 'one-off'} injection of ` +
                    `$${run.shock.usd_bn}bn — ${run.shock.share_of_gdp_pct}% of output.`
                  : undefined
              }
              footer={`${option.axisNote} Model ${run.model_key} ${run.model_version} — modelled, not measured.`}
              className={isFetching ? 'opacity-70 transition-opacity' : 'transition-opacity'}
            >
              <SimulationChart
                years={run.years}
                series={[option]}
                baseline={run.baseline?.[option.baselineKey]}
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
          <ul className="mt-4 space-y-3">
            {citations.map((p) => (
              <li
                key={p.param_key}
                className="rounded-xl border border-border-button-default p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <code className="text-body-medium text-text-primary">{p.param_key}</code>
                  <span className="tabular-nums text-body-medium text-text-primary">
                    {p.value}
                    {p.value_low !== null && p.value_high !== null && (
                      <span className="ml-1.5 text-body-regular text-text-tertiary">
                        ({p.value_low} to {p.value_high})
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
            ))}
          </ul>
        </section>
      )}

      {/* ── What actually happened ───────────────────────────────────── */}
      {evidence?.events?.length > 0 && (
        <section className="mt-12 border-t border-border-button-default pt-6">
          <h2 className="eyebrow text-text-tertiary">Measured, not modelled</h2>
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
