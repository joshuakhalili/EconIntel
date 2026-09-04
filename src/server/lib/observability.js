/**
 * The one place a server error leaves a trace that outlives the log window.
 *
 * WHY THIS EXISTS
 *
 * Until this file, the entire handling of a 500 was `console.error('[http]', …)`
 * into Vercel's function log. That log is retained for a limited window, is not
 * searchable without opening the dashboard, and — the part that actually
 * matters — nobody reads it. A real production 500 was seen in passing by an
 * auditor working on something else (`cannot execute INSERT in a read-only
 * transaction`, from runSimulation) and nothing followed it up, because there
 * was nowhere for it to land. A daily smoke run stayed green throughout.
 *
 * So: when a request reaches the Express error handler, record the fact
 * somewhere durable. Not a tracing platform, not an APM agent, not a
 * third-party script — the site's own privacy policy says no external service
 * is loaded in the reader's browser, and this must not quietly make that false.
 * Nothing here runs in a browser. This is server-to-server, after the request
 * has already failed.
 *
 * THREE RULES, IN ORDER OF HOW BADLY BREAKING THEM WOULD HURT
 *
 *   1. IT MUST NEVER THROW. An error sink that throws inside an error handler
 *      takes the process with it, and turns a single broken route into an
 *      outage. Every exported function here catches everything, including its
 *      own redaction and its own configuration reading, and the delivery
 *      promise resolves — never rejects — whatever happened.
 *
 *   2. IT MUST NEVER CARRY A SECRET, A SESSION COOKIE OR A READER'S EMAIL.
 *      What goes out is the method, the path (no query string), the error name,
 *      the Postgres SQLSTATE if there is one, a redacted message and at most
 *      three redacted stack frames. Headers are never read. Bodies are never
 *      read. `error.detail` is never read — that is the pg field that carries
 *      row VALUES ("Key (email)=(…) already exists"), which is exactly the
 *      thing rule 2 is about.
 *
 *   3. ONE BROKEN ROUTE MUST NOT OPEN A THOUSAND ISSUES. A window cap plus a
 *      per-fingerprint cooldown, both decided synchronously before any network
 *      call, so the hundredth 500 of an outage costs nothing at all.
 *
 * WHY DELIVERY IS AWAITED RATHER THAN FIRED AND FORGOTTEN
 *
 * The obvious shape is `record(…).catch(() => {})` and answer the reader
 * immediately. On a long-lived host that works. On Vercel it does not: the
 * invocation is finished when the response ends and the instance is frozen, so
 * a fetch that was started and not awaited is killed before it connects — the
 * report is lost on the one platform this actually runs on.
 *
 * So `reportServerError` returns a promise the caller awaits before sending the
 * 500, and pays for that with a hard 1.5s ceiling. The cost is bounded twice
 * over: it is only paid on a 500, and only on the first few 500s of any storm,
 * because the rate-limit decision is synchronous and returns `null` — meaning
 * "nothing to wait for" — for everything after that.
 *
 * WHAT THIS DELIBERATELY IS NOT
 *
 * Not analytics. It counts nothing about readers and records nothing about a
 * successful request. See ownerDecisions in the handover: the decision about
 * whether this site measures its readership at all is the owner's to make, and
 * defaulting into a third-party beacon would break a privacy claim the site now
 * makes in writing.
 */

/*
 * Configuration is read from `process.env` at call time rather than from
 * config.js.
 *
 * config.js freezes its object at module load, which is right for everything
 * the server needs to boot and wrong for this: the sink is optional, its
 * absence is the normal state, and a test has to be able to turn it on and off
 * between cases. Reading late costs one property lookup on a path that only
 * runs when a request has already failed.
 */
function readSink() {
  const webhook = (process.env.ERROR_SINK_URL ?? '').trim();
  const repo = (process.env.ERROR_SINK_GITHUB_REPO ?? '').trim();
  const githubToken = (process.env.ERROR_SINK_GITHUB_TOKEN ?? '').trim();

  if (webhook) {
    return {
      kind: 'webhook',
      url: webhook,
      token: (process.env.ERROR_SINK_TOKEN ?? '').trim() || null,
    };
  }
  // `owner/repo`, and nothing else. A bare repo name or a full URL would be
  // pasted into an API path and produce a 404 that looks like an outage.
  if (repo && githubToken && /^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { kind: 'github', repo, token: githubToken };
  }
  return null;
}

