import { useSearchParams } from 'react-router-dom';
import { RiGithubFill, RiArrowRightLine } from '@remixicon/react';
import { useMe } from '@/hooks/queries';
import { usePageTitle } from '@/components/chrome/AppShell';

/**
 * Sign in.
 *
 * Reading Diffusion needs an account. It is free, it takes one click, and the
 * reason is not to restrict access — it is to know who the work reaches, and
 * to have somewhere to hang the reviewer role the editorial layer needs. That
 * reasoning is on the page rather than in a privacy policy nobody opens.
 *
 * Identity comes from GitHub, so **no password is ever typed, sent or stored
 * here**. What the site keeps is stated plainly below, because a page that
 * asks for an account and is vague about what it takes has not really asked.
 */
export default function LoginPage() {
  const [params] = useSearchParams();
  const { data } = useMe();
  const error = params.get('error');
  const reader = data?.reader;

  usePageTitle('Sign in');

  return (
    <div className="relative -mx-4 overflow-hidden rounded-3xl sm:-mx-6">
      <div className="gradient-band absolute inset-0" aria-hidden />
      <div className="starfield absolute inset-0 opacity-60" aria-hidden />

      <div className="relative mx-auto max-w-xl px-6 py-20 sm:px-10 sm:py-28">
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
              href="/overview"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-caption-1-medium text-page transition-opacity hover:opacity-90"
            >
              Start reading
              <RiArrowRightLine className="size-4" aria-hidden />
            </a>
          </>
        ) : (
          <>
            <p className="prose-measure mt-4 text-headline-regular text-text-secondary">
              Free, and it stays free. The account exists so I know who the work reaches — not to
              put the data behind a wall.
            </p>

            {error && (
              <p className="mt-6 rounded-2xl border border-warn/40 bg-panel p-4 text-body-regular text-warn">
                {error}
              </p>
            )}

            {/* A plain anchor, not a Link: this leaves the SPA for a server
                route that redirects to GitHub, and the router must not
                intercept it. */}
            <a
              href="/auth/github"
              className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-white px-5 py-3 text-caption-1-medium text-page transition-opacity hover:opacity-90"
            >
              <RiGithubFill className="size-5" aria-hidden />
              Continue with GitHub
            </a>

            <div className="mt-10 border-t border-border-button-default pt-6">
              <p className="eyebrow">What this takes</p>
              <ul className="mt-3 flex flex-col gap-2 text-body-regular text-text-secondary">
                <li>Your name, GitHub handle and email address.</li>
                <li>
                  <span className="text-text-primary">No password</span> — GitHub does the
                  authenticating and none is ever sent here.
                </li>
                <li>
                  The access token is used once to read your profile and then discarded. It is
                  never stored.
                </li>
                <li>No tracking, no read history, no IP logging.</li>
              </ul>
              <p className="prose-measure mt-4 text-caption-1-regular text-text-tertiary">
                GitHub is the only sign-in method today, which does filter out anyone without an
                account. Email sign-in is planned.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
