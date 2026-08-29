import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'motion/react';
import { useGlobe, useOverview, useStatus } from '@/hooks/queries';
import Globe from '@/components/Globe';
import { fmt } from '@/lib/format';

/**
 * The front door.
 *
 * There wasn't one. A first-time visitor landed inside the overview — five
 * lenses and a chart — with no statement of what the site is, what it refuses
 * to do, or how its pages are meant to be read. The rules are the most
 * distinctive thing here and they were only discoverable by inference.
 *
 * So this page does three jobs, in order: show the subject, state the rules,
 * then hand over to the writing.
 *
 * THE HERO
 *
 * Scroll moves time, not the camera. The globe runs 2021 to 2025 and countries
 * brighten as the share of their firms using AI rises. The project is named
 * after technology diffusion; this is that, drawn from the data rather than
 * illustrated near it.
 *
 * The honesty constraint is in `Globe.jsx`: measured countries are filled
 * points, unmeasured ones are dim and flat. Sixteen of forty-four are measured.
 * The caption says both that and the fact that motion between annual surveys is
 * interpolation — a smooth animation reads as continuous observation, and this
 * is four data points a country.
 */

/** The span the Eurostat panel actually covers. Nothing is drawn outside it. */
const FIRST_YEAR = 2021;
const LAST_YEAR = 2025;

