import { useReveal, revealClass } from '@/hooks/useReveal';

/**
 * The opening band, shared by the three utility pages.
 *
 * Lens and question pages get a per-lens accent because they belong to an
 * argument. `/data`, `/explore` and `/pipeline` belong to no lens — they are
 * the catalogue, the workbench and the colophon — so they take the site's own
 * `--color-electric` and are otherwise identical to a lens hero: eyebrow,
 * headline, a paragraph saying what the page is for, and an optional row of
 * figures underneath.
 *
 * Extracted rather than copied three times. The previous versions of these
 * pages each opened with a bare `<h1>` on the page background and no eyebrow,
 * which is most of why they read as dashboards sitting next to a publication
 * rather than as part of it.
 */
export default function PageHero({ eyebrow, title, children, figures }) {
  const [ref, revealed] = useReveal();

  return (
    <section
      ref={ref}
      className="relative overflow-hidden rounded-3xl border border-border-button-default"
    >
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          background:
            'radial-gradient(90% 70% at 12% 0%, var(--color-electric), transparent 70%)',
        }}
        aria-hidden
      />
      <div className={`relative p-6 sm:p-10 ${revealClass(revealed)}`}>
        <p className="eyebrow text-signal">{eyebrow}</p>
        <h1 className="mt-3 max-w-2xl text-display-4-medium leading-tight text-text-primary">
          {title}
        </h1>
        {children && (
          <div className="prose-measure mt-4 text-headline-regular leading-relaxed text-text-secondary">
            {children}
          </div>
        )}

        {figures && figures.length > 0 && (
          <dl className="stagger mt-8 flex flex-wrap gap-x-10 gap-y-4">
            {figures.map(([label, value], i) => (
              <div key={label} style={{ '--i': i }}>
                <dt className="text-caption-1-regular text-text-tertiary">{label}</dt>
                {/* Exact rather than abbreviated. `fmt` shortens above 10,000,
                    which is right on a chart axis and wrong here — a page
                    describing the size of the catalogue is the one place a
                    rounded figure undercuts what it is saying. */}
                <dd className="figure mt-1 text-title-1-medium text-text-primary">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
