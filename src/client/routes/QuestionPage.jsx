import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RiArrowLeftLine, RiAlertLine, RiExternalLinkLine } from '@remixicon/react';
import { useQuestion } from '@/hooks/queries';
import { useRegister } from '@/lib/preferences';
import { usePageTitle } from '@/components/chrome/AppShell';
import { useContextDrawer } from '@/components/chrome/ContextDrawer';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/Page';
import ChartGroup from '@/components/charts/ChartGroup';
import StrengthBadge, { STRENGTH } from '@/components/StrengthBadge';
import { groupIndicators } from '@/lib/groupIndicators';

/**
 * One question, argued.
 *
 * This page used to be an answer, a caveat and a stack of charts, which stated
 * a conclusion without ever showing the reasoning — the reader had no way to
 * see what mechanism was being claimed, how it was measured, or how far the
 * evidence could be pushed. It now reads in the order an argument runs:
 *
 *   the finding → how confident, and when it was last checked
 *   → what it cannot show → the mechanism being claimed
 *   → how this page measures it → the evidence → what others have found
 *
 * The caveat stays directly under the answer and above every chart. Its
 * position is the claim: the limits of a finding are part of the finding, not
 * a footnote a reader reaches only if they scroll to the end.
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
    <article className="mx-auto max-w-4xl">
      {question.lens_slug && (
        <Link
          to={`/lens/${question.lens_slug}`}
          className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-body-regular text-text-tertiary hover:text-text-secondary"
        >
          <RiArrowLeftLine className="size-4" aria-hidden />
          {question.lens_name}
        </Link>
      )}

      {/* The question is the headline. It used to live only in the topbar,
          so the page itself opened on an unattributed paragraph. */}
      <h1 className="text-display-4-medium text-text-primary">{question.question}</h1>
      {question.subtitle && (
        <p className="mt-2 text-headline-regular text-text-tertiary">{question.subtitle}</p>
      )}

      <Strength strength={question.strength} reviewed={question.last_reviewed} />

      {answer && (
        <p className="prose-measure mt-6 text-headline-regular leading-relaxed text-text-primary">
          {answer}
        </p>
      )}

      {question.caveat && (
        <section className="mt-6 flex items-start gap-3 rounded-2xl border border-warn/40 bg-background-primary-default p-5">
          <RiAlertLine className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
          <div className="prose-measure">
            <h2 className="text-body-medium text-text-primary">What this does not show</h2>
            <p className="mt-1 text-body-regular text-text-secondary">{question.caveat}</p>
          </div>
        </section>
      )}

      <Prose title="The claim being tested" body={question.theory} />
      <Prose title="How this is measured" body={question.method} />

      {/* ── The evidence ─────────────────────────────────────────────────── */}
      {groups.hero.length > 0 && (
        <Section title="The evidence">
          {groups.hero.map((group) => (
            <ChartGroup key={group.key} members={group.members} height={340} onPick={open} />
          ))}
        </Section>
      )}

      {groups.supporting.length > 0 && (
        <Section title="Supporting series">
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
          note="Not evidence for the answer — the backdrop it has to be read against."
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

      <Reading items={question.reading} />
    </article>
  );
}

/**
 * How far the evidence can be pushed, and when a person last checked.
 *
 * Shown at the top rather than buried, because it changes how everything below
 * should be read.
 */
function Strength({ strength, reviewed }) {
  const meta = STRENGTH[strength];
  if (!meta && !reviewed) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <StrengthBadge strength={strength} />
      {meta && (
        <span className="text-caption-1-regular text-text-tertiary">{meta.detail}</span>
      )}
      {reviewed && (
        <span className="text-caption-1-regular text-text-tertiary">
          {/* Numbers update on ingestion; the sentences around them do not. */}
          · Prose last checked against the data on {formatDay(reviewed)}
        </span>
      )}
    </div>
  );
}

function Prose({ title, body }) {
  if (!body) return null;
  return (
    <section className="mt-8">
      <h2 className="text-title-3-medium text-text-primary">{title}</h2>
      <p className="prose-measure mt-2 text-body-regular leading-relaxed text-text-secondary">
        {body}
      </p>
    </section>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="mt-10">
      <h2 className="text-title-3-medium text-text-primary">{title}</h2>
      {note && <p className="mt-1 text-body-regular text-text-tertiary">{note}</p>}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

/**
 * What other people have found.
 *
 * Sources are labelled by kind and never ranked. A peer-reviewed paper and a
 * consulting survey are not the same evidence, but which one to believe is the
 * reader's call, and the differences in method, motive and data access are the
 * interesting part rather than a scoring problem.
 */
const KIND = {
  academic: 'Academic',
  consulting: 'Consulting',
  think_tank: 'Think tank',
  official: 'Official',
  industry: 'Industry',
};

function Reading({ items }) {
  if (!items?.length) return null;

  return (
    <section className="mt-10">
      <h2 className="text-title-3-medium text-text-primary">What others have found</h2>
      <p className="mt-1 max-w-2xl text-body-regular text-text-tertiary">
        Published elsewhere on this question. Labelled by who produced it, not ranked — method,
        motive and data access differ, and that is the part worth seeing.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-3 rounded-2lg border border-border-button-default bg-background-primary-default p-4 transition-colors hover:border-accent-300 hover:bg-background-secondary-hover"
            >
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-border-button-default px-2 py-0.5 text-caption-1-medium text-text-tertiary">
                    {KIND[item.kind] ?? item.kind}
                  </span>
                  <span className="text-caption-1-medium text-text-secondary">
                    {item.publisher}
                  </span>
                  {item.published && (
                    <span className="text-caption-1-regular text-text-tertiary">
                      {new Date(item.published).getUTCFullYear()}
                    </span>
                  )}
                  {/* Says whose page this source was filed against, so a
                      lens-level report does not read as though it were written
                      about this question specifically. */}
                  {item.scope === 'lens' && (
                    <span className="text-caption-1-regular text-text-tertiary">
                      · on this lens
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-body-medium text-text-primary">{item.title}</span>
                {item.takeaway && (
                  <span className="mt-1 block text-body-regular text-text-secondary">
                    {item.takeaway}
                  </span>
                )}
              </span>
              <RiExternalLinkLine
                className="mt-0.5 size-4 shrink-0 text-foreground-icon-secondary opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDay(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
