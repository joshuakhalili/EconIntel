import { lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { PreferencesProvider } from '@/lib/preferences';
import { ContextDrawerProvider } from '@/components/chrome/ContextDrawer';
import AppShell from '@/components/chrome/AppShell';
import OverviewPage from '@/routes/OverviewPage';

/**
 * ROUTES ARE SPLIT; THE OVERVIEW IS NOT.
 *
 * One bundle held every route, and the expensive thing in it is Recharts —
 * which only four of the nine routes draw with. A reader arriving at `/news`
 * or `/data` was downloading an entire charting library to read a list.
 *
 * The overview stays statically imported on purpose. It is the route the
 * landing page's every call to action leads to, so lazy-loading it would buy a
 * smaller first chunk and immediately spend it on a second round trip before
 * anything rendered — a loading state on the page most likely to be someone's
 * first is the wrong trade.
 *
 * Everything else is reached by a click, where a chunk fetch overlaps with the
 * reader's own attention shift and the fallback below is what they see for a
 * fraction of a second.
 *
 * Note this is the only place `@/routes/*` may be imported. Import one of
 * these modules from a component and it is pulled back into the main chunk,
 * silently, with no error and no size warning to explain why the bundle grew.
 */
const LoginPage = lazy(() => import('@/routes/LoginPage'));
const LensPage = lazy(() => import('@/routes/LensPage'));
const QuestionPage = lazy(() => import('@/routes/QuestionPage'));
const ExplorePage = lazy(() => import('@/routes/ExplorePage'));
const DataPage = lazy(() => import('@/routes/DataPage'));
const IndicatorPage = lazy(() => import('@/routes/IndicatorPage'));
const NewsPage = lazy(() => import('@/routes/NewsPage'));
const PipelinePage = lazy(() => import('@/routes/PipelinePage'));
const SimulationPage = lazy(() => import('@/routes/SimulationPage'));
const NotFoundPage = lazy(() => import('@/routes/NotFoundPage'));

/*
 * The Suspense boundary these need lives in `AppShell`, wrapped around the
 * `Outlet` rather than around the router — see the note there. Its fallback is
 * the same `LoadingBlock` skeleton every page shows while its data loads, so a
 * slow chunk and a slow query look identical instead of introducing a second,
 * unfamiliar waiting state.
 */

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
      { path: 'simulate/:slug', element: <SimulationPage /> },
      // An unknown path gets a page that SAYS it is unknown.
      //
      // This was `<Navigate to="/" replace />`, which rendered the overview
      // instead — the URL changed under the reader and they were shown a page
      // that looked correct, so a mistyped link read as the sender being wrong
      // about the content rather than about the address. A silent redirect to
      // something plausible is worse than an error, because there is nothing
      // to notice.
      //
      // The status code is a separate problem and is fixed on the server side:
      // an unknown /q/:slug is resolved against the database in api/index.js
      // and answered 404, because a rewrite that serves the shell tells every
      // link checker and archive that a dead page is live.
      { path: '*', element: <NotFoundPage /> },
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
