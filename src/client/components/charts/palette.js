import { useEffect, useState } from 'react';
import { SERIES_COLORS } from '@/lib/format';

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
 */
export function colorAt(palette, index) {
  return palette[index % palette.length];
}
