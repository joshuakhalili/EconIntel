import { Link, useParams } from 'react-router-dom';
import { RiArrowRightLine, RiArrowLeftLine } from '@remixicon/react';
import { useLens, useLensTickers, useLensNews, useLenses } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import TickerStrip from '@/components/TickerStrip';
import NewsList from '@/components/NewsList';
import Reading from '@/components/Reading';
import LensSignature from '@/components/lens/LensSignature';
import FigureChart from '@/components/charts/FigureChart';
import QuestionCard from '@/components/QuestionCard';
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
export default function LensPage() {
  const { slug } = useParams();

  const { data: lens, isPending, isError, error } = useLens(slug);
  const { data: lenses } = useLenses();
  const { data: tickers } = useLensTickers(slug);
  const { data: news, isPending: newsPending } = useLensNews(slug, {
    enabled: lens?.has_news !== false,
  });

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

      {thesis && (
        <p className="prose-measure mt-10 text-headline-regular leading-relaxed text-text-secondary">
          {thesis}
        </p>
      )}

      <LensSignature lens={lens} tickers={tickers} accent={accent} />

      {tickers?.length > 0 && (
        <section className="mt-14">
          <p className="eyebrow" style={{ color: accent.hex }}>
            The prices underneath
          </p>
          <p className="prose-measure mt-2 text-body-regular text-text-tertiary">
            Each one is here for a reason specific to this lens, not as a market feed. Open any of
            them to see why it is on this page.
          </p>
          <div className="mt-5">
            <TickerStrip tickers={tickers} />
          </div>
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
          <p className="prose-measure mt-2 text-body-regular text-text-tertiary">
            Matched by a search stored against this lens — deterministic and editable, not a
            model&rsquo;s judgement.
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
            className="group flex flex-col rounded-2xl border border-border-button-default bg-panel p-5 transition-colors hover:bg-raised"
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
            className="group flex flex-col items-end rounded-2xl border border-border-button-default bg-panel p-5 text-right transition-colors hover:bg-raised sm:col-start-2"
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
