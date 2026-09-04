#!/usr/bin/env python3
"""
Click through the site the way a visitor does.

Loading a URL directly proves nothing about navigation: Framer writes RELATIVE
links and resolves them against document.baseURI, so a trailing slash sends the
next hop to the wrong path. A mirror can pass docs/verify.py on every route and
still be unclickable. This is a separate risk and it needs its own check.

  python3 docs/verify-nav.py                 # every route in clone.json,
                                             # then the two links into the app
  python3 docs/verify-nav.py projects blog   # just these mirror hops

Each hop returns home first, so a broken hop cannot cascade. Reads clone.json.

WHY THE TWO APP LINKS ARE CHECKED SEPARATELY
--------------------------------------------
HOPS comes from clone.json's `pages`, which lists what was MIRRORED: /, /thanks,
both legal pages, /404 and /waitlist. /login and /overview are not mirrored
pages — they belong to the React app on the same origin — so they were never in
that list and this check never clicked them. Which is a problem, because those
two links are the ones that keep breaking: the fix has been made once, reverted
once, and made again, and this gate stood beside it passing every time.

THE TRAP, WHICH HAS ALREADY BEEN SPRUNG ONCE HERE. Framer's client router
resolves every href beginning with "/", "." or "#" against its own route table,
and an unmatched internal path does not fall through — it falls back to the home
route. So an anchor written href="/login" renders in the DOM as href="./" and
the sign-in link lands on the front page. A previous attempt at this fix
rebuilt cleanly, produced correct static HTML, and still went to "/" in a
browser. Reading the built file cannot see that. So this check reads the
RENDERED DOM and, more to the point, clicks the link and asserts where the
browser actually ended up — on the origin serving the page, which is what
exercises the runtime interceptor in assets/js/nav.js rather than the href.
"""

import json
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from content_diffusion import APP_ORIGIN, APP_PATHS, LINKS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "clone.json"
if not CONFIG.exists():
    sys.exit("no clone.json, run docs/mirror.py first")
CFG = json.loads(CONFIG.read_text())

PORT = 8511
# hop by path, not by label: labels change with the rebrand, routes do not
# Pages this site deliberately no longer links to. /waitlist carried a live Framer
# form that POSTed reader email addresses to the template author's own account, so
# both it and /thanks were DELETED from the built tree; vercel.json still redirects
# them to /login for the sake of old bookmarks. Nothing on the site should offer
# them any more.
#
# Without this the check graded the fix as the failure: once the calls to action
# stopped going to /waitlist, the /waitlist hop found no link and counted itself
# wrong, on a site that was finally correct. A retired route is checked the other
# way round — an unlinked one passes, and a link to one is the failure.
#
# RETIRED is UNIONED into HOPS rather than filtered out of it, and that is the
# whole point. These paths were dropped from clone.json's `pages` on 4 Sep because
# the directories no longer exist — which, when HOPS came from clone.json alone,
# silently turned this guard into dead code. A guard that stops running when the
# thing it guards is removed is not a guard.
RETIRED = {"waitlist", "thanks"}

HOPS = sys.argv[1:] or sorted(
    {r.strip("/") for r in CFG["pages"] if r not in ("/", "/404")} | RETIRED
)

# The links into the app, by the text a reader actually sees. Unlike the mirror
# hops these are matched BY LABEL, because a reader clicks a word and the whole
# question is whether that word takes them where it says. Both live in the
# footer's "Project" column; content_diffusion.FOOTER is what names them.
#
# The paths are checked against the content map below rather than trusted, so
# this table cannot quietly drift away from the one it is guarding.
APP_HOPS = (
    ("Sign in", "/login"),
    ("The lenses", "/overview"),
    # Added 4 Sep 2026. This one was the reason to widen the gate: /data was linked
    # three times from index.html and was NOT in nav.js's APP_PATHS, so clicking it
    # left the serving origin for production. The gate passed throughout, because it
    # only ever clicked the two links the previous fix was about.
    ("The data", "/data"),
)

for _label, _path in APP_HOPS:
    if _path not in APP_PATHS:
        sys.exit(f"verify-nav.py: {_path} is not in content_diffusion.APP_PATHS, "
                 f"so assets/js/nav.js will not intercept a click on it")
    if APP_ORIGIN + _path not in LINKS.values():
        sys.exit(f"verify-nav.py: nothing in content_diffusion.LINKS points at "
                 f"{APP_ORIGIN + _path}, so no anchor can reach it")


