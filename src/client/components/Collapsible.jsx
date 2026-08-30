import { useState } from 'react';
import { RiAddLine, RiSubtractLine } from '@remixicon/react';

/**
 * Show the first few, then offer the rest.
 *
 * A hook and a button rather than a wrapper component, because the two lists
 * that use it look nothing alike: the news feed is a bento grid with per-index
 * span classes, the literature is a plain stack with a trailing disclaimer. A
 * wrapper owning the container would have to know both. The hook owns HOW MANY;
 * the caller owns how they look.
 *
 * WHY SIX
 *
 * `NewsList` lays out on 2 columns at `sm` and 3 at `xl`, and 6 is the lowest
 * common multiple — so six items fill exactly, at every width, with no ragged
 * last row and no extra CSS. Five leaves a hole at `sm`; seven leaves one at
 * both.
 *
 * THE INVARIANT: the step must equal the layout's period. Change the grid and
 * this number changes with it, or the ragged row comes back.
 *
 * No height animation. A `max-height` transition over unknown content is the
 * classic broken-accordion bug — it either clips the last line or leaves a gap
 * — and appending below the fold needs no choreography at all: the new items
 * mount and their own `.rise-sm` entrance does the work.
 */
export function useCollapse(items = [], { initial = 6, step = 6 } = {}) {
  const [limit, setLimit] = useState(initial);

  const visible = items.slice(0, limit);
  const hiddenCount = Math.max(0, items.length - limit);
  const expanded = hiddenCount === 0;

  return {
    visible,
    hiddenCount,
    expanded,
    /* Where the last batch started, so a newly revealed run staggers from zero
       rather than continuing a tail that is already six items long. */
    firstNewIndex: Math.max(0, limit - step),
    expand: () => setLimit((n) => n + step),
    collapse: () => setLimit(initial),
  };
}

/**
 * The control under a collapsed list.
 *
 * Renders nothing when there is nothing to reveal AND nothing revealed — a
 * list of four articles should not carry a disabled button.
 */
export function SeeMore({ hiddenCount, expanded, onExpand, onCollapse, label = 'more', onCollapseScrollTo }) {
  if (hiddenCount === 0 && !expanded) return null;
  if (hiddenCount === 0 && expanded === false) return null;

  const showCollapse = hiddenCount === 0;

  function handleCollapse() {
    onCollapse();
    /* Without this the reader is stranded a thousand pixels below content that
       no longer exists. `nearest` rather than `start` so a section already in
       view does not jump. */
    onCollapseScrollTo?.current?.scrollIntoView({ block: 'nearest' });
  }

  return (
    <div className="mt-4 flex justify-center">
      <button
        type="button"
        onClick={showCollapse ? handleCollapse : onExpand}
        className="tint inline-flex items-center gap-2 rounded-full border border-border-button-default px-4 py-2 text-caption-1-medium text-text-secondary hover:border-white/25 hover:text-text-primary"
      >
        {showCollapse ? (
          <>
            <RiSubtractLine className="size-4" aria-hidden />
            Show fewer
          </>
        ) : (
          <>
            <RiAddLine className="size-4" aria-hidden />
            {hiddenCount} {label}
          </>
        )}
      </button>
    </div>
  );
}
