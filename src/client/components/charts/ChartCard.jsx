import { useId } from 'react';
import { cx } from '@/utils/cx';

/*
 * The thirteen chart honesty behaviours this project treats as non-negotiable
 * are listed once, next to this file, in HONESTY.md. None of them is decided
 * here — this is the frame the disclosures are rendered into (the footer slot
 * carries the rebasing count and the index note). Read it before changing the
 * footer or removing it.
 */

/**
 * The container every chart sits in.
 *
 * The caption is not decoration. On a question page it carries the stored
 * reason this chart is present at all, which is editorial text from the API
 * rather than anything generated here.
 *
 * EVERY FIGURE IS NAMED, AND A FIGCAPTION IS NOT ENOUGH TO NAME IT.
 *
 * Two separate things had to be true and only the first is obvious.
 *
 * 1. THE CARD NEEDS A FIGCAPTION. `/data/:id` shipped without one, because it
 *    is the one page that must NOT pass a title — the title would be its h1
 *    repeated as an h3 (see the note in IndicatorPage.jsx). `label` names such
 *    a card without adding to the heading outline: rendered visually hidden,
 *    and only when there is no visible title, since two names in one figcaption
 *    are read out one after the other.
 *
 * 2. THE FIGURE NEEDS aria-labelledby ANYWAY. HTML-AAM says a `<figure>` takes
 *    its accessible name from its `<figcaption>`. Chrome does not implement
 *    that. Measured on Chrome 141 headless, reading the name back out of the
 *    accessibility tree over CDP: a `<figure>` whose `<figcaption>` reads "A
 *    plain visible caption" computes an accessible name of "" — and so did
 *    every chart on this site, including the ones that always had a title.
 *    Pointing `aria-labelledby` at the same figcaption computes the name
 *    correctly, `sr-only` text included, and is what Firefox and Safari would
 *    have done from the markup alone. So the attribute is not belt-and-braces;
 *    in the browser most readers arrive in, it is the whole mechanism.
 */
export default function ChartCard({ title, label, caption, children, footer, className }) {
  const captionId = useId();
  const named = title || label || caption;
  return (
    <figure
      aria-labelledby={named ? captionId : undefined}
      className={cx(
        'flex flex-col rounded-2xl border border-border-button-default bg-background-primary-default p-4',
        className
      )}
    >
      {named && (
        <figcaption id={captionId} className={title || caption ? 'mb-1' : undefined}>
          {title ? (
            <h3 className="text-body-medium text-text-primary">{title}</h3>
          ) : (
            label && <span className="sr-only">{label}</span>
          )}
          {caption && (
            <p className={cx('text-body-regular text-text-tertiary', title && 'mt-0.5')}>
              {caption}
            </p>
          )}
        </figcaption>
      )}

      <div className="min-w-0 flex-1">{children}</div>

      {footer && (
        <div className="mt-2 border-t border-border-button-default pt-2 text-caption-1-regular text-text-tertiary">
          {footer}
        </div>
      )}
    </figure>
  );
}
