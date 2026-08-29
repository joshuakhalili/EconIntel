import { Link, useParams } from 'react-router-dom';
import { RiArrowRightLine, RiArrowLeftLine } from '@remixicon/react';
import { useLens, useLensTickers, useLensNews, useLenses } from '@/hooks/queries';
import { useRegister } from '@/lib/preferences';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import StrengthBadge from '@/components/StrengthBadge';
import TickerStrip from '@/components/TickerStrip';
import NewsList from '@/components/NewsList';
import Reading from '@/components/Reading';
import LensSignature from '@/components/lens/LensSignature';
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
  const register = useRegister();

  const { data: lens, isPending, isError, error } = useLens(slug);
  const { data: lenses } = useLenses();
  const { data: tickers } = useLensTickers(slug);
  const { data: news, isPending: newsPending } = useLensNews(slug, {
    enabled: lens?.has_news !== false,
  });

  usePageTitle(lens?.name ?? 'Lens', lens?.subtitle);

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="this lens" />;

  const thesis = register(lens.thesis_plain, lens.thesis_expert);
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

        <div className="mt-6 grid gap-3 lg:grid-cols-2">
          {(lens.questions ?? []).map((q) => (
            <Link
              key={q.id}
              to={`/q/${q.slug}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-button-default bg-panel p-6 transition-colors hover:border-white/25 hover:bg-raised"
            >
              <span
                className="absolute inset-x-0 top-0 h-px opacity-70"
                style={{ background: `linear-gradient(90deg, ${accent.hex}, transparent)` }}
                aria-hidden
              />
              <span className="flex items-start justify-between gap-4">
                <span className="text-title-3-medium text-text-primary">{q.question}</span>
                <RiArrowRightLine
                  className="mt-1 size-4 shrink-0 text-text-tertiary transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
              {q.subtitle && (
                <span className="mt-1 text-caption-1-regular text-text-tertiary">{q.subtitle}</span>
              )}
              <span className="mt-3 line-clamp-3 text-body-regular leading-relaxed text-text-secondary">
                {register(q.answer_plain, q.answer_expert)}
              </span>
              <span className="mt-4 flex items-center gap-3">
                <StrengthBadge strength={q.strength} />
                <span className="figure text-caption-1-regular text-text-tertiary">
                  {q.indicator_count} indicators
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Reading
        items={lens.reading}
        scopeNote="Institutional and industry work covering this subject as a whole."
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
