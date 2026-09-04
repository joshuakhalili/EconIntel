import crypto from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db/pool.js';

/**
 * Sign-in, two ways, without ever holding a credential.
 *
 * WHY IT WORKS THIS WAY
 *
 * Reading Diffusion requires a free account, so this codebase has to know who
 * someone is. **No password is accepted, stored or hashed anywhere in this
 * project**, by either route, so there is nothing here an attacker could steal
 * and replay against another site.
 *
 *   EMAIL   a name and an address, unverified. This is not authentication —
 *           nobody proves they own the address — and it is not meant to be.
 *           It identifies a reader the way a guestbook does, which is the
 *           point: the data behind it is public, and the account exists to
 *           count readers rather than to protect anything. Most of the
 *           intended audience are economists and students, and requiring a
 *           developer account would filter the readership to developers.
 *
 *   GITHUB  a real verified identity, for anyone who prefers it. The one-time
 *           code is exchanged server-side, the profile read once, and the
 *           token discarded — never stored.
 *
 * The database is what keeps the unverified route safe:
 * `readers_editor_must_be_verified` refuses `is_editor` on anything but a
 * GitHub identity, so an account made by typing an address into a form can
 * never do anything.
 *
 * SESSIONS ARE SIGNED COOKIES, NOT ROWS
 *
 * A session is `readerId.expiry.hmac`, verified with a secret. No session table
 * to grow or leak, and no lookup on every request. The trade is that individual
 * sessions cannot be revoked without rotating the secret and signing everyone
 * out — acceptable for a project with one operator, and stated rather than
 * discovered later.
 *
 * THE TWO THINGS THAT MAKE THIS SAFE RATHER THAN JUST SHORT
 *
 * 1. The OAuth `state` parameter is generated, stored in its own short-lived
 *    signed cookie, and required to match on return. Without it anyone can
 *    start a login on a victim's behalf and land them logged in as the
 *    attacker — login CSRF, and it is the standard hole in hand-rolled OAuth.
 *
 * 2. Every comparison of a secret uses `timingSafeEqual`. A plain `===` on an
 *    HMAC leaks the correct value a byte at a time to anyone patient.
 *
 * `STATUS.md` records that CORS is wide open *because* there was no auth. That
 * is no longer true, so `app.js` narrows it to an allowlist the moment this is
 * wired in — open CORS plus a cookie is how a read-only API becomes a CSRF
 * hole. (This used to name `index.js`, which is 45 lines of listener and has
 * never contained a CORS call.)
 */

const SESSION_COOKIE = 'diffusion_session';
const STATE_COOKIE = 'diffusion_oauth_state';

/** Sessions last a fortnight. Long enough not to nag, short enough to bound a leak. */
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** The handshake should take seconds. Ten minutes is generous already. */
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * The shortest secret this project will sign with, and the one number that
 * decides whether sign-in exists at all.
 *
 * It is a named constant rather than a literal in two places because those two
 * places disagreeing is the exact bug this fixes: `secret()` refused anything
 * under 32 characters while `isConfigured()` only asked whether the variable
 * was truthy. Set SESSION_SECRET to "dev" and the result was a site that
 * looked entirely healthy — /healthz green, smoke suite green — with the API
 * gate switched ON and every single sign-in attempt throwing a 500. Sealed
 * shut, silently, with nothing in the logs that named the cause.
 *
 * 32 is not arbitrary: an HMAC-SHA256 key shorter than its 256-bit output adds
 * no strength, and `openssl rand -hex 32` is the command in the error message.
 */
const MIN_SECRET_LENGTH = 32;

/** Whether the configured secret is long enough to sign with. */
function usableSecret() {
  const value = config.auth?.sessionSecret;
  return typeof value === 'string' && value.length >= MIN_SECRET_LENGTH;
}

function secret() {
  if (!usableSecret()) {
    throw new Error(
      `SESSION_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters. ` +
        'Generate one with: openssl rand -hex 32'
    );
  }
  return config.auth.sessionSecret;
}

function sign(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/** Constant-time compare that cannot throw on a length mismatch. */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/** `value.expiry.signature` — the shape both cookies use. */
function seal(value, ttlMs) {
  const expires = Date.now() + ttlMs;
  const body = `${value}.${expires}`;
  return `${body}.${sign(body)}`;
}

function unseal(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [value, expires, signature] = parts;
  if (!safeEqual(signature, sign(`${value}.${expires}`))) return null;
  if (!Number.isFinite(Number(expires)) || Number(expires) < Date.now()) return null;
  return value;
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true, // never readable by script, so an XSS cannot lift it
    sameSite: 'lax', // survives the OAuth redirect back; blocks cross-site POST
    secure: config.env === 'production',
    path: '/',
    maxAge: maxAgeMs,
  };
}

/** GitHub is available as a sign-in option. Email works without it. */
export function githubConfigured() {
  return Boolean(config.auth?.githubClientId && config.auth?.githubClientSecret);
}

