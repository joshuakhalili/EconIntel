/**
 * Shared page-level states.
 *
 * A page has three failure-adjacent states worth showing differently: still
 * loading, failed, and succeeded-but-empty. The last one matters most here —
 * an empty result usually means the ingestion has not run rather than that the
 * reader did something wrong, and saying so is more honest than a blank panel.
 */

import { RiErrorWarningLine, RiInboxLine } from '@remixicon/react';

export function LoadingBlock({ rows = 3, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`} aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-2lg bg-background-tertiary-default" />
      ))}
    </div>
  );
}

export function ErrorBlock({ error, what = 'this' }) {
  return (
    <div className="flex items-start gap-3 rounded-2lg border border-border-error-default bg-background-tertiary-error p-4">
      <RiErrorWarningLine className="mt-0.5 size-5 shrink-0 text-text-error" aria-hidden />
      <div>
        <p className="text-body-medium text-text-primary">Could not load {what}.</p>
        <p className="mt-0.5 text-body-regular text-text-tertiary">
          {error?.message ?? 'Unknown error'}
        </p>
      </div>
    </div>
  );
}

export function EmptyBlock({ children }) {
  return (
    <div className="flex items-center gap-3 rounded-2lg border border-border-secondary bg-background-secondary-default p-4">
      <RiInboxLine className="size-5 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <p className="text-body-regular text-text-tertiary">{children}</p>
    </div>
  );
}

/** A titled section. Used by every page so headings stay consistent. */
export function Section({ title, caption, children, actions }) {
  return (
    <section className="mb-8">
      {(title || actions) && (
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <div>
            {title && <h2 className="text-title-medium text-text-primary">{title}</h2>}
            {caption && (
              <p className="mt-0.5 text-body-regular text-text-tertiary">{caption}</p>
            )}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
