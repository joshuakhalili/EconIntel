import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { RiArrowLeftLine, RiArrowRightLine, RiAlertLine } from '@remixicon/react';
import { useQuestion } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { useContextDrawer } from '@/components/chrome/ContextDrawer';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/Page';
import ChartGroup from '@/components/charts/ChartGroup';
import FigureChart from '@/components/charts/FigureChart';
import StrengthBadge, { STRENGTH } from '@/components/StrengthBadge';
import Reading from '@/components/Reading';
import { groupIndicators } from '@/lib/groupIndicators';
import { LENS_ACCENT } from '@/lib/lensAccent';
import { useReveal, revealClass } from '@/hooks/useReveal';

/**
 * One question, argued.
 *
 * A question page is a step inside a lens, so it is built out of the same
 * pieces: the landing page's hero band, eyebrow kickers, one accent carried
 * down from the parent lens, and figures in the mono face. What changes is the
 * shape of the argument, which runs in this order and no other:
 *
 *   the finding → how confident, and when it was last checked
 *   → what it cannot show → the mechanism being claimed
 *   → how this page measures it → the evidence → what others have found
 *
 * THE CAVEAT'S POSITION IS THE CLAIM.
 *
 * It sits directly under the answer, above every chart, in a full-width band of
 * its own. An earlier version put it last, after four charts, in a recessed
 * surface — technically a first-class section in the markup and a footnote to
 * anybody actually reading. The limits of a finding are part of the finding.
 *
 * It is a hairline and a label rather than a coloured panel. Amber fill across
 * a full-width band would read as an error state, and this is not an error —
 * it is the honest edge of a real result.
 *
 * Nothing on this page is generated. Every sentence is stored prose, and the
 * charts are drawn by components whose honesty behaviours (single axis, zero
 * baseline disclosed, gaps left broken, rebasing declared) live inside them and
 * are not this file's to reinterpret.
 */
