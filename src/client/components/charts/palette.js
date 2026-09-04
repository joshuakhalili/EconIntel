import { useEffect, useState } from 'react';
import { SERIES_COLORS } from '@/lib/format';

/*
 * The twelve chart honesty behaviours this project treats as non-negotiable
 * are written down once, next to this file, in HONESTY.md. The one that lives
 * here is the last: no chart draws more series than there are validated hues.
 *
 * The palette itself is enforced by `npm run check:contrast`, which derives
 * its list from SERIES_COLORS and asserts both the count and the exact hex of
 * every step — so adding a seventh hue, or swapping two, turns the build red.
 */

/**
 * Resolve the categorical palette to real hex values.
 *
 * SVG stroke attributes accept var(), but Recharts also uses the colour for
 * legend swatches, tooltip dots and active points, and reads it back in places
 * where a var() string is not usable. So the variables are resolved once here.
 *
 * The values differ between light and dark — dark has its own validated steps
 * rather than a flip — so this re-resolves when the theme class changes.
 */
export function useSeriesPalette() {
  const [palette, setPalette] = useState(readPalette);

  useEffect(() => {
    const observer = new MutationObserver(() => setPalette(readPalette()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  return palette;
}

function readPalette() {
  if (typeof window === 'undefined') return ['#1F7A4D'];
  const styles = getComputedStyle(document.documentElement);
  return SERIES_COLORS.map((name) => styles.getPropertyValue(name).trim() || '#1F7A4D');
}

/**
 * Colour for a series by its position.
 *
 * Colour follows the entity, never its rank — so this is always called with a
 * series' stable index, not its position after filtering. Hiding series 2 must
 * not repaint series 3.
 *
 * THE MODULO IS A WRAP, AND A WRAP IS A DUPLICATE COLOUR.
 *
 * With six validated hues, series 7 gets series 1's colour and nothing says
 * so — two different countries drawn identically on one axis, with a legend
 * that claims they are distinguishable. That is the failure the CVD-validated
 * fixed hue order exists to prevent, and it is invisible: the chart renders,
 * it just lies about which line is which.
 *
 * The wrap is kept rather than throwing, because a chart that crashes a page
 * is worse than one that repeats a colour. What is NOT kept is the silence —
 * `exceedsPalette` below lets a caller refuse to draw, and `ChartGroup` does.
 */
export function colorAt(palette, index) {
  return palette[index % palette.length];
}

/**
 * Would this many series force a duplicate colour?
 *
 * The honest maximum for a categorical chart is the number of validated hues.
 * Beyond it the answer is a different chart — ranked bars, small multiples, a
 * fold into "other" — not a longer legend.
 */
export function exceedsPalette(count, palette) {
  return count > palette.length;
}
