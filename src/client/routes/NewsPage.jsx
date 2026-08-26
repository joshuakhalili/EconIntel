import { useDocuments } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';
import { LoadingBlock, ErrorBlock } from '@/components/Page';
import NewsList from '@/components/NewsList';

export default function NewsPage() {
  const { data: documents, isPending, isError, error } = useDocuments({ limit: 100 });

  usePageTitle('News', 'Reporting that bears on the measurements');

  return (
    <div className="mx-auto max-w-3xl">
      {isPending && <LoadingBlock rows={6} />}
      {isError && <ErrorBlock error={error} what="the news feed" />}
      {documents && (
        <NewsList
          documents={documents}
          emptyMessage="No articles stored yet. Run the RSS ingestion to populate this."
        />
      )}
    </div>
  );
}
