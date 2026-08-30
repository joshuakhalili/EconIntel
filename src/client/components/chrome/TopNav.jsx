import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { RiArrowDownSLine, RiCloseLine, RiMenuLine } from '@remixicon/react';
import { useLenses, useMe } from '@/hooks/queries';

/**
 * Website navigation, not app navigation.
 *
 * This replaces a fixed 232px sidebar and a mobile bottom tab bar. Both are
 * dashboard conventions, and they framed a publication as a tool — a reader
 * arriving at an article met a control surface first and the writing second.
 *
 * The shape is the landing page's header: a slim blurred bar, wordmark left,
 * links right, one filled call to action. Crossing from the landing page into
 * a lens should not feel like entering a different product.
 *
 * It hides on scroll down and returns on scroll up, which the landing page also
 * does. On a page that is mostly long-form prose the nav is in the way while
 * reading and wanted the moment you look for it.
 */

const LINKS = [
  { to: '/data', label: 'The data' },
  { to: '/explore', label: 'Build a chart' },
  { to: '/news', label: 'News' },
  { to: '/pipeline', label: 'Sources' },
];

/** Travel in the new direction before the bar commits to hiding or showing. */
const DIRECTION_THRESHOLD = 6;

export default function TopNav() {
  const { data: lenses } = useLenses();
  const { data: me } = useMe();
  const { pathname } = useLocation();

  const [hidden, setHidden] = useState(false);
  const [lensOpen, setLensOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastY = useRef(0);
  const lensRef = useRef(null);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < DIRECTION_THRESHOLD) return;
      // Never hide at the very top: a bar that vanishes on a short bounce at
      // the top of the page reads as a glitch rather than as a behaviour.
      setHidden(delta > 0 && y > 80);
      lastY.current = y;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Any navigation closes everything. Without this the lens menu stays open
  // over the page you just asked it for.
  useEffect(() => {
    setLensOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!lensOpen && !menuOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        setLensOpen(false);
        setMenuOpen(false);
      }
    }
    function onClick(e) {
      if (lensRef.current && !lensRef.current.contains(e.target)) setLensOpen(false);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onClick);
    };
  }, [lensOpen, menuOpen]);

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-transform duration-300 ease-out ${
          hidden ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-1 items-center gap-6 rounded-full border border-border-button-default bg-panel/70 px-4 py-2 backdrop-blur-md sm:px-5">
            {/* Home is the landing page, which is served outside this app. A
                plain anchor rather than a Link: the router does not own it. */}
            <a
              href="/"
              className="shrink-0 font-display text-body-medium tracking-tight text-text-primary"
            >
              Diffusion
            </a>

            <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Sections">
              <div className="relative" ref={lensRef}>
                <button
                  type="button"
                  onClick={() => setLensOpen((o) => !o)}
                  aria-expanded={lensOpen}
                  className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-caption-1-medium transition-colors ${
                    pathname.startsWith('/lens') || pathname.startsWith('/q/')
                      ? 'text-signal'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Lenses
                  <RiArrowDownSLine
                    className={`size-3.5 transition-transform ${lensOpen ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>

                {lensOpen && (
                  <div className="absolute left-0 top-full mt-2 w-72 overflow-hidden rounded-2xl border border-border-button-default bg-panel/95 p-1.5 shadow-2xl backdrop-blur-md">
                    {(lenses ?? []).map((lens) => (
                      <NavLink
                        key={lens.id}
                        to={`/lens/${lens.slug}`}
                        className={({ isActive }) =>
                          `flex items-baseline justify-between gap-3 rounded-xl px-3 py-2 transition-colors ${
                            isActive ? 'bg-white/10 text-text-primary' : 'hover:bg-white/5'
                          }`
                        }
                      >
                        <span className="text-caption-1-medium text-text-primary">{lens.name}</span>
                        <span className="figure shrink-0 text-caption-1-regular text-text-tertiary">
                          {lens.question_count}
                        </span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>

              {LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-full px-3 py-1.5 text-caption-1-medium transition-colors ${
                      isActive ? 'text-signal' : 'text-text-secondary hover:text-text-primary'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {/* Sign-in state. Only shown once /api/me has answered, so a
                  signed-in reader never sees "Sign in" flash first. */}
              {me?.reader ? (
                <Link
                  to="/overview"
                  className="hidden items-center gap-2 rounded-full border border-border-button-default px-3 py-1.5 text-caption-1-medium text-text-secondary transition-colors hover:text-text-primary sm:flex"
                >
                  {me.reader.avatar_url && (
                    <img
                      src={me.reader.avatar_url}
                      alt=""
                      className="size-5 rounded-full"
                      width={20}
                      height={20}
                    />
                  )}
                  {/* Name first, handle second. `handle` is a GitHub username
                      and is null for every reader who signed in with an email
                      address — which is most of them — so keying on it alone
                      rendered an empty pill for anyone but a GitHub user. */}
                  {me.reader.name ?? me.reader.handle ?? 'Signed in'}
                </Link>
              ) : me?.authRequired ? (
                <Link
                  to="/login"
                  className="hidden rounded-full bg-white px-4 py-1.5 text-caption-1-medium text-page transition-opacity hover:opacity-90 sm:block"
                >
                  Sign in
                </Link>
              ) : (
                <Link
                  to="/overview"
                  className="hidden rounded-full bg-white px-4 py-1.5 text-caption-1-medium text-page transition-opacity hover:opacity-90 sm:block"
                >
                  Overview
                </Link>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={menuOpen}
                className="grid size-9 place-items-center rounded-full text-text-secondary transition-colors hover:bg-white/10 md:hidden"
              >
                {menuOpen ? (
                  <RiCloseLine className="size-5" aria-hidden />
                ) : (
                  <RiMenuLine className="size-5" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile: a sheet from the top rather than a bottom tab bar. A tab bar
            can hold four items; this site has five lenses and four tools, and
            the previous one silently dropped everything past the fourth. */}
        {menuOpen && (
          <div className="mx-4 mt-1 overflow-hidden rounded-2xl border border-border-button-default bg-panel/95 p-2 backdrop-blur-md md:hidden">
            <p className="eyebrow px-3 pb-1 pt-2">Lenses</p>
            {(lenses ?? []).map((lens) => (
              <NavLink
                key={lens.id}
                to={`/lens/${lens.slug}`}
                className="flex items-baseline justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5"
              >
                <span className="text-body-regular text-text-primary">{lens.name}</span>
                <span className="figure text-caption-1-regular text-text-tertiary">
                  {lens.question_count}
                </span>
              </NavLink>
            ))}
            <p className="eyebrow px-3 pb-1 pt-3">Everything else</p>
            {[{ to: '/', label: 'Overview' }, ...LINKS].map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className="block rounded-xl px-3 py-2.5 text-body-regular text-text-primary hover:bg-white/5"
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        )}
      </header>

      {/* The bar is fixed, so the document needs its height back. */}
      <div className="h-16" aria-hidden />
    </>
  );
}
