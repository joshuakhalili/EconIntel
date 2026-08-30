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

/**
 * Everything that is not an argument, behind one menu.
 *
 * The bar used to carry four flat links, one of which said "Sources" and went
 * to the ingestion-status page. Now there are two menus and nothing else:
 * Lenses, which is the writing, and Sources, which is where it came from.
 *
 * "Build a chart" is gone from here. The route still works and the builder is
 * still reachable at /explore — it is simply not offered to a reader who has
 * not asked for it. There is no auth gate: it runs read-only queries against
 * data that is already public.
 */
const SOURCE_LINKS = [
  { to: '/data', label: 'The data', note: 'Every series, with its licence and publisher' },
  { to: '/news', label: 'News', note: 'What is being reported, scored for relevance' },
  { to: '/pipeline', label: 'Status', note: 'What ran, what is stale, what is broken' },
];

/** Travel in the new direction before the bar commits to hiding or showing. */
const DIRECTION_THRESHOLD = 6;

export default function TopNav() {
  const { data: lenses } = useLenses();
  const { data: me } = useMe();
  const { pathname } = useLocation();

  const [hidden, setHidden] = useState(false);
  // One menu at a time. A single id rather than a boolean per menu, so opening
  // Sources closes Lenses without either having to know about the other.
  const [openMenu, setOpenMenu] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const lastY = useRef(0);
  const navRef = useRef(null);

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
    setOpenMenu(null);
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!openMenu && !menuOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
        setMenuOpen(false);
      }
    }
    function onClick(e) {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenMenu(null);
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onClick);
    };
  }, [openMenu, menuOpen]);

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

            <nav
              className="hidden flex-1 items-center gap-1 md:flex"
              aria-label="Sections"
              ref={navRef}
            >
              {/* The writing. Question counts used to sit beside each name and
                  were dropped: a reader choosing a perspective does not care
                  that one has three questions and another has four, and a
                  column of small numbers in a menu reads as clutter. The
                  subtitle says what the lens is about, which is the thing they
                  are actually choosing between. */}
              <Menu
                label="Lenses"
                open={openMenu === 'lenses'}
                onToggle={() => setOpenMenu((o) => (o === 'lenses' ? null : 'lenses'))}
                active={pathname.startsWith('/lens') || pathname.startsWith('/q/')}
                width="w-80"
              >
                {(lenses ?? []).map((lens) => (
                  <MenuLink
                    key={lens.id}
                    to={`/lens/${lens.slug}`}
                    label={lens.name}
                    note={lens.subtitle}
                  />
                ))}
              </Menu>

              {/* Where it came from. */}
              <Menu
                label="Sources"
                open={openMenu === 'sources'}
                onToggle={() => setOpenMenu((o) => (o === 'sources' ? null : 'sources'))}
                active={SOURCE_LINKS.some((l) => pathname.startsWith(l.to))}
                width="w-80"
              >
                {SOURCE_LINKS.map((link) => (
                  <MenuLink key={link.to} to={link.to} label={link.label} note={link.note} />
                ))}
              </Menu>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {/* Sign-in state. Only shown once /api/me has answered, so a
                  signed-in reader never sees "Sign in" flash first. */}
              {me?.reader ? (
                <Link
                  to="/overview"
                  className="hidden items-center gap-2 rounded-full border border-border-button-default px-3 py-1.5 text-caption-1-medium text-text-secondary tint hover:text-text-primary sm:flex"
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
                className="grid size-9 place-items-center rounded-full text-text-secondary tint hover:bg-white/10 md:hidden"
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
                className="tint block rounded-xl px-3 py-2.5 hover:bg-white/5"
              >
                <span className="block text-body-regular text-text-primary">{lens.name}</span>
                {lens.subtitle && (
                  <span className="block text-caption-1-regular text-text-tertiary">
                    {lens.subtitle}
                  </span>
                )}
              </NavLink>
            ))}
            <p className="eyebrow px-3 pb-1 pt-3">Sources</p>
            {[{ to: '/overview', label: 'Overview' }, ...SOURCE_LINKS].map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className="tint block rounded-xl px-3 py-2.5 text-body-regular text-text-primary hover:bg-white/5"
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

/**
 * A nav menu. Two exist — Lenses and Sources — and they behave identically, so
 * they are one component rather than two hand-rolled dropdowns that drift.
 *
 * Not built on the vendored react-aria `Dropdown`: that component's own
 * comment records that its scroll lock "visibly yanks sticky layout", which is
 * exactly wrong for a menu hanging off a bar that is already fixed and already
 * hides on scroll. The dismiss handling this needs lives in the parent, where
 * one listener covers both menus.
 */
function Menu({ label, open, onToggle, active, width = 'w-72', children }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`tint flex items-center gap-1 rounded-full px-3 py-1.5 text-caption-1-medium ${
          active ? 'text-signal' : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        {label}
        <RiArrowDownSLine
          className={`size-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div
          className={`sheet-in absolute left-0 top-full mt-2 ${width} origin-top overflow-hidden rounded-2xl border border-border-button-default bg-panel/95 p-1.5 shadow-2xl backdrop-blur-md`}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * One row in a menu: what it is, and one line on what you get.
 *
 * The note is what replaced the question count. A number told a reader nothing
 * they could choose on; a sentence tells them which perspective they want.
 */
function MenuLink({ to, label, note }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `tint block rounded-xl px-3 py-2.5 ${
          isActive ? 'bg-white/10' : 'hover:bg-white/5'
        }`
      }
    >
      <span className="block text-caption-1-medium text-text-primary">{label}</span>
      {note && (
        <span className="mt-0.5 block text-caption-1-regular leading-snug text-text-tertiary">
          {note}
        </span>
      )}
    </NavLink>
  );
}
