/**
 * A colour per lens, refracted out of the brand blue.
 *
 * A lens splits light; these are five positions in that split, walking from the
 * deep blue the landing page opens on through to indigo. They carry the idea
 * that you are looking at one subject five ways rather than visiting five
 * unrelated sections.
 *
 * CHROME ONLY. These appear on eyebrow labels, hairlines, hero tints and the
 * active nav state. They must never be used to draw a data series.
 *
 * The reason is not taste. The six chart hues in `charts.css` are validated for
 * colourblind separation AND their ORDER is fixed — the file records that
 * putting green adjacent to orange drops protanopia separation to ΔE 5.9, under
 * the floor. A lens tint leaking into a chart would sit outside that validation
 * and silently break it for the readers least able to report it.
 *
 * `glow` is the same hue at low alpha, for the radial wash behind a hero. Kept
 * as a literal rather than derived at runtime so it can be read here and
 * checked against the surface it sits on.
 */
export const LENS_ACCENT = {
  // Money and materials — the deepest blue, closest to the landing page.
  investment: { hex: '#7da0ff', glow: 'rgba(47, 97, 247, 0.35)' },

  // Output. Cyan, the lightest end of the display gradient.
  growth: { hex: '#7be2fe', glow: 'rgba(123, 226, 254, 0.22)' },

  // People. Green-cyan — the only lens where every question is contested, and
  // it sits at the point in the spectrum where the eye is most sensitive.
  labour: { hex: '#6ee7c0', glow: 'rgba(110, 231, 192, 0.20)' },

  // Markets. Violet, the far side of the split.
  prices: { hex: '#b39cff', glow: 'rgba(179, 156, 255, 0.24)' },

  // The state. Indigo, furthest from the source.
  regulation: { hex: '#8f8cff', glow: 'rgba(143, 140, 255, 0.24)' },

  default: { hex: '#7da0ff', glow: 'rgba(47, 97, 247, 0.30)' },
};
