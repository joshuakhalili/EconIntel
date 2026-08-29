import { Link, useParams } from 'react-router-dom';
import { RiArrowRightLine } from '@remixicon/react';
import { useLens, useLensTickers, useLensNews } from '@/hooks/queries';
import { useRegister } from '@/lib/preferences';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/Page';
import StrengthBadge from '@/components/StrengthBadge';
import TickerStrip from '@/components/TickerStrip';
import NewsList from '@/components/NewsList';
import Reading from '@/components/Reading';

/**
 * A lens: one way of looking at the subject.
 *
 * This page used to open on a boxed paragraph with no heading, then a price
 * strip with no explanation, then cards. It read as a container rather than
 * as a piece of writing — the complaint that the top of it was "just air".
 *
 * It now opens the way an article does: the subject, then the argument, then
 * the evidence beneath it. The thesis is set as prose at a readable measure
 * rather than inside a card, because a box around a paragraph tells a reader
 * it is a widget; the questions carry the strength of their own evidence, so
 * a reader can see before clicking that productivity is unresolved while
 * investment is not.
 *
 * Each section still loads independently, so a slow news query does not hold
 * up the thesis.
 */
export default function LensPage() {
  const { slug } = useParams();
  const register = useRegister();

  const { data: lens, isPending, isError, error } = useLens(slug);
  const { data: tickers } = useLensTickers(slug);
  const { data: news, isPending: newsPending } = useLensNews(slug, {
    enabled: lens?.has_news !== false,
  });

  usePageTitle(lens?.name ?? 'Lens', lens?.subtitle);

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="this lens" />;

  const thesis = register(lens.thesis_plain, lens.thesis_expert);

  return (
    <article className="mx-auto max-w-5xl">
      <header>
        <h1 className="text-display-4-medium text-text-primary">{lens.name}</h1>
        {lens.subtitle && (
          <p className="mt-2 text-headline-regular text-text-tertiary">{lens.subtitle}</p>
        )}
      </header>

      {thesis && (
        <p className="prose-measure mt-6 text-headline-regular leading-relaxed text-text-primary">
          {thesis}
        </p>
      )}

      {tickers?.length > 0 && (
        <section className="mt-8">
          <h2 className="text-title-3-medium text-text-primary">The prices underneath</h2>
          <p className="mb-3 mt-1 max-w-2xl text-body-regular text-text-tertiary">
            Each one is here for a reason specific to this lens, not as a market feed. Open any of
            them to see why it is on this page.
          </p>
          <TickerStrip tickers={tickers} />
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-title-3-medium text-text-primary">The questions</h2>
        <p className="mb-4 mt-1 max-w-2xl text-body-regular text-text-tertiary">
          Each states how far its own evidence goes before you open it.
        </p>

        {lens.questions?.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {lens.questions.map((question) => (
              <li key={question.slug} className="flex">
                <Link
                  to={`/q/${question.slug}`}
                  className="group flex h-full w-full flex-col rounded-2xl border border-border-button-default bg-background-primary-default p-5 transition-colors hover:border-accent-300 hover:bg-background-secondary-hover"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-title-3-medium text-text-primary">
                      {question.question}
                    </span>
                    <RiArrowRightLine
                      className="mt-1 size-4 shrink-0 text-foreground-icon-secondary transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>

                  {question.subtitle && (
                    <span className="mt-1 text-body-regular text-text-tertiary">
                      {question.subtitle}
                    </span>
                  )}

                  <span className="mt-3 line-clamp-3 text-body-regular text-text-secondary">
                    {register(question.answer_plain, question.answer_expert)}
                  </span>

                  {/* mt-auto pins this row to the bottom so the badges line up
                      across a pair of cards whose answers ran to different
                      lengths. */}
                  <span className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                    <StrengthBadge strength={question.strength} />
                    <span className="text-caption-1-regular text-text-tertiary">
                      {question.indicator_count} indicators
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyBlock>No questions are published under this lens yet.</EmptyBlock>
        )}
      </section>

      <Reading
        items={lens.reading}
        scopeNote="Institutional and industry work covering this subject as a whole."
      />

      {lens.has_news !== false && (
        <section className="mt-10">
          <h2 className="text-title-3-medium text-text-primary">Reported on this</h2>
          <p className="mb-4 mt-1 max-w-2xl text-body-regular text-text-tertiary">
            Matched by a search stored against this lens — deterministic and editable, not a
            model&rsquo;s judgement.
          </p>
          {newsPending ? (
            <LoadingBlock rows={3} />
          ) : (
            <NewsList documents={news} emptyMessage="Nothing stored for this lens yet." />
          )}
        </section>
      )}
    </article>
  );
}
