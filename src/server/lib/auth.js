import crypto from 'node:crypto';
import { config } from '../config.js';
import { query } from '../db/pool.js';

/**
 * Sign-in, via GitHub, without ever holding a credential.
 *
 * WHY IT WORKS THIS WAY
 *
 * Reading Diffusion requires a free account. That means this codebase has to
 * know who someone is, and the safest way to know that is to never learn a
 * secret in the first place. GitHub does the authenticating; this file receives
 * a one-time code, exchanges it server-side for a token, reads the profile
 * once, and throws the token away. No password is accepted, stored or hashed
 * anywhere in this project, and there is nothing in the database an attacker
 * could steal and replay against another site.
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
 * is no longer true, so `index.js` narrows it to an allowlist the moment this
 * is wired in — open CORS plus a cookie is how a read-only API becomes a CSRF
 * hole.
 */

const SESSION_COOKIE = 'diffusion_session';
const STATE_COOKIE = 'diffusion_oauth_state';

/** Sessions last a fortnight. Long enough not to nag, short enough to bound a leak. */
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** The handshake should take seconds. Ten minutes is generous already. */
const STATE_TTL_MS = 10 * 60 * 1000;

function secret() {
  const value = config.auth?.sessionSecret;
  if (!value || value.length < 32) {
    throw new Error(
      'SESSION_SECRET must be set and at least 32 characters. ' +
        'Generate one with: openssl rand -hex 32'
    );
  }
  return value;
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

export function isConfigured() {
  return Boolean(config.auth?.githubClientId && config.auth?.githubClientSecret);
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

  const { rows } = await query(
    `INSERT INTO readers (github_id, handle, name, email, avatar_url)
          VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (github_id) DO UPDATE
            SET handle = EXCLUDED.handle,
                name = EXCLUDED.name,
                email = COALESCE(EXCLUDED.email, readers.email),
                avatar_url = EXCLUDED.avatar_url,
                last_seen_at = now()
      RETURNING id, handle, name, email, avatar_url, is_editor`,
    [profile.id, profile.login, profile.name ?? profile.login, email, profile.avatar_url ?? null]
  );

  const reader = rows[0];
  res.cookie(SESSION_COOKIE, seal(reader.id, SESSION_TTL_MS), cookieOptions(SESSION_TTL_MS));
  return reader;
}

export function logout(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

/**
 * The reader on this request, or null. Reads one row — cheap, and it means a
 * reader deleted from the database stops being able to read on their next
 * request rather than when their cookie happens to expire.
 */
export async function currentReader(req) {
  const id = unseal(req.cookies?.[SESSION_COOKIE]);
  if (!id) return null;

  const { rows } = await query(
    `UPDATE readers SET last_seen_at = now()
      WHERE id = $1
  RETURNING id, handle, name, email, avatar_url, is_editor`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Gate for the data API.
 *
 * Returns 401 with a JSON body rather than redirecting, because every caller is
 * `fetch` from the client and a redirect to an HTML page would arrive as an
 * unparseable response rather than as a clear "you are signed out".
 */
export function requireReader() {
  return async (req, res, next) => {
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
