/**
 * One hook per API endpoint.
 *
 * These replace the hand-rolled Map cache the previous front end used. The
 * behaviour that matters is the same — a path is fetched once and reused — but
 * request de-duplication, out-of-order responses when a slug changes mid-fetch,
 * and per-section loading and error state are handled by the query client
 * instead of by each view.
 *
 * Query keys mirror the URL, so two components asking for the same data share
 * one request. The nav rail highlighting a question's parent lens relies on
 * that: it reads the same cached question the page already fetched.
 */

import { useQuery } from '@tanstack/react-query';
import { fetchJson, qs } from '@/lib/api';

/** Editorial structure changes when someone publishes, not while a reader sits there. */
const STRUCTURAL = { staleTime: 5 * 60 * 1000 };
/** The indicator catalogue is effectively static for the length of a session. */
const CATALOGUE = { staleTime: 30 * 60 * 1000 };

/**
 * The API wraps collections in a named envelope ({ lenses: [...] }). Unwrapping
 * here rather than in each component means a component never has to know
 * whether it is reading a bare array or a wrapper, and an endpoint that starts
 * returning extra sibling fields does not ripple outwards.
 */
const unwrap = (key) => (body) => body?.[key] ?? [];

export function useLenses() {
  return useQuery({
    queryKey: ['lenses'],
    queryFn: ({ signal }) => fetchJson('/api/lenses', { signal }),
    select: unwrap('lenses'),
    ...STRUCTURAL,
  });
}

/** Every lens with its thesis and one live number — the front page, in one request. */
export function useOverview() {
  return useQuery({
    queryKey: ['overview'],
    queryFn: ({ signal }) => fetchJson('/api/overview', { signal }),
    select: unwrap('lenses'),
    ...STRUCTURAL,
  });
}

/**
 * Who is signed in, and whether sign-in is even configured on this server.
 *
 * Never unwrapped and never retried: a signed-out reader is a valid answer,
 * not a failure, and retrying it turns every page load into three requests.
 */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: ({ signal }) => fetchJson('/api/me', { signal }),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Every country's position, adoption history and stored depth, for the globe.
 *
 * Not unwrapped: the envelope carries `measured` and `total` alongside the
 * countries, and the caption under the globe has to state both. Computing them
 * in the client from the array would let the caption drift from the query the
 * globe is actually drawing.
 */
export function useGlobe() {
  return useQuery({
    queryKey: ['globe'],
    queryFn: ({ signal }) => fetchJson('/api/globe', { signal }),
    ...CATALOGUE,
  });
}

export function useLens(slug) {
  return useQuery({
    queryKey: ['lens', slug],
    queryFn: ({ signal }) => fetchJson(`/api/lenses/${slug}`, { signal }),
    enabled: Boolean(slug),
    ...STRUCTURAL,
  });
}

export function useLensTickers(slug) {
  return useQuery({
    queryKey: ['lens-tickers', slug],
    queryFn: ({ signal }) => fetchJson(`/api/lenses/${slug}/tickers`, { signal }),
    select: unwrap('tickers'),
    enabled: Boolean(slug),
  });
}

export function useLensNews(slug, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['lens-news', slug],
    queryFn: ({ signal }) => fetchJson(`/api/lenses/${slug}/news`, { signal }),
    select: unwrap('documents'),
    enabled: Boolean(slug) && enabled,
  });
}

export function useQuestions() {
  return useQuery({
    queryKey: ['questions'],
    queryFn: ({ signal }) => fetchJson('/api/questions', { signal }),
    select: unwrap('questions'),
    ...STRUCTURAL,
  });
}

export function useQuestion(slug) {
  return useQuery({
    queryKey: ['question', slug],
    queryFn: ({ signal }) => fetchJson(`/api/questions/${slug}`, { signal }),
    enabled: Boolean(slug),
    ...STRUCTURAL,
  });
}

export function useIndicators(params = {}) {
  return useQuery({
    queryKey: ['indicators', params],
    queryFn: ({ signal }) => fetchJson(`/api/indicators${qs(params)}`, { signal }),
    select: unwrap('indicators'),
    ...CATALOGUE,
  });
}

/** One indicator with its licence, attribution and the question that argues with it. */
export function useIndicator(id) {
  return useQuery({
    queryKey: ['indicator', id],
    queryFn: ({ signal }) => fetchJson(`/api/indicators/${id}`, { signal }),
    select: (body) => body?.indicator ?? null,
    enabled: Boolean(id),
    ...CATALOGUE,
  });
}

export function useIndicatorCountries(id) {
  return useQuery({
    queryKey: ['indicator-countries', id],
    queryFn: ({ signal }) => fetchJson(`/api/indicators/${id}/countries`, { signal }),
    enabled: Boolean(id),
    ...CATALOGUE,
  });
}

/**
 * Batch series fetch. `index` asks the server to rebase every series to 100 at
 * a shared base period — that is how charts with different units stay on ONE
 * y-axis instead of growing a second one.
 *
 * The server caps a request at 12 ids.
 */
export function useSeries(ids, { countries, index } = {}, { enabled = true } = {}) {
  const list = Array.isArray(ids) ? ids : [ids].filter(Boolean);
  return useQuery({
    queryKey: ['series', list, countries ?? null, Boolean(index)],
    queryFn: ({ signal }) =>
      fetchJson(`/api/series${qs({ ids: list, countries, index: index ? 'true' : '' })}`, { signal }),
    enabled: enabled && list.length > 0,
  });
}

/** Events and documents inside a date window — what powers the context drawer. */
export function useContextWindow(from, to, { enabled = true } = {}) {
  return useQuery({
    queryKey: ['context', from, to],
    queryFn: ({ signal }) => fetchJson(`/api/context${qs({ from, to })}`, { signal }),
    enabled: enabled && Boolean(from) && Boolean(to),
  });
}

export function useDocuments(params = {}) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: ({ signal }) => fetchJson(`/api/documents${qs(params)}`, { signal }),
    select: unwrap('documents'),
  });
}

export function useStatus() {
  return useQuery({
    queryKey: ['status'],
    queryFn: ({ signal }) => fetchJson('/api/status', { signal }),
  });
}
