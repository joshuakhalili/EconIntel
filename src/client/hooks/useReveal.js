import { useEffect, useRef, useState } from 'react';

/**
 * Reveal a section the first time it comes into view.
 *
 *     const [ref, revealed] = useReveal();
 *     <section ref={ref} className={revealed ? 'rise' : 'opacity-0'}>
 *
 * WHY A HOOK AND NOT A CSS-ONLY TRICK
 *
 * `animation-timeline: view()` does this in pure CSS and would be the right
 * answer on an internal tool. Safari does not support it, and this is a public
 * site whose readers are economists and students on whatever they have.
 *
 * THE ENTRANCE FIRES ONCE, EVER
 *
 * `unobserve` on first intersection. A section that re-animates every time you
 * scroll back up is the single most common way this effect goes wrong: it
 * turns re-reading a paragraph into watching it arrive again, and on a long
 * article page a reader crosses the same boundary many times.
 *
 * REDUCED MOTION IS HANDLED HERE AND NOWHERE ELSE
 *
 * If the reader has asked for less motion, this returns revealed immediately
 * and never constructs an observer at all — so the content is simply present,
 * with no animation to suppress and no work done. No component calls
 * `matchMedia` itself.
 *
 * The one deliberate exception in the codebase is `TickerStrip.nudge`, which
 * reads the preference imperatively per call because it is choosing between
 * `behavior: 'auto'` and `'smooth'` on a scroll the READER initiated. That is
 * a different question from "should this animate in", and it stays as it is.
 *
 * @param {object} [options]
 * @param {boolean} [options.immediate] Reveal without waiting to intersect.
 *   For anything above the fold: the landing page animates its hero on load
 *   and nothing else, and a section that is already on screen at mount should
 *   not fade in underneath the reader.
 */
export function useReveal({ immediate = false } = {}) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(immediate);

  useEffect(() => {
    if (revealed) return undefined;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return undefined;
    }

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setRevealed(true);
        observer.unobserve(entry.target);
      },
      // Slightly inside the viewport, so a section starts arriving as it
      // enters rather than after the reader is already looking at it.
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [revealed]);

  return [ref, revealed];
}

/**
 * The class pair a revealing section wants, so call sites do not each spell it
 * out and drift.
 *
 * `opacity-0` rather than `invisible` or `hidden`: the element must keep its
 * layout box or the page reflows as each section arrives, and anything that
 * removes it from the accessibility tree would hide unread content from a
 * screen reader that is not scrolling at all.
 */
export function revealClass(revealed, variant = 'rise') {
  return revealed ? variant : 'opacity-0';
}
