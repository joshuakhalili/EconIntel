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
