import { Link, useLocation } from 'react-router-dom';
import { RiArrowRightUpLine } from '@remixicon/react';
import { useLenses } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LENS_ACCENT } from '@/lib/lensAccent';

/**
 * The page for an address that is not a page.
 *
 * WHAT THIS REPLACES, AND WHY IT WAS WORSE THAN AN ERROR
 *
 * The router's catch-all was `<Navigate to="/" replace />`, whose index route
 * is the overview. So a mistyped or truncated link did not fail — it silently
 * rendered the home page and rewrote the URL underneath the reader. Someone
 * sent `/q/entry-leve` arrived at a page that looked entirely correct and
 * concluded the link they had been sent was wrong about the CONTENT rather
 * than about the ADDRESS. There is no way back from that mistake, because
 * nothing ever told them one had been made.
 *
 * So: say what was not found, say it in the reader's terms, and offer the
 * three things that are actually next — the lens the link probably belonged
 * to, the catalogue, and the front page.
 *
 * THE LENS LIST HAS A FALLBACK ON PURPOSE
 *
 * `/api/lenses` sits behind the sign-in gate, and the most likely visitor to
 * this page is someone following a link who has no session yet. A 404 page
 * that renders nothing until it has been authenticated is a second dead end
 * behind the first, so the five lenses are also written here. They were read
 * out of `lenses` on 2026-09-04 and they are the site's own top-level
 * structure, which is the slowest-moving thing in the database.
 */
const FALLBACK_LENSES = [
  { slug: 'investment', name: 'Investment & Capital', subtitle: 'What is being spent, and what it buys' },
  { slug: 'growth', name: 'Growth & Productivity', subtitle: 'Whether any of it shows up in output' },
  { slug: 'labour', name: 'Labour Markets', subtitle: 'Jobs, pay and who gets hired' },
  { slug: 'prices', name: 'Prices & Markets', subtitle: 'What it costs, and what markets think' },
  { slug: 'regulation', name: 'Policy & Regulation', subtitle: 'What governments are actually doing' },
];

export default function NotFoundPage() {
  const { pathname, search } = useLocation();
  const { data: lenses } = useLenses();

  usePageTitle('Page not found');

  const list = lenses?.length ? lenses : FALLBACK_LENSES;

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <p className="eyebrow text-signal">Not found</p>
        <h1 className="mt-3 text-display-4-medium leading-tight text-text-primary">
          There is no page at that address
        </h1>

        {/* The address itself, verbatim. A reader who can see what was asked
            for can usually see what went wrong with it — a truncated slug, a
            trailing bracket a mail client swallowed — and nobody can debug a
            link they are not shown. `break-all` because a long slug must wrap
            rather than push the page sideways. */}
        <p className="mt-4 text-body-regular text-text-tertiary">
          Asked for{' '}
          <code className="figure break-all rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-text-secondary">
            {pathname}
            {search}
          </code>
        </p>

        <p className="prose-measure mt-4 text-headline-regular leading-relaxed text-text-secondary">
          Either the address was mistyped, or the page it points at has been
          renamed since the link was made. Nothing here has been deleted to hide
          it; the writing on this site is kept with its corrections attached.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-title-3-medium text-text-primary">The five lenses</h2>
        <p className="mt-1 text-body-regular text-text-tertiary">
          One subject, looked at five ways. Every question lives under one of them.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {list.map((lens) => {
            const accent = LENS_ACCENT[lens.slug] ?? LENS_ACCENT.default;
            return (
              <li key={lens.slug}>
                <Link
                  to={`/lens/${lens.slug}`}
                  className="flex items-baseline gap-3 rounded-2lg border border-border-button-default bg-background-secondary-default p-4 transition-colors hover:bg-white/5"
                  style={{ borderLeftColor: accent.ring, borderLeftWidth: '2px' }}
                >
                  <span className="text-body-medium text-text-primary">{lens.name}</span>
                  <span className="text-body-regular text-text-tertiary">{lens.subtitle}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Link
          to="/data"
          className="inline-flex items-center gap-2 rounded-full border border-border-button-default px-5 py-3 text-caption-1-medium text-text-primary hover:bg-white/5"
        >
          Every series, with its source
          <RiArrowRightUpLine className="size-4" aria-hidden />
        </Link>
        <Link
          to="/overview"
          className="inline-flex items-center gap-2 rounded-full border border-border-button-default px-5 py-3 text-caption-1-medium text-text-primary hover:bg-white/5"
        >
          Start at the beginning
          <RiArrowRightUpLine className="size-4" aria-hidden />
        </Link>
      </section>
    </div>
  );
}