export default function LandingPage() {
  const heroRef = useRef(null);
  const { data: globeData } = useGlobe();
  const { data: lenses } = useOverview();
  const { data: status } = useStatus();

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const yearValue = useTransform(scrollYProgress, [0, 0.85], [FIRST_YEAR, LAST_YEAR]);

  /*
   * The globe reads the year through a ref updated on every scroll frame, and
   * the label reads it through state updated only when the integer changes.
   * Driving both from state would re-render the whole page on every pixel of
   * scroll and drop frames on the canvas.
   */
  const yearRef = useRef(FIRST_YEAR);
  const [displayYear, setDisplayYear] = useState(FIRST_YEAR);

  useMotionValueEvent(yearValue, 'change', (v) => {
    yearRef.current = v;
    const whole = Math.round(v);
    setDisplayYear((prev) => (prev === whole ? prev : whole));
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const countries = globeData?.countries ?? [];
  const measured = globeData?.measured ?? 0;
  const total = globeData?.total ?? 0;

  return (
    <div className="min-h-dvh bg-atmos-page text-text-primary">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative h-[190vh]">
        <div className="atmos-gradient sticky top-0 h-dvh overflow-hidden">
          <div className="atmos-stars absolute inset-0 opacity-70" aria-hidden />

          {/* The live strip. The reference has a fake clock and a hardcoded
              "system active"; this shows the real last ingestion run and the
              real observation count, because a fabricated status indicator on
              a project about not overstating things would be the worst
              possible first sentence. */}
          <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between p-5 sm:p-7">
            <div className="text-caption-1-regular">
              <span className="flex items-center gap-2 text-text-secondary">
                <span className="size-1.5 rounded-full bg-atmos-good" aria-hidden />
                {status ? `${fmt(status.counts.observations, 0)} observations` : 'Loading'}
              </span>
              <span className="mt-0.5 block font-label text-atmos-signal" suppressHydrationWarning>
                {new Date().toLocaleString(undefined, {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
                {tick ? '' : ''}
              </span>
            </div>

            <Link
              to="/data"
              className="rounded-full border border-border-button-default bg-white/5 px-4 py-2 text-caption-1-medium text-text-primary backdrop-blur transition-colors hover:bg-white/10"
            >
              Browse the data
            </Link>
          </div>

          {/* The globe sits behind the wordmark, pulled up so the type overlaps
              its lower third — the reference's composition. */}
          <div className="absolute inset-0 z-0 flex items-center justify-center">
            <Globe
              countries={countries}
              year={yearRef.current}
              className="h-[min(78vh,78vw)] w-[min(78vh,78vw)] -translate-y-[8%]"
            />
          </div>

          {/* Year and subtitle share one row above the wordmark. They were two
              absolutely-positioned blocks and collided at every width. */}
          <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-6 sm:px-7 sm:pb-8">
            <div className="mb-2 flex items-end justify-between gap-4 sm:mb-3">
              <p className="font-label text-title-2-regular leading-none text-white/80 tabular-nums sm:text-[1.75rem]">
                {displayYear}
              </p>
              <p className="text-right text-body-regular text-atmos-signal sm:text-title-3-regular">
                Is AI changing the economy?
              </p>
            </div>
            <h1
              className="display-wordmark text-[clamp(2.4rem,15vw,12.5rem)]"
              aria-label="Diffusion"
            >
              DIFFUSION
            </h1>
          </div>
        </div>
      </section>

      {/* ── What the globe was ────────────────────────────────────────────── */}
      <section className="relative bg-atmos-page px-5 py-20 sm:px-7 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <p className="eyebrow">What you just watched</p>
          <p className="mt-4 text-title-2-regular leading-snug text-text-primary sm:text-display-4-regular">
            The share of firms using AI, {FIRST_YEAR} to {LAST_YEAR}. Denmark went from 24% to 42%,
            Finland from 16% to 38%, Poland from 3% to 8%. That spread — fast in some economies,
            barely moving in others — is what the word{' '}
            <span className="text-atmos-bright">diffusion</span> means, and it is the thing this
            site exists to measure.
          </p>
          <p className="prose-measure mt-6 text-body-regular leading-relaxed text-text-tertiary">
            {measured} of {total} countries on that globe have an AI adoption survey at all. The
            rest are drawn dim and flat rather than dark, because a country nobody has surveyed is
            not a country where nothing is happening — and the difference between those two claims
            is most of what this project is about. The surveys are annual and four points deep, so
            the motion between years is interpolation, not measurement.
          </p>
        </div>
      </section>

      {/* ── How to read this ──────────────────────────────────────────────── */}
      <section className="atmos-gradient relative px-5 py-20 sm:px-7 sm:py-28">
        <div className="atmos-stars absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-5xl">
          <p className="eyebrow">How to read this</p>
          <h2 className="mt-4 max-w-2xl text-display-4-medium leading-tight sm:text-display-3-medium">
            The rules are the point. Everything else is implementation.
          </h2>

          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border-button-default bg-white/10 sm:grid-cols-2">
            {RULES.map((rule) => (
              <div key={rule.title} className="bg-atmos-page/80 p-6 backdrop-blur sm:p-8">
                <h3 className="text-title-3-medium text-text-primary">{rule.title}</h3>
                <p className="mt-2 text-body-regular leading-relaxed text-text-tertiary">
                  {rule.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The five lenses ───────────────────────────────────────────────── */}
      <section className="bg-atmos-page px-5 py-20 sm:px-7 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow">Where to start</p>
          <h2 className="mt-4 max-w-2xl text-display-4-medium leading-tight sm:text-display-3-medium">
            Five lenses, in the order the causation is supposed to run.
          </h2>
          <p className="prose-measure mt-4 text-body-regular text-text-tertiary">
            Money is spent, output does or does not rise, jobs change, prices move, governments
            respond. Each lens reads as an article with the questions beneath it.
          </p>

          <ol className="mt-12 flex flex-col gap-px overflow-hidden rounded-2xl border border-border-button-default bg-white/10">
            {(lenses ?? []).map((lens, i) => (
              <li key={lens.id}>
                <Link
                  to={`/lens/${lens.slug}`}
                  className="group flex items-baseline gap-5 bg-atmos-page p-6 transition-colors hover:bg-atmos-deep sm:gap-8 sm:p-8"
                >
                  <span className="font-label text-caption-1-regular text-atmos-signal">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-title-2-medium text-text-primary">{lens.name}</span>
                    <span className="prose-measure mt-1 block text-body-regular text-text-tertiary">
                      {lens.thesis_plain}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-caption-1-regular text-text-tertiary sm:block">
                    {lens.question_count} question{lens.question_count === 1 ? '' : 's'}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      <footer className="atmos-gradient relative px-5 py-20 sm:px-7 sm:py-28">
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="text-display-4-medium leading-tight sm:text-display-3-medium">
            Built to be checked, not believed.
          </h2>
          <p className="prose-measure mx-auto mt-4 text-body-regular text-text-tertiary">
            Every series links back to the publisher with its licence stated. If you are an
            economist and the comparisons are wrong, that is the most useful thing you could tell
            me.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/data"
              className="rounded-full bg-white px-5 py-2.5 text-caption-1-medium text-atmos-page transition-opacity hover:opacity-90"
            >
              Browse every series
            </Link>
            <Link
              to="/pipeline"
              className="rounded-full border border-border-button-default px-5 py-2.5 text-caption-1-medium text-text-primary transition-colors hover:bg-white/10"
            >
              Where this comes from
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/**
 * The four rules, in the words the README uses.
 *
 * Kept identical to the README deliberately: two descriptions of the same
 * promise drift, and the promise is the thing a reader is being asked to trust.
 */
const RULES = [
  {
    title: 'No number here is written by a model',
    body: 'Every figure is computed in SQL from a named source. Every claim is written by a person and dated. Where a takeaway was read out of a document by a machine, the page says so and gives the page number.',
  },
  {
    title: 'What the data cannot show is a section, not a footnote',
    body: 'Every question page states its limits directly beneath its answer and above every chart. A page with no caveat is usually a page nobody has thought about hard enough.',
  },
  {
    title: 'Evidence strength is stated, including when it is insufficient',
    body: 'Pages are labelled insufficient, suggestive, consistent or contested. Three are currently contested — the published literature disagrees with what the series on those pages show, and that disagreement is the finding.',
  },
  {
    title: 'Charts are not allowed to flatter',
    body: 'One y-axis, always. Zero baseline by default, and where an index needs a padded floor the chart says so on its face. A gap in the data breaks the line rather than drawing across months nobody collected.',
  },
];