/*
 * THE REDACTOR.
 *
 * Ordered most specific first, because a general pattern that runs early eats
 * the text a specific one was meant to recognise — replace every long token
 * before looking for `postgres://user:pass@host` and the credentials are gone
 * along with any chance of labelling them.
 *
 * Each rule replaces with a NAMED placeholder rather than a blank. A message
 * reading `connect ECONNREFUSED [db-url]` still says what happened; one reading
 * `connect ECONNREFUSED` has had the diagnosis removed along with the secret.
 */
const REDACTIONS = [
  // Credentials inside a connection string, which is how a DATABASE_URL leaks.
  [/\b([a-z][a-z0-9+.-]*):\/\/[^\s/@]+:[^\s/@]+@/gi, '$1://[credentials]@'],
  // Bearer tokens and the provider-prefixed key formats this project handles.
  [/\bBearer\s+[\w.\-~+/]+=*/gi, 'Bearer [redacted]'],
  [/\b(?:sk|pk|rk)-[A-Za-z0-9_-]{8,}/g, '[api-key]'],
  [/\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}/g, '[github-token]'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/g, '[github-token]'],
  // A cookie pair, however it is spelled. The session cookie is the one thing
  // in this system that IS a credential to a reader's account.
  [/\b(session|sid|token|secret|password|passwd|pwd|auth)\s*[=:]\s*[^\s;,)"']+/gi, '$1=[redacted]'],
  // An email address. Readers have exactly one identifying attribute and this
  // is it — a unique-violation message names the constraint, but a hand-written
  // `throw new Error(\`no reader for ${email}\`)` would name the person.
  [/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]'],
  /*
   * A developer's home directory, which arrives inside stack frames. On Vercel
   * every path is `/var/task/…` and this does nothing; run locally against a
   * configured sink it stops the machine's account name being posted to a
   * public issue tracker. The frame stays readable — only the prefix goes.
   */
  [/(?:file:\/\/)?\/(?:Users|home)\/[^/\s)]+\//g, '~/'],
  // Anything left that is long enough and random enough to be a credential.
  // Runs LAST so the labelled rules above get first refusal on their own text.
  [/\b[A-Za-z0-9_-]{40,}\b/g, '[redacted]'],
];

const MAX_MESSAGE = 400;

/**
 * Make a string safe to send somewhere durable.
 *
 * Exported because it is the rule that must never regress, and a rule with no
 * test is a comment. Total by design: a non-string, a null, a thrown regex —
 * all produce a short honest placeholder rather than an exception on the error
 * path.
 */
export function redact(value) {
  try {
    if (typeof value !== 'string' || value === '') return '';
    let out = value;
    for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
    return out.length > MAX_MESSAGE ? `${out.slice(0, MAX_MESSAGE)}…` : out;
  } catch {
    return '[unredactable]';
  }
}

/**
 * A stable identity for "this same thing going wrong again".
 *
 * Digits are collapsed before hashing, so `/data/9999` and `/data/1` are one
 * fault rather than two, and a message that quotes a row count does not defeat
 * the cooldown by changing every time. The result is short and readable because
 * it is pasted into an issue TITLE — that is what lets a second process, on a
 * second serverless instance with its own empty memory, find the issue this one
 * already opened.
 */
