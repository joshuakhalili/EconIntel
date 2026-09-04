import { Link, useParams } from 'react-router-dom';
import { RiArrowRightLine, RiArrowLeftLine, RiFlaskLine } from '@remixicon/react';
import { useLens, useLensTickers, useLensNews, useLenses, useScenarios } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import TickerStrip from '@/components/TickerStrip';
import NewsList from '@/components/NewsList';
import Reading from '@/components/Reading';
import LensSignature from '@/components/lens/LensSignature';
import CircularFinancing from '@/components/lens/CircularFinancing';
import NarrationBlock from '@/components/NarrationBlock';
import FigureChart from '@/components/charts/FigureChart';
import QuestionCard from '@/components/QuestionCard';
import PriceMarquee from '@/components/PriceMarquee';
import { LENS_ACCENT } from '@/lib/lensAccent';

/**
 * A lens: one way of looking at the subject.
 *
 * Five of these exist and they are deliberately not five copies of one
 * template. Reading what each holds makes the differences obvious — Investment
 * is priced physical inputs, Growth is adoption rates, Labour is three
 * questions where every one is contested, Prices is two series moving in
 * opposite directions, Policy is a handful of discrete counts. Each gets its
 * own signature module in the middle of the page; everything around it is
 * shared.
 *
 * The chrome, type and surfaces are the landing page's, so crossing from one to
 * the other is not a seam. The per-lens accent is chrome only — eyebrow,
 * hairline, hero wash. It never draws data, because the six chart hues are
 * colourblind-validated and their order is load-bearing.
 */

/**
 * Which scenarios belong to which lens.
 *
 * A LITERAL, AND DELIBERATELY NOT A COUNT OR A GUESS. `/simulate/:slug` had no
 * inbound link anywhere on the site — not the nav, not a lens, not a question —
 * so the largest feature in the codebase was reachable only by typing its slug.
 * The binding it needed is editorial: `ai-capex-dotcom` is about AI capital
 * spending, so it belongs under Investment & Capital and nowhere else. There is
 * no join table for that and this is the same shape `SCENARIO_EVIDENCE` uses
 * server-side for the same kind of decision.
 *
 * A scenario absent from this map appears on no lens — which fails the same way
 * the bug did, so it is stated rather than left to be discovered. A scenario
 * index behind a nav entry is the real answer and TopNav belongs to another
 * part of the site.
 */
