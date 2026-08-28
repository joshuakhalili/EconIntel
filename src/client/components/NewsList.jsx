import { RiExternalLinkLine } from '@remixicon/react';
import { Chip } from '@/components/base/badges/chip';
import { EmptyBlock } from '@/components/Page';

/**
 * A list of news documents.
 *
 * Shared by the news page and the lens pages, which differ only in how the list
 * was selected — a lens filters by a stored search query held against the lens
 * itself, so the filtering is deterministic rather than a model's judgement.
 *
 * Relevance is shown rather than used to hide things. It is a keyword score
 * computed at ingestion, and a reader should be able to see a low-scoring item
 * and disagree with the score.
 */
export default function NewsList({ documents, emptyMessage = 'No articles yet.' }) {
  if (!documents?.length) return <EmptyBlock>{emptyMessage}</EmptyBlock>;

  return (
    <ul className="flex flex-col gap-2">
      {documents.map((doc) => (
        <li key={doc.id}>
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-1.5 rounded-2lg border border-border-button-default bg-background-primary-default p-4 transition-colors hover:bg-background-secondary-hover"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-body-medium text-text-primary">{doc.title}</h3>
              <RiExternalLinkLine
                className="mt-0.5 size-4 shrink-0 text-foreground-icon-secondary opacity-0 transition-opacity group-hover:opacity-100"
                aria-hidden
              />
            </div>

            {doc.summary && (
              <p className="line-clamp-2 text-body-regular text-text-tertiary">{doc.summary}</p>
            )}

            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className="text-caption-1-medium text-text-secondary">{doc.source_name}</span>
              <span className="text-caption-1-regular text-text-tertiary">
                {formatPublished(doc.published_at)}
              </span>
              {doc.ai_relevance != null && (
                <Chip variant="caption" color={relevanceColor(doc.ai_relevance)}>
                  {doc.ai_relevance}
                </Chip>
              )}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}

function relevanceColor(score) {
  if (score >= 70) return 'lime';
  if (score >= 40) return 'yellow';
  return 'neutral';
}

function formatPublished(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  const hours = (Date.now() - then.getTime()) / 3_600_000;
  // Relative time only while it is genuinely useful. Past a couple of days
  // "3 days ago" is harder to place than the date itself.
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  if (hours < 48) return 'yesterday';
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