export function fingerprint({ method = '', path = '', message = '' } = {}) {
  const normalised = `${method} ${path} ${message}`
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  // FNV-1a, 32-bit. Not a security hash — a short stable label. Written out
  // rather than imported so this module has no dependencies at all and cannot
  // fail to load on the error path.
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalised.length; i += 1) {
    hash ^= normalised.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/*
 * THE TWO CEILINGS.
 *
 * WINDOW_MS/WINDOW_MAX bounds the total: at most 5 reports leave this process
 * in any 10 minutes, whatever is broken. That is the one that stops a thousand
 * issues.
 *
 * COOLDOWN_MS bounds the repeat: the same fingerprint is not sent again for an
 * hour. That is the one that stops the same fault filling those 5 slots on
 * every window boundary while a second, different fault goes unreported.
 *
 * BOTH ARE PER PROCESS, AND ON VERCEL THAT MEANS PER INSTANCE. A burst across
 * ten cold starts can produce ten reports rather than one. The GitHub transport
 * closes that gap by searching for an already-open issue carrying the same
 * fingerprint before opening one; the webhook transport does not, and cannot,
 * because a webhook has no state to ask. Stated here rather than discovered.
 */
const WINDOW_MS = 10 * 60 * 1000;
const WINDOW_MAX = 5;
const COOLDOWN_MS = 60 * 60 * 1000;
const DELIVERY_TIMEOUT_MS = 1500;
/* Bounded so a stream of distinct fingerprints cannot grow the map forever. */
const MAX_TRACKED_FINGERPRINTS = 200;

let windowStart = 0;
let windowCount = 0;
const lastSeen = new Map();

/**
 * May a report for this fingerprint go out right now? Synchronous, and it
 * mutates — asking is claiming the slot.
 */
function claimSlot(id, now) {
  if (now - windowStart >= WINDOW_MS) {
    windowStart = now;
    windowCount = 0;
  }
  const previous = lastSeen.get(id);
  if (previous !== undefined && now - previous < COOLDOWN_MS) return 'cooling down';
  if (windowCount >= WINDOW_MAX) return 'window full';

  if (lastSeen.size >= MAX_TRACKED_FINGERPRINTS) lastSeen.clear();
  lastSeen.set(id, now);
  windowCount += 1;
  return null;
}

/** Build the payload. Pure, so a test can assert exactly what would be sent. */
export function buildReport({ error, method, path, commit, now } = {}) {
  const name = typeof error?.name === 'string' ? error.name.slice(0, 60) : 'Error';
  const message = redact(typeof error?.message === 'string' ? error.message : String(error ?? ''));
  /*
   * `error.code` is the Postgres SQLSTATE on a pg error (42P01 is "relation
   * does not exist", 25006 is the read-only-transaction failure that started
   * all this) and a short symbol on a Node system error. Both are five to
   * twenty safe characters and both are the fastest route to a diagnosis, so
   * the field is kept — capped, in case something else has put a novel into it.
   */
  const code = typeof error?.code === 'string' || typeof error?.code === 'number'
    ? String(error.code).slice(0, 40)
    : null;
  /*
   * Three frames. Enough to name the function and its caller; short enough that
   * nothing resembling a payload can hide in it. Redacted like everything else,
   * because a frame can carry an absolute path and a path can carry a username.
   */
  const stack = typeof error?.stack === 'string'
    ? error.stack.split('\n').slice(1, 4).map((line) => redact(line.trim())).filter(Boolean)
    : [];

  const safePath = redact(String(path ?? '').split('?')[0]).slice(0, 200);
  const safeMethod = /^[A-Z]{3,7}$/.test(String(method ?? '')) ? String(method) : 'UNKNOWN';

  return {
    at: new Date(now ?? Date.now()).toISOString(),
    method: safeMethod,
    path: safePath,
    name,
    code,
    message,
    stack,
    // The caller may pass one; otherwise the same field `/healthz` reports, so
    // a report and a health check agree on which build produced it.
    commit: commit ?? process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    env: process.env.NODE_ENV ?? 'development',
    fingerprint: fingerprint({ method: safeMethod, path: safePath, message }),
  };
}

/** One line that reads the same in an issue title and in a webhook preview. */
const titleOf = (report) =>
  `[500] ${report.method} ${report.path} — ${report.name}${report.code ? ` ${report.code}` : ''} (${report.fingerprint})`;

const bodyOf = (report) =>
  [
    `**When** ${report.at}`,
    `**Route** \`${report.method} ${report.path}\``,
    `**Commit** \`${report.commit ?? 'unknown'}\``,
    `**Environment** \`${report.env}\``,
    `**Fingerprint** \`${report.fingerprint}\``,
    '',
    '```',
    `${report.name}${report.code ? ` [${report.code}]` : ''}: ${report.message}`,
    ...report.stack.map((line) => `  ${line}`),
    '```',
    '',
    'Opened automatically by `src/server/lib/observability.js`. Message, path and',
    'stack are redacted before they leave the process — no headers, no body, no',
    '`error.detail`. Repeats of this fingerprint are suppressed for an hour.',
  ].join('\n');

/**
 * The injection seam. Tests replace `fetch` here rather than reaching for a
 * global, so a test that forgets to restore it cannot silently let a later test
 * make a real network call.
 */
const transport = { fetch: (...args) => globalThis.fetch(...args) };

async function deliver(sink, report) {
  const signal = AbortSignal.timeout(DELIVERY_TIMEOUT_MS);

  if (sink.kind === 'webhook') {
    const response = await transport.fetch(sink.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(sink.token ? { authorization: `Bearer ${sink.token}` } : {}),
      },
      body: JSON.stringify({ title: titleOf(report), ...report }),
      signal,
    });
    return response.ok ? { delivered: true, via: 'webhook' } : { delivered: false, reason: `webhook ${response.status}` };
  }

  const api = 'https://api.github.com';
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${sink.token}`,
    'user-agent': 'diffusion-error-sink',
  };

  /*
   * ASK BEFORE OPENING. The per-process ceilings above cannot see another
   * serverless instance, so this is the only dedupe that holds across cold
   * starts: search the repo's OPEN issues for the fingerprint, which is in the
   * title precisely so it can be searched for.
   *
   * A failed search is not a reason to give up — it is a reason to open the
   * issue anyway. A duplicate issue is a nuisance; a missing report is the
   * problem this whole file exists for.
   */
  try {
    const q = encodeURIComponent(`repo:${sink.repo} is:issue is:open in:title ${report.fingerprint}`);
    const found = await transport.fetch(`${api}/search/issues?q=${q}&per_page=1`, { headers, signal });
    if (found.ok) {
      const json = await found.json();
      if (json?.total_count > 0) return { delivered: false, reason: 'already open', via: 'github' };
    }
  } catch {
    /* fall through and open it */
  }

  const response = await transport.fetch(`${api}/repos/${sink.repo}/issues`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ title: titleOf(report), body: bodyOf(report), labels: ['production-500'] }),
    signal,
  });
  return response.ok ? { delivered: true, via: 'github' } : { delivered: false, reason: `github ${response.status}` };
}

/**
 * Record a server error somewhere durable.
 *
 * Returns `null` — synchronously — when there is nothing to wait for: no sink
 * configured, or this fault already reported. That is the fast path and it is
 * the one taken on almost every call, which is what makes awaiting the other
 * path affordable.
 *
 * Otherwise returns a promise that RESOLVES, always, to `{ delivered, … }`.
 * It has no rejection state. A caller may await it and needs no catch; a caller
 * who ignores it leaks nothing.
 *
 * @returns {Promise<{delivered: boolean, reason?: string, via?: string}>|null}
 */
export function reportServerError({ error, method, path, commit } = {}) {
  let report;
  let sink;
  try {
    sink = readSink();
    if (!sink) return null;
    const now = Date.now();
    report = buildReport({ error, method, path, commit, now });
    const refused = claimSlot(report.fingerprint, now);
    if (refused) return null;
  } catch {
    // Building the report is the last thing that may fail synchronously. If it
    // does, there is nothing to send and nothing to report it to.
    return null;
  }

  return deliver(sink, report).then(
    (result) => result,
    (cause) => ({ delivered: false, reason: `sink failed: ${cause?.name ?? 'error'}` })
  );
}

/**
 * What the sink is, without saying what it is configured WITH.
 *
 * `/healthz` reports this so a deploy can be asked whether errors have anywhere
 * to go, which is the only way to notice that the answer is "no" before the
 * outage rather than after it. It names the kind and never the URL, the repo or
 * the token — a health endpoint is public.
 */
export function describeErrorSink() {
  try {
    const sink = readSink();
    return { configured: Boolean(sink), kind: sink?.kind ?? null };
  } catch {
    return { configured: false, kind: null };
  }
}

/** Test seam. Not for application code. */
export const __testing = {
  transport,
  reset() {
    windowStart = 0;
    windowCount = 0;
    lastSeen.clear();
  },
  /*
   * Roll the 10-minute window WITHOUT clearing what has been seen — which is
   * what the passage of time does, and the only way a test can reach the
   * `MAX_TRACKED_FINGERPRINTS` guard.
   *
   * WHY THIS SEAM HAD TO EXIST. `claimSlot` refuses on "window full" BEFORE it
   * records anything, so inside one window at most WINDOW_MAX (5) fingerprints
   * are ever tracked. A test that loops 250 distinct faults in one window
   * therefore ends with 5 tracked, and asserting `tracked <= 200` passes
   * whether the guard is there or not — verified by deleting the guard and
   * watching the suite stay green. The map only grows across windows: five more
   * entries every ten minutes, forever, in a process that stays up. That is the
   * leak, and this is what lets a test produce it in milliseconds.
   */
  rollWindow() {
    windowStart = 0;
    windowCount = 0;
  },
  state: () => ({ windowCount, tracked: lastSeen.size }),
  WINDOW_MAX,
  MAX_TRACKED_FINGERPRINTS,
};
