import {
  RiBarChartBoxLine,
  RiNewspaperLine,
  RiFlowChart,
  RiCompass3Line,
  RiSunLine,
  RiMoonLine,
} from '@remixicon/react';
import { Divider } from '@/components/base/divider/divider';
import { useLenses } from '@/hooks/queries';
import { usePreferences } from '@/lib/preferences';
import NavItem from './NavItem';

const TOOLS = [
  { to: '/explore', icon: RiBarChartBoxLine, label: 'Build a chart' },
  { to: '/news', icon: RiNewspaperLine, label: 'News' },
  { to: '/pipeline', icon: RiFlowChart, label: 'Where this comes from' },
];

/**
 * The rail's contents, without the panel around them.
 *
 * Shared by the desktop rail and the mobile sheet. The previous front end moved
 * the same DOM nodes between the two so their listeners kept working and no id
 * appeared twice; React re-renders from data instead, so both places can simply
 * render this.
 */
export function RailContents({ onNavigate }) {
  const { data: lenses, isPending, isError } = useLenses();
  const { theme, toggleTheme } = usePreferences();

  return (
    <>
      <div className="flex items-center gap-2 px-2 py-1">
        <span
          className="grid size-7 place-items-center rounded-lg bg-linear-to-b from-accent-500 to-accent-600 text-[11px] font-semibold text-white"
          aria-hidden
        >
          D
        </span>
        <span className="text-body-medium text-text-primary">Diffusion</span>
      </div>

      {/* The way back to the argument as a whole. Without it, a reader who
          follows a lens link has no route back to the orientation the overview
          gives except the browser's back button. */}
      <nav className="mt-4 flex flex-col gap-0.5" aria-label="Overview">
        <NavItem to="/" end icon={RiCompass3Line} label="Overview" onClick={onNavigate} />
      </nav>

      <nav className="mt-3 flex flex-col gap-0.5" aria-label="Lenses">
        <p className="px-2 pb-1 text-caption-1-medium uppercase tracking-wide text-text-tertiary">
          Lenses
        </p>

        {/* The pages a reader can visit are editorial data, not a hard-coded
            list, so the nav is built from /api/lenses. */}
        {isPending &&
          [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="mx-2 my-1 h-6 animate-pulse rounded-md bg-background-tertiary-default" />
          ))}

        {isError && (
          <p className="px-2 py-1 text-body-regular text-text-tertiary">Nav unavailable.</p>
        )}

        {lenses?.map((lens) => (
          <NavItem
            key={lens.slug}
            to={`/lens/${lens.slug}`}
            label={lens.title ?? lens.name ?? lens.slug}
            badge={lens.question_count ?? undefined}
            onClick={onNavigate}
          />
        ))}
      </nav>

      <Divider className="my-3" />

      <nav className="flex flex-col gap-0.5" aria-label="Tools">
        <p className="px-2 pb-1 text-caption-1-medium uppercase tracking-wide text-text-tertiary">
          Tools
        </p>
        {TOOLS.map((tool) => (
          <NavItem key={tool.to} {...tool} onClick={onNavigate} />
        ))}
      </nav>

      {/* Reading level used to live here, at the bottom of the rail below the
          fold. It changes the register of every claim on the site, which makes
          it a property of what you are reading rather than a setting — so it
          now sits in the page header beside the title. */}
      <div className="mt-auto flex flex-col gap-3 pt-4">
        <button
          type="button"
          onClick={toggleTheme}
          className="flex min-h-11 items-center gap-2 rounded-2lg p-2 text-body-medium text-text-secondary transition-colors hover:bg-background-secondary-hover sm:min-h-0"
        >
          {theme === 'dark' ? (
            <RiSunLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
          ) : (
            <RiMoonLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
          )}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </div>
    </>
  );
}

/** The desktop rail: a fixed-width floating panel, hidden on small screens. */
export default function Rail() {
  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-rail flex-col overflow-y-auto border-r border-border-button-default bg-background-secondary-default p-3 lg:flex"
      aria-label="Sections"
    >
      <RailContents />
    </aside>
  );
}
