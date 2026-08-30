-- ============================================================================
-- 0016_readers.sql — who is reading
--
-- WHY
--
-- Reading Diffusion now requires an account. It is free and anyone can make
-- one; the point is not to restrict access but to know who the work reaches,
-- and to have somewhere to put the reviewer role that the editorial layer
-- needs — someone has to be able to mark an extracted takeaway as checked, and
-- "a person verified this" is meaningless if there is no record of which
-- person.
--
-- Identity comes from GitHub OAuth. **No password is ever stored, hashed or
-- transmitted here**, because this codebase should not be in the business of
-- holding credentials. GitHub returns a stable numeric id, a display name and
-- an email; that is the whole record.
--
-- WHAT IS DELIBERATELY NOT STORED
--
-- No access token. The OAuth token is used once, server-side, to read the
-- profile and is then discarded. Storing it would mean holding a credential
-- that can act on the reader's GitHub account, to enable nothing this site
-- does.
--
-- No session table. Sessions are signed cookies carrying the reader id and an
-- expiry, verified with an HMAC, so there is no server state to grow, expire or
-- leak. Revocation is by rotating the signing secret, which is the accepted
-- trade for one-person infrastructure.
--
-- No IP address, user agent or read history. None of it is needed to run this
-- and all of it is a liability under GDPR for a project whose readers are
-- largely European academics.
-- ============================================================================

CREATE TABLE readers (
  id          BIGSERIAL PRIMARY KEY,

  /* GitHub's numeric user id. Stable across username changes, which a login
     keyed on the handle would not be. */
  github_id   BIGINT NOT NULL UNIQUE,
  handle      TEXT   NOT NULL,

  name        TEXT,
  /* Nullable: GitHub only returns an email when the account has a public one
     or grants user:email, and an account is still valid without it. */
  email       TEXT,
  avatar_url  TEXT,

  /* Whether this reader may edit editorial content — promote an extracted
     takeaway to reviewed, correct prose. Granted by hand in SQL, never by
     anything the application exposes. */
  is_editor   BOOLEAN NOT NULL DEFAULT FALSE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE readers IS
  'People with an account. Identity via GitHub OAuth; no credential of any '
  'kind is stored here.';

COMMENT ON COLUMN readers.is_editor IS
  'Granted by hand in SQL. Nothing in the application can set this — an '
  'editor flag that a request can raise is not a permission, it is a bug.';

CREATE INDEX readers_recent_idx ON readers (last_seen_at DESC);
