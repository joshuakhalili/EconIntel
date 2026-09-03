#!/usr/bin/env python3
"""
Click through the site the way a visitor does.

Loading a URL directly proves nothing about navigation: Framer writes RELATIVE
links and resolves them against document.baseURI, so a trailing slash sends the
next hop to the wrong path. A mirror can pass docs/verify.py on every route and
still be unclickable. This is a separate risk and it needs its own check.

  python3 docs/verify-nav.py                 # every route in clone.json
  python3 docs/verify-nav.py projects blog   # just these hops

Each hop returns home first, so a broken hop cannot cascade. Reads clone.json.
"""

import json
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "clone.json"
if not CONFIG.exists():
    sys.exit("no clone.json, run docs/mirror.py first")
CFG = json.loads(CONFIG.read_text())

PORT = 8511
# hop by path, not by label: labels change with the rebrand, routes do not
HOPS = sys.argv[1:] or [r.strip("/") for r in CFG["pages"]
                        if r not in ("/", "/404")]

# Pages of the mirror that this site deliberately no longer links to. They stay
# in clone.json because that file records what was cloned, and they stay on disk
# because Express redirects both to /login for the sake of old bookmarks — but
# nothing on the site should offer them any more.
#
# Without this the check graded the fix as the failure: once the calls to action
# stopped going to /waitlist, the /waitlist hop found no link and counted itself
# wrong, on a site that was finally correct. A retired route is checked the other
# way round — an unlinked one passes, and a link to one is the failure.
RETIRED = {"waitlist", "thanks"}


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
            print(f"\n{len(HOPS)} hops, {failures} wrong, "
                  f"{len(errs)} console errors, {len(bad)} failed requests")
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