/**
 * Whether sign-in is switched on at all.
 *
 * Keyed on the session secret rather than on GitHub, because email sign-in
 * needs no OAuth app and would otherwise leave the API open on a server that
 * can perfectly well authenticate people.
 *
 * It asks the SAME question `secret()` does, deliberately. A secret that is
 * present but too short cannot sign a cookie, so a server holding one cannot
 * sign anybody in — and answering "configured" for it turns the API gate on in
 * front of a login route that can only ever throw. The two states this can
 * report are "sign-in works" and "sign-in is off and the site is open"; there
 * is no third state where the gate is armed and the door is broken.
 */
export function isConfigured() {
  return usableSecret();
}

/**
 * Step one: send the reader to GitHub with a state we can recognise on return.
 */
export function beginLogin(req, res) {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, seal(state, STATE_TTL_MS), cookieOptions(STATE_TTL_MS));

  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', config.auth.githubClientId);
  url.searchParams.set('redirect_uri', callbackUrl(req));
  // `user:email` only. Never `repo`, never `read:org` — this needs a name and
  // an address and has no business being able to read anyone's code.
  url.searchParams.set('scope', 'read:user user:email');
  url.searchParams.set('state', state);

  res.redirect(url.toString());
}

function callbackUrl(req) {
  const configured = config.auth?.callbackUrl;
  if (configured) return configured;
  // Derived from the request in development so this works without extra setup.
  const proto = req.headers['x-forwarded-proto'] ?? req.protocol;
  return `${proto}://${req.get('host')}/auth/github/callback`;
}

/**
 * Step two: verify state, exchange the code, upsert the reader, set the session.
 * Returns the reader, or throws with a message safe to show.
 */
