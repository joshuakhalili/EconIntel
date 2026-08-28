import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { RiRefreshLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import Rail from './Rail';
import MobileNav from './MobileNav';

/**
 * Page heading state.
 *
 * The title belongs to the page but is rendered in the shared topbar, so each
 * route reports its own via usePageTitle(). This replaces writing directly into
 * the heading element from the router, which the previous front end did.
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
  const queryClient = useQueryClient();

  const ctx = useMemo(() => ({ set: setHeading }), []);

  // The browser tab should say where the reader is, not just what the site is.
  useEffect(() => {
    document.title = heading.title
      ? `${heading.title} — Diffusion`
      : 'Diffusion — Is AI changing the economy?';
  }, [heading.title]);

  return (
    <PageTitleContext.Provider value={ctx}>
      <Rail />

      {/* The rail is fixed, so the content column is inset by its width rather
          than sitting in a grid — that keeps the main region scrolling on its
          own without the rail moving.

          The inset reads the variable directly: Tailwind's --width-* namespace
          generates w-*, but padding comes from the spacing scale, so a pl-rail
          class does not exist and silently collapses to nothing — which puts
          the content underneath the rail. */}
      <div className="min-h-screen lg:pl-[var(--width-rail)]">
        <header className="sticky top-0 z-20 flex items-start justify-between gap-4 border-b border-border-button-default bg-background-primary-default/85 px-4 py-3 backdrop-blur-sm sm:px-6">
          <div className="min-w-0">
            <h1 className="truncate text-title-2-medium text-text-primary">{heading.title}</h1>
            {heading.subtitle && (
              <p className="mt-0.5 truncate text-body-regular text-text-tertiary">
                {heading.subtitle}
              </p>
            )}
          </div>

          <Button
            variant="secondary"
            size="small"
            leadingIcon={RiRefreshLine}
            onClick={() => queryClient.invalidateQueries()}
          >
            Refresh
          </Button>
        </header>

        {/* Bottom padding clears the mobile tab bar, which is fixed over the
            content on small screens. */}
        <main id="main" tabIndex={-1} className="px-4 pt-5 pb-28 sm:px-6 lg:pb-10">
          <Outlet />
        </main>
      </div>

      <MobileNav />
    </PageTitleContext.Provider>
  );
}
