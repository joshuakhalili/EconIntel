import { useCallback, useEffect, useState } from 'react';

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
 * THE REF IS A CALLBACK, AND THAT IS LOAD-BEARING
 *
 * It was `useRef` until 2026-08-30, and that version had a bug that hides
 * content permanently and silently.
 *
 * `useEffect` runs once, reads `ref.current`, and returns early when it is
 * null. Its dependency is `[revealed]`, which does not change when a ref
 * attaches — so if the element is not in the DOM on that first run, no
 * observer is ever created and the section stays at `opacity-0` for the life
 * of the page. No error, no warning; the content is in the DOM, screen readers
 * read it, and it is invisible.
 *
 * Which is not a rare shape. Any component that returns `null` while its data
 * loads hits it, because hooks must be called before that early return. The
 * financing band on the Investment lens did exactly that and rendered a
 * 1,984-pixel void.
 *
 * A callback ref runs when the node actually attaches — and again with null
 * when it detaches — so the observer is created at the right moment however
 * late that is. `useCallback` with no dependencies keeps its identity stable,
 * or React would call it with null and then the node on every single render.
 *
 * @param {object} [options]
 * @param {boolean} [options.immediate] Reveal without waiting to intersect.
 *   For anything above the fold: the landing page animates its hero on load
 *   and nothing else, and a section that is already on screen at mount should
 *   not fade in underneath the reader.
 */
export function useReveal({ immediate = false } = {}) {
  const [node, setNode] = useState(null);
  const [revealed, setRevealed] = useState(immediate);

  const ref = useCallback((element) => setNode(element), []);

  useEffect(() => {
    if (revealed) return undefined;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reduce || typeof IntersectionObserver === 'undefined') {
      setRevealed(true);
      return undefined;
    }

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
  }, [revealed, node]);

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
