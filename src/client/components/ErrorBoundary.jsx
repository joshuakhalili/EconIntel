import { Component } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBlock } from '@/components/Page';

/**
 * The thing that stops one broken chart taking the whole page with it.
 *
 * WHY THIS EXISTS
 *
 * There was no error boundary anywhere in the app — no componentDidCatch, no
 * getDerivedStateFromError. React's behaviour when a render throws and nothing
 * catches it is to unmount the entire tree, so a single bad value inside a
 * single chart replaced every page with a blank white document: no message, no
 * navigation, no way back, and nothing in the server log, because the throw
 * happened in the reader's browser.
 *
 * That is not hypothetical here. An auditor reported /pipeline rendering
 * completely blank in two independent headless runs and could not tell whether
 * it was a headless artefact or a real race — and with no boundary those two
 * outcomes are indistinguishable from the outside. This makes them
 * distinguishable: a render throw now costs a panel and says so.
 *
 * WHY IT IS A CLASS
 *
 * There is no hook equivalent. `getDerivedStateFromError` and
 * `componentDidCatch` are the only React API for this, and both are
 * class-only. This is the one class component in the codebase and that is why.
 *
 * WHAT IT DOES NOT CATCH
 *
 * Errors thrown in event handlers, in async callbacks, and during server
 * rendering. Those are not render errors and React does not route them here.
 * Data-fetch failures already have their own path — TanStack Query surfaces
 * them as `isError` and the routes render `ErrorBlock` themselves.
 *
 * The reset key matters: without it, navigating away from a route that threw
 * leaves the boundary in its error state forever, so the reader gets the
 * failure panel on a page that is perfectly fine. `AppShell` passes the
 * pathname.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // The one place this failure is visible at all. Kept as console.error
    // rather than swallowed: there is no error-reporting service on this
    // project, and a message in the reader's console is the only artefact
    // anyone debugging a blank page has to go on.
    console.error('Render failed inside the app shell', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col gap-4">
        <ErrorBlock error={this.state.error} what="this page" />
        <p className="prose-measure text-body-regular text-text-tertiary">
          Something in this page failed while it was being drawn. The rest of
          the site is unaffected, and reloading often clears it — the message
          above is the browser's own, kept verbatim rather than rewritten.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-white px-4 py-1.5 text-caption-1-medium text-page transition-opacity hover:opacity-90"
          >
            Reload this page
          </button>
          <Link
            to="/overview"
            className="tint rounded-full border border-border-button-default px-4 py-1.5 text-caption-1-medium text-text-secondary hover:text-text-primary"
          >
            Back to the overview
          </Link>
        </div>
      </div>
    );
  }
}
