import { useRef } from 'react';
import { RiExternalLinkLine } from '@remixicon/react';
import { Chip } from '@/components/base/badges/chip';
import { EmptyBlock } from '@/components/Page';
import { useCollapse, SeeMore } from '@/components/Collapsible';

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
 *
 * A BENTO, AND THE SIZES MEAN SOMETHING
 *
 * A uniform grid of fifty identical boxes reads as a list you scroll past.
 * Varying the boxes gives the eye somewhere to land — but only if the size
 * carries information, otherwise it is decoration on a site whose whole
 * argument is that presentation encodes claims.
 *
 * So the lead card is the MOST RECENT, and the run is sorted by date before
 * being laid out. Position and size mean recency, nothing else.
 *
 * The pattern has a period of six on a six-column grid, which is the same six
 * the collapse steps by. That is not a coincidence and it must stay true: it is
 * what guarantees no ragged last row at any width.
 */
export default function NewsList({ documents, emptyMessage = 'No articles yet.', initial = 6 }) {
  const headRef = useRef(null);

  const sorted = [...(documents ?? [])].sort(
    (a, b) => new Date(b.published_at) - new Date(a.published_at)
  );

  const { visible, hiddenCount, expanded, firstNewIndex, expand, collapse } = useCollapse(sorted, {
    initial,
  });

  if (!documents?.length) return <EmptyBlock>{emptyMessage}</EmptyBlock>;

  return (
    <div ref={headRef}>
      <ul className="stagger grid grid-cols-1 items-stretch gap-3 sm:grid-cols-4 xl:grid-cols-6">
        {visible.map((doc, index) => {
          const shape = SHAPES[index % 6];
          return (
            <li
              key={doc.id}
              className={`rise-sm flex ${shape.span}`}
              style={{ '--i': Math.max(0, index - firstNewIndex) }}
            >
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="lift group flex h-full w-full flex-col gap-1.5 rounded-2lg border border-border-button-default bg-background-primary-default p-4 hover:border-accent-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3
                    className={`${shape.lead ? 'text-title-3-medium leading-snug' : 'text-body-medium'} text-text-primary`}
                  >
                    {doc.title}
                  </h3>
                  <RiExternalLinkLine
                    className="mt-0.5 size-4 shrink-0 text-foreground-icon-secondary opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </div>

                {/* The smallest tiles drop the summary rather than clamping it
                    to one ragged line. */}
                {doc.summary && shape.summary > 0 && (
                  <p
                    className={`text-body-regular text-text-tertiary ${
                      shape.lead ? 'line-clamp-6' : 'line-clamp-2'
                    }`}
                  >
                    {doc.summary}
                  </p>
                )}

                {/* mt-auto pins the provenance to the bottom edge, so the source
                    and date line up across a row whatever the headline did. */}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  {/* The publisher's own mark, carried in the API response as a
                      data: URI rather than linked. Loading it from ft.com would
                      tell the FT who reads this site — see the note in
                      0018_source_icons.sql. `alt` is empty because the name is
                      right beside it; a screen reader announcing "BBC News logo,
                      BBC News" is worse than silence. Two of eight publishers
                      serve no icon this can reach, and their cards show the name
                      alone rather than a placeholder. */}
                  {doc.source_icon && (
                    <img
                      src={doc.source_icon}
                      alt=""
                      width={16}
                      height={16}
                      loading="lazy"
                      className={`${shape.lead ? 'size-5' : 'size-4'} shrink-0 rounded-[3px] object-contain`}
                    />
                  )}
                  <span className="text-caption-1-medium text-text-secondary">
                    {doc.source_name}
                  </span>
                  <span className="text-caption-1-regular text-text-tertiary">
                    {formatPublished(doc.published_at)}
                  </span>
                  {doc.ai_relevance != null && (
                    /*
                     * LABELLED, BECAUSE THE COLOUR WAS DOING THE ONLY WORK.
                     *
                     * This was a bare integer — 45, 55, 80 — tinted lime,
                     * yellow or neutral, with the explanation in a `title`
                     * attribute. A title does not exist on a touch device and
                     * is announced inconsistently by screen readers, so on a
                     * page carrying a hundred of these the number communicated
                     * nothing and the hue carried the whole meaning, which is
                     * the thing this project's palette notes argue against
                     * everywhere else. The word is now in the chip; the colour
                     * is the second cue rather than the only one. What the
                     * scale IS gets defined once, under the /news h1.
                     */
                    <Chip
                      variant="caption"
                      color={relevanceColor(doc.ai_relevance)}
                      title={`AI-economics relevance ${doc.ai_relevance} of 100 — a keyword score, not a judgement`}
                    >
                      relevance {doc.ai_relevance}
                    </Chip>
                  )}
                </div>
              </a>
            </li>
          );
        })}
      </ul>

      <SeeMore
        hiddenCount={hiddenCount}
        expanded={expanded}
        onExpand={expand}
        onCollapse={collapse}
        onCollapseScrollTo={headRef}
        label="more articles"
      />
    </div>
  );
}

/**
 * The six-tile pattern, on a six-column grid.
 *
 * One lead at double height, two half-width beside it, three quarter-width
 * beneath. The rows fill exactly, which is why the collapse can step by six
 * and never leave a hole.
 *
 * At `sm` the grid is four columns and the same six tiles still close cleanly;
 * at base everything is full width and the pattern is inert, which is the right
 * answer inside the 448px context drawer.
 */
const SHAPES = [
  { span: 'sm:col-span-4 xl:col-span-3 xl:row-span-2', lead: true, summary: 6 },
  { span: 'sm:col-span-2 xl:col-span-3', lead: false, summary: 2 },
  { span: 'sm:col-span-2 xl:col-span-3', lead: false, summary: 2 },
  { span: 'sm:col-span-2 xl:col-span-2', lead: false, summary: 0 },
  { span: 'sm:col-span-2 xl:col-span-2', lead: false, summary: 0 },
  { span: 'sm:col-span-4 xl:col-span-2', lead: false, summary: 0 },
];

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
