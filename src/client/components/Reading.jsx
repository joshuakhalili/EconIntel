import { useRef } from 'react';
import { RiExternalLinkLine } from '@remixicon/react';
import { useCollapse, SeeMore } from '@/components/Collapsible';

/**
 * What other people have found.
 *
 * Sources are labelled by kind and never ranked. A peer-reviewed paper and a
 * consulting survey are not the same evidence, but which one to believe is the
 * reader's call, and the differences in method, motive and data access are the
 * interesting part rather than a scoring problem.
 *
 * Shared by the question and lens pages. It was written twice, with two copies
 * of the kind dictionary, which would have drifted the first time a new
 * `reading_kind` was added.
 */
const KIND = {
  academic: 'Academic',
  consulting: 'Consulting',
  think_tank: 'Think tank',
  official: 'Official',
  industry: 'Industry',
};

/**
 * How a source sits against this page's own answer.
 *
 * Stored since 0012 and rendered nowhere until now, which made the section
 * heading a promise the cards did not keep: "what others have found" over a
 * list that showed only a publisher and a title.
 *
 * `background` is deliberately not shown. It is the default and the majority
 * case, and a badge on every card carries no information — the marked ones are
 * the ones worth noticing.
 */
const STANCE = {
  supports: { label: 'Agrees', tone: 'text-pos' },
  complicates: { label: 'Complicates', tone: 'text-warn' },
  contradicts: { label: 'Disagrees', tone: 'text-neg' },
};

export default function Reading({ items, scopeNote, accent, initial = 4 }) {
  const headRef = useRef(null);
  const { visible, hiddenCount, expanded, firstNewIndex, expand, collapse } = useCollapse(
    items ?? [],
    { initial, step: 4 }
  );

  if (!items?.length) return null;

  /*
   * Computed over what is ON SCREEN, not over the whole list.
   *
   * This note disclaims the cards below it. Computing it over `items` meant a
   * collapsed list could carry a paragraph about "takeaways marked as not yet
   * checked" while every marked one was hidden — which makes the site look
   * like it disclaims reflexively rather than specifically. Expand, an
   * extracted takeaway appears, and the note appears with it.
   */
  const anyUnreviewed = visible.some((i) => i.takeaway_source === 'extracted');

  return (
    <section className="mt-14">
      {/* The eyebrow takes the parent lens's accent where one is passed, so a
          question page and its lens read as the same publication rather than
          as two components that happen to share a heading. */}
      <p className="eyebrow" style={accent ? { color: accent.hex } : undefined}>
        The literature
      </p>
      <h2 className="mt-3 text-title-1-medium text-text-primary">What others have found</h2>
      <p className="prose-measure mt-2 text-body-regular text-text-tertiary">
        {scopeNote} Labelled by who produced it, not ranked — method, motive and data access
        differ, and that is the part worth seeing.
      </p>

      <ul className="stagger mt-6 flex flex-col gap-2" ref={headRef}>
        {visible.map((item, index) => {
          const stance = STANCE[item.stance];
          return (
            <li
              key={item.id}
              className="rise-sm"
              style={{ '--i': Math.max(0, index - firstNewIndex) }}
            >
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="lift group flex items-start gap-3 rounded-2lg border border-border-button-default bg-background-primary-default p-4 hover:border-accent-300 hover:bg-background-secondary-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border-button-default px-2 py-0.5 text-caption-1-medium text-text-tertiary">
                      {KIND[item.kind] ?? item.kind}
                    </span>
                    <span className="text-caption-1-medium text-text-secondary">
                      {item.publisher}
                    </span>
                    {item.published && (
                      <span className="text-caption-1-regular text-text-tertiary">
                        {new Date(item.published).getUTCFullYear()}
                      </span>
                    )}
                    {stance && (
                      <span className={`text-caption-1-medium ${stance.tone}`}>
                        {stance.label}
                      </span>
                    )}
                    {/* Says whose page this source was filed against, so a
                        lens-level report does not read as though it were
                        written about this question specifically. */}
                    {item.scope === 'lens' && (
                      <span className="text-caption-1-regular text-text-tertiary">
                        · on this lens
                      </span>
                    )}
                  </span>

                  <span className="mt-1 block text-body-medium text-text-primary">
                    {item.title}
                  </span>

                  {item.takeaway && (
                    <span className="prose-measure mt-1 block text-body-regular leading-relaxed text-text-secondary">
                      {item.takeaway}
                    </span>
                  )}

                  {/* The page it came from, and whether a person has checked
                      it. An extracted takeaway is only defensible because a
                      reader can go and settle it, so the reference is not
                      decoration — it is the thing that earns the claim its
                      place on the page. */}
                  {item.takeaway_ref && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-x-2 text-caption-1-regular text-text-tertiary">
                      <span>{item.takeaway_ref}</span>
                      {item.takeaway_source === 'extracted' && (
                        <span>· read from the source, not yet checked by a person</span>
                      )}
                    </span>
                  )}
                </span>

                <RiExternalLinkLine
                  className="mt-0.5 size-4 shrink-0 text-foreground-icon-secondary opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
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
        label="more sources"
      />

      {anyUnreviewed && (
        <p className="prose-measure mt-3 text-caption-1-regular text-text-tertiary">
          Takeaways marked as not yet checked were read out of the document itself, with the page
          given, but nobody has verified them against it. They are shown rather than withheld
          because a citation with no finding tells a reader less — and marked rather than shown
          plainly because a claim that looks checked when it is not is worse than either.
        </p>
      )}
    </section>
  );
}
