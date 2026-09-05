import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { RiCloseLine } from '@remixicon/react';
import { useContextWindow } from '@/hooks/queries';
import { fmtDate } from '@/lib/format';
import { LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/Page';
import NewsList from '@/components/NewsList';

/**
 * What was happening when a chart point was clicked.
 *
 * A number on its own invites a story; this puts the reporting from the same
 * period next to it so a reader can check whether the story they are about to
 * tell themselves is supported. It deliberately does not assert a cause.
 */
const DrawerContext = createContext(null);

export function useContextDrawer() {
  const value = useContext(DrawerContext);
  if (!value) throw new Error('useContextDrawer must be used inside ContextDrawerProvider');
  return value;
}

export function ContextDrawerProvider({ children }) {
  const [target, setTarget] = useState(null);
  // What had focus when the drawer was asked for, so it can be given back.
  const openerRef = useRef(null);

  const open = useCallback((iso, cadence) => {
    /*
     * Captured HERE, at the click, and not inside the drawer's own effect.
     *
     * The drawer moves focus into its panel on open. If a reader clicks a
     * second chart point while the drawer is already open, that effect re-runs
     * — and by then `document.activeElement` is the drawer's close button, so
     * capturing there would record the panel as the thing to return to and the
     * reader would never get back to the chart.
     */
    openerRef.current = typeof document === 'undefined' ? null : document.activeElement;
    setTarget({ iso, cadence });
  }, []);
  const close = useCallback(() => setTarget(null), []);

  const value = useMemo(() => ({ open, close, target }), [open, close, target]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <ContextDrawer target={target} onClose={close} openerRef={openerRef} />
    </DrawerContext.Provider>
  );
}

function ContextDrawer({ target, onClose, openerRef }) {
  const { from, to } = target ? windowFor(target.iso, target.cadence) : {};

  const { data, isPending, isError, error } = useContextWindow(from, to, {
    enabled: Boolean(target),
  });

  const panelRef = useRef(null);
  const closeRef = useRef(null);

  /*
   * MODAL SEMANTICS, WHICH THIS DID NOT HAVE.
   *
   * The drawer is a modal in every respect a reader can see — a full-screen
   * overlay that swallows clicks, a panel over the page, Escape to dismiss —
   * and in none of the respects a keyboard or screen-reader user depends on.
   * It was an <aside aria-label="Context"> with no role, no aria-modal, no
   * focus move, no trap and no restore.
   *
   * The consequence is specific and it lands on the site's most important
   * interaction: clicking a chart point opens this. A keyboard user who does
   * that had focus left BEHIND the overlay, tabbing through content they
   * cannot see and cannot reach, with no way back to where they were.
   *
   * Three things fix it, and they have to be together — a trap without a
   * restore strands the reader at the top of the page when the drawer closes.
   */
  useEffect(() => {
    if (!target) return undefined;

    // The close button, not the panel: it is the one control that always
    // exists here, and landing on it means Escape and Enter both work without
    // the reader hunting.
    closeRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      // The trap. Everything focusable inside the panel, in DOM order, with
      // Tab wrapping at the end and Shift+Tab at the start.
      const focusable = panelRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      // Focus escaping the panel entirely — which a click on the overlay can
      // do — comes back to the first control rather than being left outside.
      if (!panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Back to the chart point that opened this. `isConnected` because a
      // re-render can replace the element while the drawer is open, and
      // calling focus() on a detached node silently sends focus to <body>.
      const opener = openerRef?.current;
      if (opener?.isConnected && typeof opener.focus === 'function') opener.focus();
    };
  }, [target, onClose, openerRef]);

  if (!target) return null;

  const documents = data?.documents ?? [];
  const events = data?.events ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      {/* role="dialog" + aria-modal is what tells a screen reader that the rest
          of the page is inert; without it the reader is free to wander into
          content the overlay has already hidden. aria-labelledby points at the
          heading that is on screen rather than repeating it in an aria-label,
          so the announced name and the visible name cannot drift. */}
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-drawer-title"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-border-button-default bg-background-primary-default"
      >
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-border-button-default bg-background-primary-default px-4 py-3">
          <div>
            <h2 id="context-drawer-title" className="text-title-3-medium text-text-primary">
              Around this time
            </h2>
            {/* The real range, not the period's name: a monthly point covers a
                month, and saying so avoids implying same-day causation. */}
            <p className="mt-0.5 text-body-regular text-text-tertiary">
              {fmtDate(from, target.cadence)} · {from} to {to}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 shrink-0 place-items-center rounded-2lg text-text-secondary hover:bg-background-secondary-hover"
          >
            <RiCloseLine className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex flex-col gap-5 p-4">
          {isPending && <LoadingBlock rows={3} />}
          {isError && <ErrorBlock error={error} what="the context for this period" />}

          {data && (
            <>
              {events.length > 0 && (
                <section>
                  <h3 className="mb-2 text-body-medium text-text-primary">Events</h3>
                  <ul className="flex flex-col gap-2">
                    {events.map((event) => (
                      <li
                        key={event.id}
                        className="rounded-2lg border border-border-button-default p-3"
                      >
                        {/* headline/announced_date, not title/occurred_at.
                            The wrong names rendered every event as an empty
                            row, and it was invisible only because `events` is
                            still empty — it would have shipped broken the day
                            extraction landed. */}
                        <p className="text-body-regular text-text-primary">{event.headline}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-2 text-caption-1-regular text-text-tertiary">
                          {event.announced_date && <span>{event.announced_date.slice(0, 10)}</span>}
                          {event.from_name && (
                            <span>
                              {event.from_name}
                              {event.to_name ? ` → ${event.to_name}` : ''}
                            </span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {documents.length > 0 && (
                <section>
                  <h3 className="mb-2 text-body-medium text-text-primary">Reported then</h3>
                  <NewsList documents={documents} />
                </section>
              )}

              {events.length === 0 && documents.length === 0 && (
                <EmptyBlock>
                  Nothing stored from this period. The news archive only reaches back to the
                  first ingestion run, so older points are usually empty.
                </EmptyBlock>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

/**
 * Widen a clicked point into the period it actually represents.
 *
 * A monthly observation dated the 1st describes the whole month, so the window
 * has to cover it — otherwise clicking a point returns only what was published
 * on one arbitrary day.
 */
function windowFor(iso, cadence) {
  const start = new Date(`${iso}T00:00:00Z`);
  const end = new Date(start);
  if (cadence === 'annual') end.setUTCFullYear(start.getUTCFullYear() + 1);
  else if (cadence === 'quarterly') end.setUTCMonth(start.getUTCMonth() + 3);
  else if (cadence === 'weekly') end.setUTCDate(start.getUTCDate() + 7);
  else if (cadence === 'daily') end.setUTCDate(start.getUTCDate() + 1);
  else end.setUTCMonth(start.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { from: iso, to: end.toISOString().slice(0, 10) };
}
