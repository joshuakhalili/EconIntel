import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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

  const open = useCallback((iso, cadence) => setTarget({ iso, cadence }), []);
  const close = useCallback(() => setTarget(null), []);

  const value = useMemo(() => ({ open, close, target }), [open, close, target]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <ContextDrawer target={target} onClose={close} />
    </DrawerContext.Provider>
  );
}

function ContextDrawer({ target, onClose }) {
  const { from, to } = target ? windowFor(target.iso, target.cadence) : {};

  const { data, isPending, isError, error } = useContextWindow(from, to, {
    enabled: Boolean(target),
  });

  useEffect(() => {
    if (!target) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [target, onClose]);

  if (!target) return null;

  const documents = data?.documents ?? [];
  const events = data?.events ?? [];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} aria-hidden />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto border-l border-border-button-default bg-background-primary-default"
        aria-label="Context"
      >
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-border-button-default bg-background-primary-default px-4 py-3">
          <div>
            <h2 className="text-title-3-medium text-text-primary">Around this time</h2>
            {/* The real range, not the period's name: a monthly point covers a
                month, and saying so avoids implying same-day causation. */}
            <p className="mt-0.5 text-body-regular text-text-tertiary">
              {fmtDate(from, target.cadence)} · {from} to {to}
            </p>
          </div>
          <button
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
