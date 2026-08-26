import { useEffect, useState } from 'react';
import { RiMenuLine, RiCloseLine } from '@remixicon/react';
import { NavLink } from 'react-router-dom';
import { cx } from '@/utils/cx';
import { useLenses } from '@/hooks/queries';
import { RailContents } from './Rail';

/**
 * Small-screen navigation: the first few lenses as a bottom tab bar, with
 * everything that does not fit behind a "More" sheet.
 *
 * A bottom bar rather than a top one because the rail's row targets are out of
 * thumb reach on a phone, and because the tab bar is the only nav visible while
 * reading. Every target here is at least 44px.
 */
export default function MobileNav() {
  const { data: lenses } = useLenses();
  const [sheetOpen, setSheetOpen] = useState(false);

  // A sheet that stays open behind a page change looks like the navigation
  // failed. Close it on Escape; route changes close it via onNavigate.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setSheetOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [sheetOpen]);

  // The body must not scroll behind an open sheet.
  useEffect(() => {
    if (!sheetOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen]);

  const tabs = (lenses ?? []).slice(0, 4);

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border-secondary bg-background-secondary-default pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Sections"
      >
        {tabs.map((lens) => (
          <NavLink
            key={lens.slug}
            to={`/lens/${lens.slug}`}
            className={({ isActive }) =>
              cx(
                'flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-caption-medium',
                isActive ? 'text-accent-600' : 'text-text-tertiary'
              )
            }
          >
            <span className="truncate">{lens.title ?? lens.name ?? lens.slug}</span>
          </NavLink>
        ))}

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-caption-medium text-text-tertiary"
        >
          <RiMenuLine className="size-5" aria-hidden />
          More
        </button>
      </nav>

      {sheetOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setSheetOpen(false)}
            aria-hidden
          />
          <aside
            className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-y-auto rounded-t-3xl border-t border-border-secondary bg-background-secondary-default p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] lg:hidden"
            aria-label="More"
          >
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close"
                className="grid size-11 place-items-center rounded-2lg text-text-secondary hover:bg-background-secondary-hover"
              >
                <RiCloseLine className="size-5" aria-hidden />
              </button>
            </div>
            {/* Rendered from the same data as the desktop rail rather than
                moved between the two, which is what the previous front end had
                to do to keep one set of listeners alive. */}
            <RailContents onNavigate={() => setSheetOpen(false)} />
          </aside>
        </>
      )}
    </>
  );
}
