import { useEffect, useRef } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { FILL } from '@/lib/lensAccent';

/**
 * A modal sheet, painted in the fill.
 *
 * WHY THIS IS HAND-ROLLED AND NOT react-aria's Modal
 *
 * It was react-aria first. `ModalOverlay` + `Modal` + `Dialog`, standalone,
 * with `isOpen` — the documented shape. It rendered nothing: no portal, no
 * node appended to body, no `[role=dialog]` anywhere, with `isOpen` provably
 * true. Rather than keep guessing at a library's internals for a component
 * this small, this is fifty lines that demonstrably work.
 *
 * The portal was the only thing react-aria was really wanted for, and it turns
 * out not to be needed: the ticker strip's detail used to render below the
 * whole strip because an in-flow popover would be clipped by its
 * `overflow-x-auto`, but `position: fixed` escapes an overflow ancestor on its
 * own. It is only defeated by an ancestor with a `transform` or `filter`, and
 * there is none between here and the root.
 *
 * What react-aria would have brought and this deliberately reimplements:
 * Escape to close, click-the-scrim to close, focus moved into the sheet on
 * open, focus returned to the trigger on close, and `aria-modal`. What it does
 * NOT reimplement is a full focus trap — tabbing past the last control leaves
 * the sheet. Stated rather than hidden; for a sheet with one link and one
 * close button that is a small cost, and it is the one thing worth revisiting
 * if this grows.
 *
 * ON THE FILL, WHITE IS 5.03:1 AND THAT IS ALL THERE IS
 *
 * No `text-white/70`, no tinted pill backgrounds, no brightening on hover. The
 * measured numbers are in `components/QuestionCard.jsx` and enforced by
 * `scripts/check-contrast.js`.
 */
export default function Sheet({ isOpen, onClose, label, children }) {
  const panelRef = useRef(null);
  const returnFocusTo = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    returnFocusTo.current = document.activeElement;
    // The panel itself, not the first control: a sheet that opens with the
    // close button focused reads as though closing is the suggested action.
    panelRef.current?.focus();

    function onKey(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);

    // The page behind must not scroll under a modal.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      returnFocusTo.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-page/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        /* A bottom sheet that scales looks like a rendering bug, so below `sm`
           it travels instead. */
        className="sheet-up relative w-full overflow-y-auto rounded-t-3xl p-6 outline-none sm:sheet-in sm:max-w-lg sm:rounded-3xl sm:p-8"
        style={{ background: FILL, maxHeight: '85dvh' }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          /* Transparent with a white border. A `bg-white/10` circle would drop
             the glyph to 4.23:1 — see the contrast note. */
          className="tint absolute right-5 top-5 grid size-9 place-items-center rounded-full border border-white/40 text-on-fill hover:bg-white/10"
        >
          <RiCloseLine className="size-4" aria-hidden />
        </button>
        {children}
      </div>
    </div>
  );
}
