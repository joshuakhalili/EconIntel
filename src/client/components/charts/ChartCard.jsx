import { cx } from '@/utils/cx';

/**
 * The container every chart sits in.
 *
 * The caption is not decoration. On a question page it carries the stored
 * reason this chart is present at all, which is editorial text from the API
 * rather than anything generated here.
 */
export default function ChartCard({ title, caption, children, footer, className }) {
  return (
    <figure
      className={cx(
        'flex flex-col rounded-2xl border border-border-secondary bg-background-primary-default p-4',
        className
      )}
    >
      {title && (
        <figcaption className="mb-1">
          <h3 className="text-body-medium text-text-primary">{title}</h3>
          {caption && (
            <p className="mt-0.5 text-body-regular text-text-tertiary">{caption}</p>
          )}
        </figcaption>
      )}

      <div className="min-w-0 flex-1">{children}</div>

      {footer && (
        <div className="mt-2 border-t border-border-secondary pt-2 text-caption-regular text-text-tertiary">
          {footer}
        </div>
      )}
    </figure>
  );
}
