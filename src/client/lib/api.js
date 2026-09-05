/**
 * REST client for the Express API.
 *
 * The browser never talks to a data provider directly — every upstream source
 * is ingested into Postgres by the server process, which is also the only place
 * an API key exists. So this file only ever calls same-origin /api paths, and
 * in development Vite proxies them to the Express port.
 */

/**
 * The path a reader should be returned to after signing in, made safe.
 *
 * BOTH ENDS OF THE RETURN TRIP LIVE IN THIS FILE ON PURPOSE. `fetchJson`
 * writes `?next=`; `LoginPage` reads it back through here. They were written
 * apart once — the 401 threw the path away and the sign-in hardcoded
 * `/overview` — which meant sharing a question page, the one thing this site
 * is for, failed for every reader who was not already signed in.
 *
 * WHY THIS IS NOT `if (raw.startsWith('/'))`
 *
 * `next` arrives in a URL anyone can write, and it is handed to
 * `location.assign`. Three shapes turn that into an open redirect, and a
 * naive check misses two of them:
 *
 *   //evil.example    protocol-relative — a browser reads it as a HOST.
 *   /\evil.example    a backslash in this position is read as a slash.
 *   /\n/evil.example  tab, LF and CR are stripped from a URL WHEREVER they
 *                     appear, so the browser sees `//evil.example` even though
 *                     `raw[1]` looked like a harmless newline.
 *
 * So the string is first normalised the way the browser will normalise it, and
 * the decision is made about THAT — not about what was typed.
 *
 * `/login` itself is rejected: returning a reader to the sign-in page they
 * just completed is a loop with no exit.
 */
export function safeNextPath(raw, fallback = '/overview') {
  if (typeof raw !== 'string' || raw === '') return fallback;

  const normalised = raw.replace(/[\t\n\r]/g, '').replace(/\\/g, '/');

  if (!normalised.startsWith('/')) return fallback;
  if (normalised.startsWith('//')) return fallback;
  if (normalised === '/login' || normalised.startsWith('/login?')) return fallback;

  return normalised;
}

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
   *
   * The path travels WITH the redirect. Without it, every shared link to a
   * question landed a new reader on the overview with no idea which page they
   * had been sent, and the caveat and citation they were sent to read were
   * simply gone.
   */
  if (res.status === 401 && !path.startsWith('/api/me')) {
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
      const here = `${window.location.pathname}${window.location.search}`;
      window.location.assign(`/login?next=${encodeURIComponent(here)}`);
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
