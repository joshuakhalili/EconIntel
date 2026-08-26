import { NavLink } from 'react-router-dom';
import { cx } from '@/utils/cx';

/**
 * A single row in the rail or the mobile sheet.
 *
 * The visual treatment — 2lg radius, the accent gradient and nav-selected
 * shadow when current, secondary-hover otherwise — is taken from BoardUI's own
 * dashboard sidebar so this matches the rest of the kit. What differs is that
 * BoardUI's rows are a fixed list written into the component; EconIntel's are
 * editorial data from /api/lenses, so this takes a route and renders whatever
 * it is given.
 */
export default function NavItem({ to, icon: Icon, label, badge, end = false, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        cx(
          'flex items-center justify-between gap-2 overflow-hidden rounded-2lg p-2',
          'transition-colors duration-200',
          // 44px minimum touch target on small screens — a rail row is a
          // primary control and was previously too small to hit on a phone.
          'min-h-11 sm:min-h-0',
          isActive
            ? 'bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected'
            : 'hover:bg-background-secondary-hover'
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="flex min-w-0 items-center gap-2">
            {Icon && (
              <Icon
                className={cx(
                  'size-5 shrink-0',
                  isActive ? 'text-white' : 'text-foreground-icon-secondary'
                )}
                aria-hidden
              />
            )}
            <span
              className={cx(
                'text-body-medium truncate',
                isActive ? 'text-white' : 'text-text-secondary'
              )}
            >
              {label}
            </span>
          </span>
          {badge != null && (
            <span
              className={cx(
                'shrink-0 text-body-regular tabular-nums',
                isActive ? 'text-white/80' : 'text-text-tertiary'
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
