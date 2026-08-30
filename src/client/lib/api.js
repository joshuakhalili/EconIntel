/**
 * REST client for the Express API.
 *
 * The browser never talks to a data provider directly — every upstream source
 * is ingested into Postgres by the server process, which is also the only place
 * an API key exists. So this file only ever calls same-origin /api paths, and
 * in development Vite proxies them to the Express port.
 */

export async function fetchJson(path, { signal } = {}) {
  const res = await fetch(path, { signal });

  /*
   * Signed out. Handled here rather than in each hook, because otherwise every
   * page has to remember to check, and the one that forgets shows a wall of
   * "Request failed (401)" instead of an explanation.
   *
   * A full assignment rather than a router navigate: the session changed
   * underneath the app, so every cached query is now wrong and the cleanest
   * thing is to start again. `/login` and `/api/me` are excluded or this
   * bounces forever — asking who you are must be allowed to answer "nobody".
   */
  if (res.status === 401 && !path.startsWith('/api/me')) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      window.location.assign('/login');
    }
    throw new Error('Sign in to read the data');
  }

  if (!res.ok) {
    // The server returns { error } for its own failures; a proxy or a crash
    // returns HTML, so fall back to the status rather than showing markup.
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* not JSON — keep the status message */
    }
    throw new Error(message);
  }
  return res.json();
}

/** Build a query string, dropping empties so absent filters do not appear as "?x=". */
export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    search.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const out = search.toString();
  return out ? `?${out}` : '';
}