export async function completeLogin(req, res) {
  const expected = unseal(req.cookies?.[STATE_COOKIE]);
  res.clearCookie(STATE_COOKIE, { path: '/' });

  if (!expected || !req.query.state || !safeEqual(req.query.state, expected)) {
    throw new Error('Sign-in could not be verified. Start again from the login page.');
  }
  if (!req.query.code) throw new Error('GitHub did not return an authorisation code.');

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.auth.githubClientId,
      client_secret: config.auth.githubClientSecret,
      code: req.query.code,
      redirect_uri: callbackUrl(req),
    }),
  });

  const token = await tokenResponse.json();
  if (!token?.access_token) throw new Error('GitHub declined the sign-in.');

  const headers = {
    Authorization: `Bearer ${token.access_token}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'Diffusion (+https://github.com/joshuakhalili/EconIntel)',
  };

  const profile = await (await fetch('https://api.github.com/user', { headers })).json();
  if (!profile?.id) throw new Error('Could not read your GitHub profile.');

  // A private primary email is not on /user, so ask for it separately. This is
  // the only reason `user:email` is requested.
  let email = profile.email ?? null;
  if (!email) {
    const emails = await (await fetch('https://api.github.com/user/emails', { headers })).json();
    if (Array.isArray(emails)) {
      email = emails.find((e) => e.primary && e.verified)?.email ?? null;
    }
  }

  // The token has done its only job. It is not stored and goes out of scope here.

  /*
   * A first-time GitHub reader may already exist as an unverified email row —
   * they signed in with the address once, and are now signing in properly.
   * ON CONFLICT (github_id) does not see that, and the unique email index
   * would reject the insert. Upgrade the existing row instead, which also
   * means their record is not duplicated.
   */
  if (email) {
    await query(
      `UPDATE readers
          SET github_id = $1, handle = $2, name = COALESCE($3, name),
              avatar_url = $4, identity = 'github', last_seen_at = now()
        WHERE lower(email) = lower($5) AND github_id IS NULL`,
      [profile.id, profile.login, profile.name ?? profile.login, profile.avatar_url ?? null, email]
    );
  }

  const { rows } = await query(
    `INSERT INTO readers (github_id, handle, name, email, avatar_url, identity)
          VALUES ($1, $2, $3, $4, $5, 'github')
     ON CONFLICT (github_id) DO UPDATE
            SET handle = EXCLUDED.handle,
                name = EXCLUDED.name,
                email = COALESCE(EXCLUDED.email, readers.email),
                avatar_url = EXCLUDED.avatar_url,
                identity = 'github',
                last_seen_at = now()
      RETURNING id, handle, name, email, avatar_url, is_editor, identity`,
    [profile.id, profile.login, profile.name ?? profile.login, email, profile.avatar_url ?? null]
  );

  const reader = rows[0];
  res.cookie(SESSION_COOKIE, seal(reader.id, SESSION_TTL_MS), cookieOptions(SESSION_TTL_MS));
  return reader;
}

/**
 * Sign in with a name and an email address. No password, and no verification.
 *
 * This is deliberately not authentication. Nobody proves they own the address,
 * so it identifies a reader the way a guestbook does — which is exactly what is
 * wanted, because the data behind it is public and the account exists to count
 * readers rather than to protect anything.
 *
 * What keeps it safe is that an account created this way can never DO anything:
 * `readers_editor_must_be_verified` in the database refuses `is_editor` on any
 * identity other than 'github'. Without that, typing the operator's address
 * into this form would hand over the ability to rewrite the site's claims.
 */
export async function signInWithEmail(res, { name, email }) {
  const cleanEmail = String(email ?? '').trim().toLowerCase();
  const cleanName = String(name ?? '').trim();

  // Deliberately permissive. This is a readership record, and a regex that
  // rejects a real address is a worse failure than one that accepts a fake.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('That does not look like an email address.');
  }
  if (cleanName.length < 1 || cleanName.length > 120) {
    throw new Error('Please give a name to go with it.');
  }

  const { rows } = await query(
    `INSERT INTO readers (name, email, identity)
          VALUES ($1, $2, 'email')
     ON CONFLICT (lower(email)) WHERE email IS NOT NULL DO UPDATE
            SET name = EXCLUDED.name,
                last_seen_at = now()
      RETURNING id, handle, name, email, avatar_url, is_editor, identity`,
    [cleanName, cleanEmail]
  );

  const reader = rows[0];
  res.cookie(SESSION_COOKIE, seal(reader.id, SESSION_TTL_MS), cookieOptions(SESSION_TTL_MS));
  return reader;
}

export function logout(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/**
 * How stale `last_seen_at` is allowed to get before a read turns into a write.
 *
 * An hour, because of what the column is FOR: it answers "is this reader still
 * around", on a page that groups readers by day. Nothing in the project reads
 * it at finer resolution than that, so a value up to an hour old is the same
 * answer as a fresh one — and one write per reader per hour is roughly three
 * orders of magnitude fewer than one per request.
 */
const LAST_SEEN_STALE_MS = 60 * 60 * 1000;

/**
 * The reader on this request, or null. Reads one row — cheap, and it means a
 * reader deleted from the database stops being able to read on their next
 * request rather than when their cookie happens to expire.
 *
 * WHY THE COMMON PATH IS A SELECT AND NOT AN UPDATE ... RETURNING
 *
 * It was an UPDATE, which fetched the row and refreshed `last_seen_at` in one
 * statement. Tidy, and wrong for where this runs. Every `/api/*` request goes
 * through the gate, and `/api/me` fires on every page load whether or not
 * anyone is signed in, so an unconditional UPDATE made a WRITE TRANSACTION out
 * of loading the dashboard — one per widget, since the overview fans out into
 * several parallel fetches.
 *
 * On Neon's pooler that is not merely an extra millisecond. A write pins the
 * request to the primary and defeats read routing entirely, so the endpoint
 * that exists to answer "who am I" from a cookie was the thing forcing every
 * page load onto the write path. It also takes a row lock on a row several
 * concurrent requests from the same reader all want.
 *
 * So: read the row, and only write when the timestamp is actually stale. The
 * write is awaited rather than left floating — a serverless function can be
 * frozen the moment its handler returns, which kills an un-awaited query
 * mid-flight and surfaces as an unhandled rejection rather than as a lost
 * write. Once an hour per reader, that latency is not worth the risk.
 */
export async function currentReader(req) {
  const id = unseal(req.cookies?.[SESSION_COOKIE]);
  if (!id) return null;

  const { rows } = await query(
    `SELECT id, handle, name, email, avatar_url, is_editor, identity, last_seen_at
       FROM readers
      WHERE id = $1`,
    [id]
  );

  const reader = rows[0];
  if (!reader) return null;

  const lastSeen = reader.last_seen_at ? new Date(reader.last_seen_at).getTime() : 0;
  if (!Number.isFinite(lastSeen) || Date.now() - lastSeen > LAST_SEEN_STALE_MS) {
    await query('UPDATE readers SET last_seen_at = now() WHERE id = $1', [id]);
  }

  // `last_seen_at` was fetched to make that decision, not to be published. The
  // caller's contract is the columns the UPDATE ... RETURNING used to hand
  // back, and /api/me serialises this object straight to the browser.
  const { last_seen_at: _lastSeenAt, ...publicFields } = reader;
  return publicFields;
}

/**
 * Gate for the data API.
 *
 * Returns 401 with a JSON body rather than redirecting, because every caller is
 * `fetch` from the client and a redirect to an HTML page would arrive as an
 * unparseable response rather than as a clear "you are signed out".
 */
export function requireReader() {
  // Named rather than anonymous: this is the layer whose POSITION in the
  // middleware stack is load-bearing — everything registered after it needs an
  // account and everything before it does not — and a stack of anonymous arrows
  // can only be identified by guessing at its mount path. A test that has to
  // guess which layer is the gate is a test that quietly stops checking the
  // moment another /api middleware is added in front of it.
  return async function requireReader(req, res, next) {
    // Without credentials configured there is nothing to sign in with, and
    // locking everyone out of a public dashboard is the worse failure.
    if (!isConfigured()) return next();

    const reader = await currentReader(req);
    if (!reader) {
      return res.status(401).json({
        error: 'Sign in to read the data',
        signInUrl: '/login',
      });
    }
    req.reader = reader;
    return next();
  };
}
