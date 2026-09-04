import { createContext, Suspense, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import TopNav from './TopNav';
import { LoadingBlock } from '@/components/Page';
import ErrorBoundary from '@/components/ErrorBoundary';

/**
 * The frame every page sits in.
 *
 * WHAT CHANGED AND WHY
 *
 * This used to hold a fixed 232px rail, a mobile bottom tab bar, and a sticky
 * header that rendered the page's own title. All three were dashboard
 * conventions on a site that is a publication, and together they meant a reader
 * arriving at an article met a control surface before they met any writing.
 *
 * The rail and the tab bar are gone, replaced by `TopNav`. Two consequences
 * had to be handled rather than inherited:
 *
 *   1. The shell no longer prints the page title. It only sets document.title.
 *      Every route already rendered its own <h1>, so the old header was
 *      printing the same string twice on lens, question, data and indicator
 *      pages. Three routes had no <h1> of their own and relied on the header
 *      entirely; those now carry one.
 *
 *   2. The reading-mode control lived only in that header, and moved here into
 *      a slim strip above the content. It has since been deleted: it was wired
 *      to nothing in two independent ways and had never once switched a
 *      register. See the note at the top of lib/preferences.jsx. `<main>`
 *      carries the padding that strip used to contribute.
 *
 * The theme toggle is not rehomed. There is one theme.
 */
const PageTitleContext = createContext(null);

export function usePageTitle(title, subtitle) {
  const ctx = useContext(PageTitleContext);
  useEffect(() => {
    ctx?.set({ title, subtitle });
  }, [ctx, title, subtitle]);
}

export default function AppShell() {
  const [heading, setHeading] = useState({ title: 'Diffusion', subtitle: '' });
  const ctx = useMemo(() => ({ set: setHeading }), []);
  const { pathname } = useLocation();

  // The browser tab should say where the reader is, not just what the site is —
  // except on the overview, whose title IS the site name and would otherwise
  // render as "Diffusion — Diffusion".
  useEffect(() => {
    document.title =
      !heading.title || heading.title === 'Diffusion'
        ? 'Diffusion — Is AI changing the economy?'
        : `${heading.title} — Diffusion`;
  }, [heading.title]);

  return (
    <PageTitleContext.Provider value={ctx}>
      <div className="min-h-dvh bg-page">
        <TopNav />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* `pt-6` replaces the 12px the reading-mode strip used to contribute
              above this. Deleting that row without adjusting here pulled every
              page up against the fixed nav's spacer. */}
          <main id="main" tabIndex={-1} className="pb-24 pt-6">
            {/* Suspense sits HERE, inside the chrome, not around the router.
                Route components are lazy-loaded, and a boundary above this
                point would unmount the nav for the fraction of a second a
                chunk takes to arrive — the header would blink on every first
                visit to a section, which reads as the page reloading.

                The ErrorBoundary sits at the same level and for the same
                reason: a render throw inside a chart used to unmount the whole
                tree and leave a blank white document with no message and no
                way back. Inside the chrome, the reader keeps the nav and the
                footer and is told what happened. `resetKey` is the pathname,
                so navigating away from a page that threw clears the state
                rather than carrying the failure panel onto a healthy page. */}
            <ErrorBoundary resetKey={pathname}>
              <Suspense fallback={<LoadingBlock rows={4} />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>

          <SiteFooter />
        </div>
      </div>
    </PageTitleContext.Provider>
  );
}

/**
 * The exit from every app page, and the route to the privacy policy.
 *
 * There was no footer anywhere in the React app, so all ten routes ended at
 * their last content block. That is a dead end on every page, and on /login it
 * is worse than that: /login asks for a name and an email address, lists four
 * privacy promises inline, and carried no link to the policy those promises
 * are a summary of — a policy that exists, is good, and was reachable only
 * from the landing page's footer.
 *
 * The links match the landing page's footer, including the copyright line
 * verbatim, because a reader crossing the seam should not find two different
 * accounts of who owns what. Plain <a>, not <Link>: /legal/* is static HTML
 * served outside this router, exactly like the wordmark's link to /.
 */
const FOOTER_LINKS = [
  { href: '/legal/privacy-policy', label: 'Privacy Policy' },
  { href: '/legal/terms-of-service', label: 'Terms of Service' },
  { href: 'https://github.com/joshuakhalili/EconIntel', label: 'Source on GitHub', external: true },
  {
    href: 'https://www.linkedin.com/in/joshuakhalili/',
    label: 'Contact',
    external: true,
  },
];

function SiteFooter() {
  // No top margin of its own: `main` already carries pb-24, which used to be
  // the page's bottom gutter and is now the gap above this rule.
  return (
    <footer className="border-t border-border-button-default pb-12 pt-6">
      <nav aria-label="Legal and source" className="flex flex-wrap gap-x-5 gap-y-2">
        {FOOTER_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            {...(link.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
            className="tint text-caption-1-regular text-text-tertiary hover:text-text-primary"
          >
            {link.label}
          </a>
        ))}
      </nav>
      <p className="mt-4 text-caption-1-regular text-text-tertiary">
        © 2026 Diffusion. Code is MIT. Data belongs to its publishers.
      </p>
    </footer>
  );
}