export default function QuestionPage() {
  const { slug } = useParams();
  const { data: question, isPending, isError, error } = useQuestion(slug);
  const { open } = useContextDrawer();

  usePageTitle(question?.question ?? 'Question', question?.subtitle);

  const groups = useMemo(() => groupIndicators(question?.indicators), [question]);

  if (isPending) return <LoadingBlock rows={4} />;
  if (isError) return <ErrorBlock error={error} what="this question" />;

  const answer = question.answer_plain;
  const accent = LENS_ACCENT[question.lens_id] ?? LENS_ACCENT.default;

  const siblings = question.siblings ?? [];
  const here = siblings.findIndex((q) => q.slug === slug);
  const prev = here > 0 ? siblings[here - 1] : null;
  const next = here >= 0 && here < siblings.length - 1 ? siblings[here + 1] : null;

  return (
    <article>
      {/* ── The question ──────────────────────────────────────────────────
          The same band the lens page opens on, shorter, with the accent wash
          entering from the other side. A question is a step inside its lens,
          not a different kind of page. */}
      <header className="relative -mx-4 overflow-hidden rounded-3xl sm:-mx-6">
        <div className="gradient-band absolute inset-0" aria-hidden />
        <div className="starfield absolute inset-0 opacity-40" aria-hidden />
        <div
          className="absolute inset-0 mix-blend-screen"
          style={{
            background: `radial-gradient(70% 60% at 82% 0%, ${accent.glow}, transparent 70%)`,
          }}
          aria-hidden
        />

        <div className="relative px-6 py-12 sm:px-10 sm:py-16">
          {question.lens_slug && (
            <Link
              to={`/lens/${question.lens_slug}`}
              className="group inline-flex min-h-11 items-center gap-1.5"
            >
              <RiArrowLeftLine
                className="size-3.5 shrink-0 transition-transform group-hover:-translate-x-0.5"
                style={{ color: accent.hex }}
                aria-hidden
              />
              <span className="eyebrow" style={{ color: accent.hex }}>
                {question.lens_name}
                {here >= 0 && siblings.length > 1 && (
                  <>
                    {' · '}Question {String(here + 1).padStart(2, '0')} of{' '}
                    {String(siblings.length).padStart(2, '0')}
                  </>
                )}
              </span>
            </Link>
          )}

          <h1 className="mt-3 max-w-4xl text-[clamp(1.875rem,4.4vw,3.25rem)] leading-[1.06] text-text-primary">
            {question.question}
          </h1>
          {question.subtitle && (
            <p className="mt-3 max-w-2xl text-headline-regular text-text-secondary">
              {question.subtitle}
            </p>
          )}

          <Strength strength={question.strength} reviewed={question.last_reviewed} />
        </div>
      </header>

      {/* ── The finding ───────────────────────────────────────────────────
          Set larger than the prose below it. This paragraph is what the page
          is for; everything after it is the working. */}
      {answer && (
        <section className="mt-12">
          <p className="eyebrow" style={{ color: accent.hex }}>
            The finding
          </p>
          <p className="prose-measure mt-4 text-[clamp(1.125rem,1.9vw,1.5rem)] leading-[1.55] text-text-primary">
            {answer}
          </p>
        </section>
      )}

      {/* ── What it does not show ─────────────────────────────────────────
          Full width, above every chart, and impossible to scroll past on the
          way to one. */}
      {question.caveat && (
        <section className="relative -mx-4 mt-12 overflow-hidden rounded-3xl bg-panel sm:-mx-6">
          <span
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, var(--color-warn), transparent 70%)' }}
            aria-hidden
          />
          <div className="relative flex flex-col gap-4 px-6 py-10 sm:flex-row sm:gap-6 sm:px-10 sm:py-12">
            <RiAlertLine
              className="size-5 shrink-0"
              style={{ color: 'var(--color-warn)' }}
              aria-hidden
            />
            <div>
              <h2 className="eyebrow" style={{ color: 'var(--color-warn)' }}>
                What this does not show
              </h2>
              {/* Split on blank lines rather than rendering the column raw.
                  Caveats are stored as prose and several now run to two or
                  three paragraphs — the external corroboration added in seed
                  030 is a second paragraph on seven of them. Rendered as one
                  text node the newlines collapse and the whole thing arrives
                  as an unbroken wall, which is the least likely part of the
                  page to be read at the best of times.

                  `whitespace-pre-line` would also preserve them, but it keeps
                  single newlines too and leaves no spacing between paragraphs;
                  real <p> elements get the type ramp's own rhythm. */}
              <div className="prose-measure mt-3 flex flex-col gap-4 text-headline-regular leading-relaxed text-text-secondary">
                {question.caveat
                  .split(/\n{2,}/)
                  .map((paragraph) => paragraph.trim())
                  .filter(Boolean)
                  .map((paragraph) => (
                    <p key={paragraph.slice(0, 40)}>{paragraph}</p>
                  ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── The reasoning ─────────────────────────────────────────────────
          Side by side because they answer two halves of the same objection:
          what is being claimed, and what was actually counted. */}
      {(question.theory || question.method) && (
        <div className="mt-12 grid gap-3 lg:grid-cols-2">
          <Prose accent={accent} title="The claim being tested" body={question.theory} />
          <Prose accent={accent} title="How this is measured" body={question.method} />
        </div>
      )}

      {/* ── The evidence ─────────────────────────────────────────────────── */}
      {groups.hero.length > 0 && (
        <Band
          accent={accent}
          eyebrow="The evidence"
          title={groups.hero.length === 1 ? 'The chart this rests on' : 'The charts this rests on'}
        >
          {groups.hero.map((group) => (
            <ChartGroup key={group.key} members={group.members} height={360} onPick={open} />
          ))}
        </Band>
      )}

      {groups.supporting.length > 0 && (
        <Band accent={accent} eyebrow="Supporting series" title="What else points the same way">
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.supporting.map((group) => (
              <ChartGroup key={group.key} members={group.members} onPick={open} />
            ))}
          </div>
        </Band>
      )}

      {groups.context.length > 0 && (
        <Band
          accent={accent}
          eyebrow="Context"
          title="The backdrop this has to be read against"
          note="Not evidence for the answer. These are here so the evidence is not read in isolation."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {groups.context.map((group) => (
              <ChartGroup key={group.key} members={group.members} height={220} onPick={open} />
            ))}
          </div>
        </Band>
      )}

      {/* ── What the literature measured ──────────────────────────────────
          Kept apart from the evidence bands above, because these are not this
          site's own measurements. They are numbers printed in someone else's
          report — mostly surveys of executives and model results — and each
          one says on its face which it is, what page it came from, and that
          no person here has checked it yet. */}
      {question.figures?.length > 0 && (
        <Band
          accent={accent}
          eyebrow="From the reports"
          title="What the literature measured"
          note="Read off a named page of a named report and shown with the line they came from. Not this site's own data — mostly surveys and model results, and each chart says which."
        >
          {question.figures.map((figure) => (
            <FigureChart key={figure.id} figure={figure} />
          ))}
        </Band>
      )}

      {question.indicators?.length === 0 && (
        <div className="mt-12">
          <EmptyBlock>No indicators are attached to this question yet.</EmptyBlock>
        </div>
      )}

      <Reading
        items={question.reading}
        scopeNote="Published elsewhere on this question."
        accent={accent}
      />

      <QuestionNav prev={prev} next={next} lens={question} />
    </article>
  );
}

/**
 * How far the evidence can be pushed, and when a person last checked.
 *
 * Inside the hero band rather than below it, because it changes how every
 * sentence after it should be read — including the one the reader meets first.
 */
function Strength({ strength, reviewed }) {
  const meta = STRENGTH[strength];
  if (!meta && !reviewed) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <StrengthBadge strength={strength} />
      {meta && <span className="text-caption-1-regular text-text-secondary">{meta.detail}</span>}
      {reviewed && (
        <span className="figure text-caption-1-regular text-text-tertiary">
          {/* Numbers update on ingestion; the sentences around them do not. */}
          · prose last checked against the data on {formatDay(reviewed)}
        </span>
      )}
    </div>
  );
}

/** One stored passage of reasoning, in a panel of its own. */
function Prose({ accent, title, body }) {
  if (!body) return null;
  return (
    <section className="rounded-2xl border border-border-button-default bg-panel p-6">
      <h2 className="eyebrow" style={{ color: accent.hex }}>
        {title}
      </h2>
      <p className="mt-3 text-body-regular leading-relaxed text-text-secondary">{body}</p>
    </section>
  );
}

/**
 * A full-width band of charts.
 *
 * The band, not the card, is what separates one class of evidence from another
 * — hero from supporting from context. Cards inside it stay on their own
 * surface so a chart is never drawn on a gradient.
 */
function Band({ accent, eyebrow, title, note, children }) {
  const [ref, revealed] = useReveal();

  return (
    <section
      ref={ref}
      className={`relative -mx-4 mt-14 overflow-hidden rounded-3xl border border-border-button-default bg-panel/50 px-4 py-10 sm:-mx-6 sm:px-8 sm:py-12 ${revealClass(revealed)}`}
    >
      <p className="eyebrow" style={{ color: accent.hex }}>
        {eyebrow}
      </p>
      <h2 className="mt-3 text-title-1-medium text-text-primary">{title}</h2>
      {note && (
        <p className="prose-measure mt-2 text-body-regular text-text-tertiary">{note}</p>
      )}
      <div className="mt-6 flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * Previous and next question under the same lens.
 *
 * The lens orders its questions deliberately, and a reader who finishes one
 * should be able to take the next step without going back up and finding their
 * place again.
 */
function QuestionNav({ prev, next, lens }) {
  if (!prev && !next) return null;

  return (
    <nav
      className="mt-16 grid gap-3 border-t border-border-button-default pt-8 sm:grid-cols-2"
      aria-label={`Other questions under ${lens.lens_name}`}
    >
      {prev ? (
        <Link
          to={`/q/${prev.slug}`}
          className="group flex flex-col rounded-2xl border border-border-button-default bg-panel p-5 tint hover:bg-raised"
        >
          <span className="flex items-center gap-1.5 text-caption-1-regular text-text-tertiary">
            <RiArrowLeftLine
              className="size-3.5 transition-transform group-hover:-translate-x-0.5"
              aria-hidden
            />
            Before this
          </span>
          <span className="mt-1 text-title-3-medium text-text-primary">{prev.question}</span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          to={`/q/${next.slug}`}
          className="group flex flex-col items-end rounded-2xl border border-border-button-default bg-panel p-5 text-right tint hover:bg-raised sm:col-start-2"
        >
          <span className="flex items-center gap-1.5 text-caption-1-regular text-text-tertiary">
            Next
            <RiArrowRightLine
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
          <span className="mt-1 text-title-3-medium text-text-primary">{next.question}</span>
        </Link>
      )}
    </nav>
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
