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
      </header>

      <div className="mt-10">
      {isPending && <LoadingBlock rows={6} />}
      {isError && <ErrorBlock error={error} what="the news feed" />}
      {documents && (
        <NewsList
          documents={documents}
          emptyMessage="No articles stored yet. Run the RSS ingestion to populate this."
        />
      )}
      </div>
    </div>
  );
}
