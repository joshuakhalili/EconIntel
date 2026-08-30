import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { PreferencesProvider } from '@/lib/preferences';
import { ContextDrawerProvider } from '@/components/chrome/ContextDrawer';
import AppShell from '@/components/chrome/AppShell';
import LoginPage from '@/routes/LoginPage';
import OverviewPage from '@/routes/OverviewPage';
import LensPage from '@/routes/LensPage';
import QuestionPage from '@/routes/QuestionPage';
import ExplorePage from '@/routes/ExplorePage';
import DataPage from '@/routes/DataPage';
import IndicatorPage from '@/routes/IndicatorPage';
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
      // The overview is the entry point. Landing straight inside a lens gave a
      // first-time visitor no statement of what the site is or how the lenses
      // relate, which made five ways of looking at one subject read as five
      // unrelated sections.
      { index: true, element: <OverviewPage /> },
      // `/` is the landing page on a hard load — Express serves the static
      // mirror there — so the app needs a real path of its own for the same
      // component. Without it, signing in redirected to /overview, fell
      // through to the catch-all, and rewrote the URL to `/`; a refresh then
      // left the reader back on the landing page they had just come from.
      { path: 'overview', element: <OverviewPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'lens/:slug', element: <LensPage /> },
      { path: 'q/:slug', element: <QuestionPage /> },
      { path: 'explore', element: <ExplorePage /> },
      { path: 'data', element: <DataPage /> },
      { path: 'data/:id', element: <IndicatorPage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'pipeline', element: <PipelinePage /> },
      // An unknown path lands on the overview rather than a lens, so a stale
      // or mistyped link explains where it has arrived instead of dropping a
      // reader into the middle of an argument.
      { path: '*', element: <Navigate to="/" replace /> },
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
