-- ============================================================================
-- 0017_email_readers.sql — sign in with an email address, no password
--
-- WHY
--
-- 0016 assumed GitHub. Most of the intended readers — economists, students —
-- do not have a GitHub account, so requiring one filters the audience down to
-- developers. Sign-in is now: give a name and an email address. No password is
-- set, sent or stored, and GitHub stays available for anyone who prefers it.
--
-- WHAT THIS IS AND IS NOT
--
-- An unverified email address is **not authentication**. Nobody proves they own
-- it, so it identifies a reader the way a guestbook does: useful for knowing
-- who the work reaches, worthless as a security boundary. That is an acceptable
-- trade here precisely because the data behind it is public — the account
-- exists to count readers, not to protect anything.
--
-- It stops being acceptable the moment an account can DO something. So:
--
--   `is_editor` may only be true for a GitHub-verified reader, enforced by a
--   CHECK constraint rather than by a code path someone can forget.
--
-- Without that, anyone could type the operator's email address, be handed the
-- editor role, and rewrite the site's claims. The constraint is the whole
-- reason this migration is safe.
-- ============================================================================

/* GitHub is now one way in, not the only one. */
ALTER TABLE readers ALTER COLUMN github_id DROP NOT NULL;
ALTER TABLE readers ALTER COLUMN handle DROP NOT NULL;

/* Email becomes an identity in its own right, so it has to be unique and
   present for a reader who has no GitHub id. Case-insensitive: a reader who
   types Joshua@… on Tuesday and joshua@… on Friday is one person, and two rows
   would quietly double the readership count. */
UPDATE readers SET email = lower(email) WHERE email IS NOT NULL;

CREATE UNIQUE INDEX readers_email_uniq ON readers (lower(email))
  WHERE email IS NOT NULL;

ALTER TABLE readers
  ADD CONSTRAINT readers_identified
    CHECK (github_id IS NOT NULL OR email IS NOT NULL);

/**
 * Whether the identity was proved.
 *
 * `github` — GitHub confirmed it. `email` — somebody typed it and nobody
 * checked. Rendered nowhere and used for exactly one thing: gating what an
 * account is allowed to do.
 */
CREATE TYPE reader_identity AS ENUM ('github', 'email');

ALTER TABLE readers
  ADD COLUMN identity reader_identity NOT NULL DEFAULT 'email';

UPDATE readers SET identity = 'github' WHERE github_id IS NOT NULL;

/*
 * The constraint that makes unverified sign-in safe.
 *
 * An editor can promote an extracted takeaway to reviewed — that is, can make
 * the site assert that a person checked a claim. Handing that to whoever types
 * the right address into a form would make every "reviewed" badge meaningless.
 * Enforced in the database because a rule that lives only in application code
 * is one refactor away from not existing.
 */
ALTER TABLE readers
  ADD CONSTRAINT readers_editor_must_be_verified
    CHECK (NOT is_editor OR identity = 'github');

COMMENT ON COLUMN readers.identity IS
  'How the reader was identified. Only a github identity may hold is_editor — '
  'an unverified email is a visitor record, not a credential.';
