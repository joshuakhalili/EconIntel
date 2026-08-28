import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { PreferencesProvider } from '@/lib/preferences';
import { ContextDrawerProvider } from '@/components/chrome/ContextDrawer';
import AppShell from '@/components/chrome/AppShell';
import LensPage from '@/routes/LensPage';
import QuestionPage from '@/routes/QuestionPage';
import ExplorePage from '@/routes/ExplorePage';
import NewsPage from '@/routes/NewsPage';
import PipelinePage from '@/routes/PipelinePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Everything here is pre-ingested into Postgres on a schedule; nothing
      // changes because a reader switched back to the tab, so the default
      // refetch on window focus is pure noise.
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      // Investment is the entry point: the money is committed before any of
      // it shows up in output, in employment, or in a regulation, so it is
      // where the story starts and the one lens with data that is not in
      // dispute.
      { index: true, element: <Navigate to="/lens/investment" replace /> },
      { path: 'lens/:slug', element: <LensPage /> },
      { path: 'q/:slug', element: <QuestionPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'pipeline', element: <PipelinePage /> },
      { path: '*', element: <Navigate to="/lens/investment" replace /> },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        {/* Outside the router: one drawer instance serves every page, and any
            chart can open it without passing a handler down through them. */}
        <ContextDrawerProvider>
          <RouterProvider router={router} />
        </ContextDrawerProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}
