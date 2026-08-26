import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RiArrowLeftLine, RiAlertLine } from '@remixicon/react';
import { useQuestion } from '@/hooks/queries';
import { useRegister } from '@/lib/preferences';
import { usePageTitle } from '@/components/chrome/AppShell';
import { useContextDrawer } from '@/components/chrome/ContextDrawer';
import { LoadingBlock, ErrorBlock, EmptyBlock, Section } from '@/components/Page';
import ChartGroup from '@/components/charts/ChartGroup';
import { groupIndicators } from '@/lib/groupIndicators';

/**
 * One question, and the evidence under it.
 *
 * The answer is stored text in two registers — the technical one is not the
 * plain one with jargon added, it answers a different question, usually how a
 * thing was measured and where it misleads.
 *
 * The caveat is a section, not a footnote. Where a measurement is weak, that
 * belongs at the same weight as the finding.
 */
export default function QuestionPage() {
  const { slug } = useParams();
  const { data: question, isPending, isError, error } = useQuestion(slug);
  const register = useRegister();
  const { open } = useContextDrawer();

  usePageTitle(question?.question ?? 'Question', question?.subtitle);

  const groups = useMemo(() => groupIndicators(question?.indicators), [question]);

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="this question" />;

  const answer = register(question.answer_plain, question.answer_expert);

  return (
    <div className="mx-auto max-w-5xl">
      {question.lens_slug && (
        <Link
          to={`/lens/${question.lens_slug}`}
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-body-regular text-text-tertiary hover:text-text-secondary"
        >
          <RiArrowLeftLine className="size-4" aria-hidden />
          {question.lens_name}
        </Link>
      )}

      {answer && (
        <section className="mb-8 rounded-2xl border border-border-secondary bg-background-primary-default p-5">
          <p className="text-body-large text-text-primary">{answer}</p>
        </section>
      )}

      {groups.hero.length > 0 && (
        <Section>
          {groups.hero.map((group) => (
            <ChartGroup key={group.key} members={group.members} height={340} onPick={open} />
          ))}
        </Section>
      )}

      {groups.supporting.length > 0 && (
        <Section title="Supporting">
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.supporting.map((group) => (
              <ChartGroup key={group.key} members={group.members} onPick={open} />
            ))}
          </div>
        </Section>
      )}

      {groups.context.length > 0 && (
        <Section
          title="Context"
          caption="Not evidence for the answer — the backdrop it has to be read against."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {groups.context.map((group) => (
              <ChartGroup key={group.key} members={group.members} height={220} onPick={open} />
            ))}
          </div>
        </Section>
      )}

      {question.indicators?.length === 0 && (
        <EmptyBlock>No indicators are attached to this question yet.</EmptyBlock>
      )}

      {question.caveat && (
        <section className="mt-8 flex items-start gap-3 rounded-2xl border border-border-secondary bg-background-secondary-default p-5">
          <RiAlertLine className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
          <div>
            <h2 className="text-body-medium text-text-primary">What this does not show</h2>
            <p className="mt-1 text-body-regular text-text-secondary">{question.caveat}</p>
          </div>
        </section>
      )}
    </div>
  );
}
