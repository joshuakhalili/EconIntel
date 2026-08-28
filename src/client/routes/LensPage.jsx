import { Link, useParams } from 'react-router-dom';
import { RiArrowRightLine } from '@remixicon/react';
import { useLens, useLensTickers, useLensNews } from '@/hooks/queries';
import { useRegister } from '@/lib/preferences';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock, EmptyBlock, Section } from '@/components/Page';
import TickerStrip from '@/components/TickerStrip';
import NewsList from '@/components/NewsList';

/**
 * A lens: one way of looking at the subject.
 *
 * Three things sit under it — the prices it depends on, the questions asked
 * through it, and what was reported that bears on it. Each section loads
 * independently, so a slow news query does not hold up the thesis.
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
    <div className="mx-auto max-w-5xl">
      {thesis && (
        <section className="mb-8 rounded-2xl border border-border-button-default bg-background-primary-default p-5">
          <p className="text-headline-regular text-text-primary">{thesis}</p>
        </section>
      )}

      {tickers && <TickerStrip tickers={tickers} />}

      <Section title="Questions">
        {lens.questions?.length ? (
          <ul className="grid gap-3 lg:grid-cols-2">
            {lens.questions.map((question) => (
              <li key={question.slug}>
                <Link
                  to={`/q/${question.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-border-button-default bg-background-primary-default p-5 transition-colors hover:bg-background-secondary-hover"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-title-3-medium text-text-primary">{question.question}</span>
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
                  <span className="mt-3 text-caption-1-regular text-text-tertiary">
                    {question.indicator_count} indicators
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyBlock>No questions are published under this lens yet.</EmptyBlock>
        )}
      </Section>

      {lens.has_news !== false && (
        <Section
          title="Reported on this"
          caption="Filtered by a search query stored against this lens — deterministic, not a model's judgement."
        >
          {newsPending ? (
            <LoadingBlock rows={3} />
          ) : (
            <NewsList documents={news} emptyMessage="Nothing stored for this lens yet." />
          )}
        </Section>
      )}
    </div>
  );
}
