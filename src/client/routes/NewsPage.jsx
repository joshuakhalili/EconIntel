import { Link } from 'react-router-dom';
import { useDocuments } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import NewsList from '@/components/NewsList';

export default function NewsPage() {
  const { data: documents, isPending, isError, error } = useDocuments({ limit: 100 });

  usePageTitle('News', 'Reporting that bears on the measurements');

  // Full container width. At max-w-3xl the six-column bento never got the room
  // to become one, so every card rendered at the same size and the layout was a
  // uniform grid wearing a bento's CSS.
  return (
    <div className="mx-auto max-w-6xl">
      {/*
        This page had NO h1 and no h2 — the document outline started at an
        article headline, so the first thing a screen reader announced was
        somebody else's story rather than where the reader had arrived. Every
        other route sets one; only `usePageTitle` was doing anything here, and
        that writes the browser tab, not the page.

        `PageHero` is not used: it opens with a gradient band sized for a page
        that argues something. This page is a wall of other people's headlines,
        and the heading's whole job is to say so and get out of the way.
      */}
      <header>
        <p className="eyebrow text-signal">Coverage</p>
        <h1 className="mt-3 text-display-4-medium leading-tight text-text-primary">News</h1>
        <p className="prose-measure mt-3 text-headline-regular leading-relaxed text-text-secondary">
          Reporting that bears on the measurements. Matched by a stored search
          per lens rather than sorted by a model, and carried here because what
          was being said around a period is part of reading the period.
        </p>
        {/*
          The relevance number appears a hundred times on this page and its
          only explanation lived in a `title` attribute — invisible on a touch
          device, inconsistently announced by a screen reader, and never seen
          by anyone who was not hovering. Defined once, here, where a reader
          meets the first chip.
        */}
        <p className="prose-measure mt-3 text-body-regular text-text-tertiary">
          Each article carries a relevance figure out of 100. It is a keyword score
          computed when the article was collected, not a judgement about the piece.
          The number is shown so you can disagree with it — but it is not only
          decoration: anything scoring under 40 is never collected into this list.
        </p>
      </header>

      <section className="mt-10">
        {/*
          The outline ran H1 → H3: six article headlines hung directly under
          the page title with nothing between them, so a reader navigating by
          heading arrived at somebody else's story with no idea what list it
          belonged to. The heading also states the sort order, which the bento
          encodes — the largest tile is the most recent — and which was
          otherwise something a reader had to work out.
        */}
        <h2 className="mb-4 text-title-3-medium text-text-primary">Most recent first</h2>
        {isPending && <LoadingBlock rows={6} />}
        {isError && <ErrorBlock error={error} what="the news feed" />}
        {documents && (
          <NewsList
            documents={documents}
            /*
              WRITTEN FOR A READER, NOT FOR THE OPERATOR.

              This said "Run the RSS ingestion to populate this" — an
              instruction to run a command on a server the reader does not
              have. ContextDrawer's empty state is the model: say why the gap
              exists in terms the reader can act on, and point at the page that
              says when collection last ran.
            */
            emptyMessage={
              <>
                No articles are stored yet. Coverage is collected on a schedule and the
                archive only reaches back to the first collection run —{' '}
                <Link to="/pipeline" className="underline underline-offset-2">
                  the pipeline page
                </Link>{' '}
                says when that last happened.
              </>
            }
          />
        )}
      </section>
    </div>
  );
}
