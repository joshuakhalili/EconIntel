import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';

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
            <Outlet />
          </main>
        </div>
      </div>
    </PageTitleContext.Provider>
  );
}

