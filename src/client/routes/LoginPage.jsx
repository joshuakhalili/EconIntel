import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { RiGithubFill, RiArrowRightLine } from '@remixicon/react';
import { useMe } from '@/hooks/queries';
import { safeNextPath } from '@/lib/api';
import { usePageTitle } from '@/components/chrome/AppShell';

/**
 * Sign in.
 *
 * Reading Diffusion needs a free account. The reason is not to restrict access
 * — the data is public and stays public — it is to know who the work reaches.
 * That reasoning is on the page rather than buried in a privacy policy, because
 * a site that asks for an address and is vague about why has not really asked.
 *
 * **No password, by either route.** A name and an email is enough; GitHub is
 * there for anyone who would rather not hand over an address to a stranger.
 * What the site keeps is listed below in full.
 */
export default function LoginPage() {
  const [params] = useSearchParams();
  const { data } = useMe();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState(null);

  const reader = data?.reader;
  const error = formError ?? params.get('error');

  /*
   * Where the reader was before the 401 sent them here — see `safeNextPath`
   * in lib/api.js, which is also what wrote this parameter. Anything that is
   * not a same-site path falls back to the overview rather than being
   * followed, so a crafted `?next=//somewhere-else` cannot use this page as a
   * redirector.
   */
  const next = safeNextPath(params.get('next'));

  usePageTitle('Sign in');

  async function onSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setFormError(null);
    try {
      const response = await fetch('/auth/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error ?? 'Could not sign you in.');
      // Every query was fetched as a signed-out reader; drop the lot rather
      // than reasoning about which ones are now different.
      await queryClient.invalidateQueries();
      window.location.assign(next);
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="relative -mx-4 overflow-hidden rounded-3xl sm:-mx-6">
      <div className="gradient-band absolute inset-0" aria-hidden />
      <div className="starfield absolute inset-0 opacity-60" aria-hidden />

      <div className="relative mx-auto max-w-xl px-6 py-20 sm:px-10 sm:py-24">
        <p className="eyebrow">Free account</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,3rem)] leading-[1.08] text-text-primary">
          {reader ? `Signed in as ${reader.name ?? reader.handle}` : 'Sign in to read the data'}
        </h1>

        {reader ? (
          <>
            <p className="prose-measure mt-4 text-headline-regular text-text-secondary">
              You have access to every lens, every question and the full series catalogue.
            </p>
            <a
              href={next}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-caption-1-medium text-page transition-opacity hover:opacity-90"
            >
              {next === '/overview' ? 'Start reading' : 'Back to the page you were sent'}
              <RiArrowRightLine className="size-4" aria-hidden />
            </a>
          </>
        ) : (
          <>
            <p className="prose-measure mt-4 text-headline-regular text-text-secondary">
              Free, and it stays free. No password — a name and an email is all it takes.
            </p>

            {error && (
              <p className="mt-6 rounded-2xl border border-warn/40 bg-panel p-4 text-body-regular text-warn">
                {error}
              </p>
            )}

            <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Name</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="rounded-2xl border border-border-button-default bg-panel px-4 py-3 text-body-regular text-text-primary outline-none tint placeholder:text-text-tertiary focus:border-signal"
                  placeholder="Jane Okonjo"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="eyebrow">Email</span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  className="rounded-2xl border border-border-button-default bg-panel px-4 py-3 text-body-regular text-text-primary outline-none tint placeholder:text-text-tertiary focus:border-signal"
                  placeholder="jane@university.edu"
                />
              </label>

              <button
                type="submit"
                disabled={busy}
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-caption-1-medium text-page transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Signing you in…' : 'Continue'}
                {!busy && <RiArrowRightLine className="size-4" aria-hidden />}
              </button>
            </form>

            {data?.githubAvailable && (
              <>
                <div className="my-6 flex items-center gap-4">
                  <span className="h-px flex-1 bg-border-button-default" />
                  <span className="text-caption-1-regular text-text-tertiary">or</span>
                  <span className="h-px flex-1 bg-border-button-default" />
                </div>

                {/* A plain anchor, not a Link: this leaves the SPA for a server
                    route that redirects to GitHub, and the router must not
                    intercept it. */}
                <a
                  href="/auth/github"
                  className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-border-button-default px-5 py-3 text-caption-1-medium text-text-primary tint hover:bg-white/5"
                >
                  <RiGithubFill className="size-5" aria-hidden />
                  Continue with GitHub
                </a>
              </>
            )}

            <div className="mt-10 border-t border-border-button-default pt-6">
              <p className="eyebrow">What this takes, in full</p>
              <ul className="mt-3 flex flex-col gap-2 text-body-regular text-text-secondary">
                <li>Your name and email address. Nothing else.</li>
                <li>
                  <span className="text-text-primary">No password</span>, ever — there is nothing
                  here to leak.
                </li>
                <li>No tracking, no read history, no IP logging.</li>
                <li>
                  The address is not verified, so this is a record of who reads rather than a
                  security check. It is not used to protect anything, because none of the data
                  behind it is private.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
