import { cx } from '@/utils/cx';
import { colorAt } from './palette';

/*
 * The thirteen chart honesty behaviours this project treats as non-negotiable
 * are written down once, next to this file, in HONESTY.md. The one this
 * component IS: a legend is always present at two or more series, so identity
 * never rests on colour alone. Read it before changing anything.
 */

/**
 * Legend with per-series visibility.
 *
 * Present whenever there is more than one series, so identity never rests on
 * colour alone — a reader who cannot separate two hues can still read the
 * label, and can switch one off to see the other on its own.
 */
export default function SeriesLegend({ series, palette, hidden, onToggle }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {series.map((s, index) => {
        const isHidden = hidden.has(s.label);
        return (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => onToggle(s.label)}
              aria-pressed={!isHidden}
              className={cx(
                'flex min-h-8 items-center gap-2 rounded-md px-1 text-body-regular transition-opacity',
                isHidden ? 'opacity-40' : 'opacity-100'
              )}
            >
              <span
                className="h-0.5 w-4 shrink-0 rounded-full"
                style={{ background: colorAt(palette, index) }}
                aria-hidden
              />
              <span className={cx('text-text-secondary', isHidden && 'line-through')}>
                {s.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