def check_app_links(pg, base):
    """Click the two links into the app and say where the browser ended up."""
    failures = 0
    for label, path in APP_HOPS:
        want = base + path
        pg.goto(base + "/", wait_until="load")
        pg.wait_for_timeout(2000)
        try:
            # The rendered DOM, not the file: Framer rewrites internal hrefs on
            # mount. One copy of the footer is rendered per breakpoint and the
            # hidden ones swallow clicks, so take the first VISIBLE one.
            el = pg.get_by_text(label, exact=True).filter(visible=True).first
            if el.count() == 0:
                failures += 1
                print(f"  NOLINK {label:33} -> no visible link reading {label!r}")
                continue
            href = el.evaluate(
                "e => { const a = e.closest('a'); "
                "return a ? a.getAttribute('href') : null; }")
            el.scroll_into_view_if_needed(timeout=6000)
            pg.wait_for_timeout(400)
            try:
                el.click(timeout=6000)
            except Exception:
                pass          # an off-origin jump can abort; read pg.url anyway
            pg.wait_for_timeout(2500)
            landed = pg.url
            same_origin = landed.startswith(base + "/") or landed == base
            ok = landed.rstrip("/") == want.rstrip("/")
            failures += 0 if ok else 1
            note = "" if same_origin else "  LEFT THE SERVING ORIGIN"
            print(f"  {'ok ' if ok else 'WRONG'} {label:33} -> "
                  f"{landed:52} want {want}{note}")
            print(f"        {'':33}    DOM href={href!r}")
        except Exception as e:
            failures += 1
            print(f"  FAIL  {label:33} -> CLICK FAILED {type(e).__name__}")
    return failures

DIM, RESET = "\033[2m", "\033[0m"


def main():
    srv = subprocess.Popen(["node", str(ROOT / "docs/serve.mjs"), str(PORT)],
                           cwd=ROOT, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    base = f"http://localhost:{PORT}"
    failures = 0
    try:
        with sync_playwright() as p:
            br = p.chromium.launch()
            ctx = br.new_context(viewport={"width": 1440, "height": 900})
            pg = ctx.new_page()
            errs, bad = [], []
            pg.on("console", lambda m: errs.append(m.text)
                  if m.type == "error" else None)
            pg.on("response", lambda r: bad.append(f"{r.status} "
                  f"{r.url.replace(base, '')}") if r.status >= 400 else None)
            for hop in HOPS:
                before = len(errs), len(bad)
                # start from the page a visitor would actually click from: the
                # collection index for a nested route, home for a top-level one.
                # Home usually shows only the first few cards of a collection.
                origin = "/" + hop.rsplit("/", 1)[0] if "/" in hop else "/"
                pg.goto(base + origin, wait_until="load")
                pg.wait_for_timeout(2000)
                try:
                    # click the first VISIBLE anchor pointing at this path, not
                    # the first text match: Framer renders one copy of the nav
                    # per breakpoint and the hidden ones swallow clicks
                    link = pg.locator(
                        f'a[href$="{hop}"], a[href$="{hop}/"]').filter(
                        visible=True).first
                    if link.count() == 0 and hop not in RETIRED:
                        link = pg.get_by_text(hop, exact=False).filter(
                            visible=True).first
                    if hop in RETIRED:
                        linked = link.count() > 0
                        failures += 1 if linked else 0
                        verdict = ("STILL LINKED" if linked else "retired ok  ")
                        note = (f"something on {origin} still offers it" if linked
                                else "nothing links here, as intended")
                        print(f"  {verdict} {hop:27} -> {note}")
                        continue
                    if link.count() == 0:
                        failures += 1
                        print(f"  NOLINK {hop:33} -> nothing on {origin} links here")
                        continue
                    link.scroll_into_view_if_needed(timeout=6000)
                    pg.wait_for_timeout(600)
                    link.click(timeout=6000)
                    pg.wait_for_timeout(2200)
                    landed = pg.url.replace(base, "") or "/"
                    ok = landed.strip("/") == hop.strip("/")
                    failures += 0 if ok else 1
                    h1 = pg.evaluate("(document.querySelector('h1')||{}).innerText||''")
                    print(f"  {'ok ' if ok else 'WRONG'} {hop:34} -> {landed:40} "
                          f"h1={h1.replace(chr(10), ' ')[:30]!r} "
                          f"(+{len(errs)-before[0]} err, +{len(bad)-before[1]} bad)")
                except Exception as e:
                    failures += 1
                    print(f"  FAIL  {hop:34} -> CLICK FAILED {type(e).__name__}")

            # The two links the mirror's own page list can never cover.
            app_failures = 0
            if not sys.argv[1:]:
                print()
                app_failures = check_app_links(pg, base)
                failures += app_failures

            print(f"\n{len(HOPS)} mirror hops + {len(APP_HOPS)} app links, "
                  f"{failures} wrong, {len(errs)} console errors, "
                  f"{len(bad)} failed requests")
            if not sys.argv[1:]:
                print(f"  {DIM}/login and /overview are the React app's routes "
                      f"and are not in this static mirror, so the two 404s "
                      f"below are expected here and are pages in production. "
                      f"What is being checked is the URL the browser arrived "
                      f"at, not what was served.{RESET}")
            for e in dict.fromkeys(errs):
                print(f"  err: {e[:130]}")
            for b in dict.fromkeys(bad):
                print(f"  bad: {b[:110]}")
            br.close()
    finally:
        srv.terminate()
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
