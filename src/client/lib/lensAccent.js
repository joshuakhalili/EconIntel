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
 * `glow` is the same hue at low alpha, for the radial wash behind a hero.
 * `ring` is the same hue again, for the border of a FILLED card. Both are
 * literals rather than derived at runtime so they can be read here and checked
 * against the surface they sit on.
 *
 * WHY A RING AND NOT A FILL
 *
 * The obvious way to make a question card carry its lens is to paint it in the
 * lens hue. It cannot be done. White text on these five measures 2.52, 1.48,
 * 1.52, 2.30 and 2.85 to one — every one of them unreadable, three of them
 * badly. The repair that suggests itself is to darken each hue until white
 * works, and that is worse: darkening `growth` to the electric blue's
 * luminance lands it 0.073 from `--c5` in OKLab and `labour` 0.057 from `--c1`
 * — the chart cyan and the chart green, indistinguishable, arriving through
 * the back door at exactly the readers this comment exists to protect.
 *
 * So every filled card is the electric blue with white text, and the lens hue
 * moves to the border, where it sits against the near-black page and measures
 * 7.3 to 14.1 to one. The identity survives; the collision does not happen.
 */
export const LENS_ACCENT = {
  // Money and materials — the deepest blue, closest to the landing page.
  investment: { hex: '#7da0ff', glow: 'rgba(47, 97, 247, 0.35)', ring: 'rgba(125, 160, 255, 0.45)' },

  // Output. Cyan, the lightest end of the display gradient.
  growth: { hex: '#7be2fe', glow: 'rgba(123, 226, 254, 0.22)', ring: 'rgba(123, 226, 254, 0.45)' },

  // People. Green-cyan — the only lens where every question is contested, and
  // it sits at the point in the spectrum where the eye is most sensitive.
  labour: { hex: '#6ee7c0', glow: 'rgba(110, 231, 192, 0.20)', ring: 'rgba(110, 231, 192, 0.45)' },

  // Markets. Violet, the far side of the split.
  prices: { hex: '#b39cff', glow: 'rgba(179, 156, 255, 0.24)', ring: 'rgba(179, 156, 255, 0.45)' },

  // The state. Indigo, furthest from the source.
  regulation: { hex: '#8f8cff', glow: 'rgba(143, 140, 255, 0.24)', ring: 'rgba(143, 140, 255, 0.45)' },

  default: { hex: '#7da0ff', glow: 'rgba(47, 97, 247, 0.30)', ring: 'rgba(125, 160, 255, 0.45)' },
};

/**
 * The one fill every card and sheet uses, and its hover state.
 *
 * Hover DEEPENS rather than brightens. Brightening drops white text to 4.08:1;
 * deepening raises it to 5.77:1, so the card gets more legible under the
 * cursor rather than less. That is the opposite of the usual trade and it is
 * the reason both hexes are checked by `scripts/check-contrast.js`.
 */
export const FILL = '#2f61f7';
export const FILL_HOVER = '#2b59e3';