const LENS_SCENARIOS = {
  investment: ['ai-capex-dotcom'],
};
export default function LensPage() {
  const { slug } = useParams();

  const { data: lens, isPending, isError, error } = useLens(slug);
  const { data: lenses } = useLenses();
  const { data: tickers } = useLensTickers(slug);
  const { data: news, isPending: newsPending } = useLensNews(slug, {
    enabled: lens?.has_news !== false,
  });
  const { data: scenarios } = useScenarios();

  usePageTitle(lens?.name ?? 'Lens', lens?.subtitle);

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="this lens" />;

  const thesis = lens.thesis_plain;
  const accent = LENS_ACCENT[lens.id] ?? LENS_ACCENT.default;

  // Causal order — Investment, Growth, Labour, Prices, Policy — is the order
  // the lenses are stored in, so previous/next reads as the argument running
  // rather than as alphabetical neighbours.
  const order = lenses ?? [];
  const here = order.findIndex((l) => l.slug === slug);
  const prev = here > 0 ? order[here - 1] : null;
  const next = here >= 0 && here < order.length - 1 ? order[here + 1] : null;

  const lensScenarios = scenariosForLens(scenarios, lens.id, LENS_SCENARIOS);

  return (
    <article>
      {/* Hero band — the landing page's rhythm, pulled full-bleed out of the
          content column. A band that stops at the text margin reads as a card. */}
      <header className="relative -mx-4 overflow-hidden rounded-3xl sm:-mx-6">
        <div className="gradient-band absolute inset-0" aria-hidden />
        <div className="starfield absolute inset-0 opacity-60" aria-hidden />
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{ background: `radial-gradient(80% 60% at 18% 0%, ${accent.glow}, transparent 70%)` }}
          aria-hidden
        />

        <div className="relative px-6 py-14 sm:px-10 sm:py-20">
          {here >= 0 && (
            <p className="eyebrow" style={{ color: accent.hex }}>
              Lens {String(here + 1).padStart(2, '0')} of {order.length}
            </p>
          )}
          <h1 className="mt-3 max-w-3xl text-[clamp(2.25rem,5.5vw,4rem)] leading-[1.05] text-text-primary">
            {lens.name}
          </h1>
          {lens.subtitle && (
            <p className="mt-3 max-w-2xl text-headline-regular text-text-secondary">
              {lens.subtitle}
            </p>
          )}
        </div>
      </header>

      {/* Prices & Markets only. This is chrome rather than argument — the
          signature switch in LensSignature is about the middle of the page —
          and it is the one lens where a live scrolling band of prices is the
          subject rather than decoration. */}
      {lens.id === 'prices' && <PriceMarquee tickers={tickers} />}

      {thesis && (
        <p className="prose-measure mt-10 text-headline-regular leading-relaxed text-text-secondary">
          {thesis}
        </p>
      )}

      <LensSignature lens={lens} tickers={tickers} accent={accent} />

      {/* Investment only. The financing graph is about who funded whom, which
          is a different question from every other lens's subject, and it is
          the feature the `events` table was built for. Mounted here rather
          than inside LensSignature because it fetches its own data — the
          signature modules are all driven by tickers the page already has,
          and putting a request inside that switch would make four lenses pay
          for a query only one of them uses. */}
      {lens.id === 'investment' && <CircularFinancing accent={accent} />}

      {tickers?.length > 0 && (
        <section className="mt-14">
          {/*
            The eyebrow is chrome, not a heading, and this section had only the
            eyebrow — so a reader navigating by heading went straight from "What
            others have found" into six news H3s further down, with two whole
            sections invisible in between. Every other section here already
            pairs the eyebrow with a real H2; these two were the exceptions.
          */}
          <p className="eyebrow" style={{ color: accent.hex }}>
            The prices underneath
          </p>
          <h2 className="mt-3 text-title-1-medium text-text-primary">
            {tickers.length === 1
              ? 'One price is tracked under this lens'
              : `${tickers.length} prices are tracked under this lens`}
          </h2>
          <p className="prose-measure mt-2 text-body-regular text-text-tertiary">
            Each one is here for a reason specific to this lens, not as a market feed. Open any of
            them to see why it is on this page.
          </p>
          <div className="mt-5">
            <TickerStrip tickers={tickers} />
          </div>

          {/* Below the strip, not above it. The narration describes these
              exact figures, so a reader meets the numbers first and the
              machine's summary of them second — which is the right order for
              the one paragraph here nobody wrote. */}
          {/* `tickers` is not decoration here. NarrationBlock computes whether the
              stored prose has fallen behind the live figures and says so to the
              reader — and without this prop narrationStaleness gets tickerPeriod
              null and hardcodes stale=false, so the warning could never fire. It
              was built in one file and mounted in another, and the seam between
              them left the safeguard dead. Measured when it was wired: prices
              (narration 28 Aug against tickers 2 Sep) and regulation (1 Aug
              against 1 Sep) both go stale — regulation being the exact page the
              component's docblock was written about. */}
          <NarrationBlock narration={lens.narration} tickers={tickers} />
        </section>
      )}

      <section className="mt-14">
        <p className="eyebrow" style={{ color: accent.hex }}>
          The questions
        </p>
        <h2 className="mt-3 text-title-1-medium text-text-primary">
          {lens.questions?.length === 1
            ? 'One question sits under this lens'
            : `${lens.questions?.length ?? 0} questions sit under this lens`}
        </h2>
        <p className="prose-measure mt-2 text-body-regular text-text-tertiary">
          Each states how far its own evidence goes before you open it.
        </p>

        <div className="stagger mt-6 grid gap-3 lg:grid-cols-2">
          {(lens.questions ?? []).map((q, i) => (
            <QuestionCard key={q.id} question={q} accent={accent} index={i} />
          ))}
        </div>
      </section>

      {/* The scenario, where a reader will actually meet it. See LENS_SCENARIOS. */}
      {lensScenarios.length > 0 && (
        <section className="mt-14">
          <p className="eyebrow flex items-center gap-2" style={{ color: accent.hex }}>
            <RiFlaskLine className="size-3.5 shrink-0" aria-hidden />
            Run it forward
          </p>
          <h2 className="mt-3 text-title-1-medium text-text-primary">
            {lensScenarios.length === 1
              ? 'One scenario extends this lens'
              : `${lensScenarios.length} scenarios extend this lens`}
          </h2>
          <p className="prose-measure mt-2 text-body-regular text-text-tertiary">
            The only pages on this site whose numbers were not measured. They are arithmetic
            on published coefficients — every one cited on the page — and each stops at the
            horizon its sources publish rather than extending a line the paper does not draw.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            {lensScenarios.map((scenario) => (
              <Link
                key={scenario.slug}
                to={`/simulate/${scenario.slug}`}
                className="group tint flex flex-col rounded-2xl border border-border-button-default bg-panel p-5 hover:bg-raised"
              >
                <span className="text-title-3-medium text-text-primary">{scenario.name}</span>
                {scenario.subtitle && (
                  <span className="prose-measure mt-1 text-body-regular text-text-secondary">
                    {scenario.subtitle}
                  </span>
                )}
                <span className="mt-3 flex items-center gap-1.5 text-caption-1-medium text-text-tertiary">
                  Modelled, not measured — {scenario.country_count ?? scenario.countries?.length}{' '}
                  countries, {scenario.horizon_years} years
                  <RiArrowRightLine
                    className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Figures filed against the lens rather than one of its questions — a
          BIS chart on AI capex is about Investment & Capital as a whole. Not
          this site's own measurements, and each one says so on its face. */}
      {lens.figures?.length > 0 && (
        <section className="mt-14">
          <p className="eyebrow" style={{ color: accent.hex }}>
            From the reports
          </p>
          <h2 className="mt-3 text-title-1-medium text-text-primary">
            What the literature measured
          </h2>
          <p className="prose-measure mt-2 text-body-regular text-text-tertiary">
            Read off a named page of a named report and shown with the line they came from. Mostly
            surveys and model results rather than measurements of the economy, and each chart says
            which.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            {lens.figures.map((figure) => (
              <FigureChart key={figure.id} figure={figure} />
            ))}
          </div>
        </section>
      )}

      <Reading
        items={lens.reading}
        scopeNote="Institutional and industry work covering this subject as a whole."
        accent={accent}
      />

      {lens.has_news !== false && (
        <section className="mt-14">
          <p className="eyebrow" style={{ color: accent.hex }}>
            Reported on this
          </p>
          <h2 className="mt-3 text-title-1-medium text-text-primary">What is being reported</h2>
          <p className="prose-measure mt-2 text-body-regular text-text-tertiary">
            Matched by a search stored against this lens — deterministic and editable, not a
            model&rsquo;s judgement. Each article carries a relevance figure out of 100: a keyword
            score computed when it was collected. It is shown rather than hidden, but it
            does filter: articles scoring under 40 never reach this list.
          </p>
          <div className="mt-5">
            {newsPending ? (
              <LoadingBlock rows={3} />
            ) : (
              <NewsList documents={news} emptyMessage="Nothing stored for this lens yet." />
            )}
          </div>
        </section>
      )}

      <nav
        className="mt-16 grid gap-3 border-t border-border-button-default pt-8 sm:grid-cols-2"
        aria-label="Other lenses"
      >
        {prev ? (
          <Link
            to={`/lens/${prev.slug}`}
            className="group flex flex-col rounded-2xl border border-border-button-default bg-panel p-5 tint hover:bg-raised"
          >
            <span className="flex items-center gap-1.5 text-caption-1-regular text-text-tertiary">
              <RiArrowLeftLine
                className="size-3.5 transition-transform group-hover:-translate-x-0.5"
                aria-hidden
              />
              Before this
            </span>
            <span className="mt-1 text-title-3-medium text-text-primary">{prev.name}</span>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link
            to={`/lens/${next.slug}`}
            className="group flex flex-col items-end rounded-2xl border border-border-button-default bg-panel p-5 text-right tint hover:bg-raised sm:col-start-2"
          >
            <span className="flex items-center gap-1.5 text-caption-1-regular text-text-tertiary">
              Next
              <RiArrowRightLine
                className="size-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </span>
            <span className="mt-1 text-title-3-medium text-text-primary">{next.name}</span>
          </Link>
        )}
      </nav>
    </article>
  );
}

/**
 * The published scenarios this lens offers, in the order the API returned them.
 *
 * Filtered by the editorial map rather than by anything derivable, and it fails
 * CLOSED: a slug in the map with no published scenario behind it produces
 * nothing rather than a dead link, which is what happens while a scenario is
 * still a draft. Exported so `reader-pages.test.js` can hold it without a DOM.
 */
export function scenariosForLens(scenarios, lensId, map) {
  const allowed = map?.[lensId];
  if (!allowed || !Array.isArray(scenarios)) return [];
  return scenarios.filter((s) => allowed.includes(s.slug));
}
