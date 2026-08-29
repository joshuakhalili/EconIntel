#!/usr/bin/env python3
"""
Load every page, scroll to trigger Framer's appear animations, screenshot full
page, and report console errors, failed requests and (against the live source)
a pixel-diff ratio.

Two modes, both needed at different points:

  python3 docs/verify.py                 # local vs live source, pixel diff
                                         # use on the PRISTINE mirror: proves the
                                         # mirror is faithful before any rebrand
  python3 docs/verify.py --local-only    # local only, no diff
                                         # use after the content pass, when the
                                         # design is the same but the words are not
  python3 docs/verify.py --url https://the-live-site.com   # check the deploy
  python3 docs/verify.py /about /contact                   # just these routes

A diff above ~2% on the pristine mirror means something did not come across.
Zero console errors and zero failed requests is the bar, both local and live.

Needs playwright (`pip3 install playwright && playwright install chromium`) and,
for the diff, pillow. Reads routes and source from clone.json.
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

SHOTS = ROOT / "docs/verify-shots"
LIVE = CFG["source"].rstrip("/")
PORT = 8421
LOCAL = f"http://localhost:{PORT}"

LOCAL_ONLY = "--local-only" in sys.argv
TARGET = None
if "--url" in sys.argv:
    TARGET = sys.argv[sys.argv.index("--url") + 1].rstrip("/")
    LOCAL_ONLY = True

ROUTES = [a for a in sys.argv[1:] if a.startswith("/")] or CFG["pages"]

# Noise that is broken at the source too, or is stripped by design. Add the
# template's own known-bad assets here rather than chasing them.
KNOWN_BAD = ("events.framer.com", "fonts.gstatic.com/s/'")


def slug(route):
    return "home" if route == "/" else route.strip("/").replace("/", "__")


def capture(page, url, path: Path):
    errs, bad = [], []
    page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    page.on("requestfailed", lambda r: bad.append(f"FAIL {r.url}"))
    page.on("response", lambda r: bad.append(f"{r.status} {r.url}")
            if r.status >= 400 else None)
    try:
        page.goto(url, wait_until="load", timeout=60000)
    except Exception as e:
        errs.append(f"NAV {e}")
    page.wait_for_timeout(2500)
    h = page.evaluate("document.body.scrollHeight")
    y = 0
    while y < h:
        y += 700
        page.evaluate(f"window.scrollTo(0,{y})")
        page.wait_for_timeout(180)
        h = page.evaluate("document.body.scrollHeight")
    page.evaluate("window.scrollTo(0,0)")
    page.wait_for_timeout(1800)
    path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(path), full_page=True)
    keep = lambda s: not any(k in s for k in KNOWN_BAD)
    return [e for e in errs if keep(e)], sorted(set(b for b in bad if keep(b)))


def diff_ratio(a: Path, b: Path):
    try:
        from PIL import Image, ImageChops
    except ImportError:
        return None
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    if ia.size != ib.size:
        ib = ib.resize(ia.size)
    d = ImageChops.difference(ia, ib).convert("L")
    hist = d.histogram()
    off = sum(n for v, n in enumerate(hist) if v > 24)
    return off / float(ia.size[0] * ia.size[1])


def main():
    srv = None
    if not TARGET:
        # NOTE: python -m http.server 301s to a trailing slash, which breaks
        # Framer's relative links. serve.mjs is the honest local server.
        srv = subprocess.Popen(["node", str(ROOT / "docs/serve.mjs"), str(PORT)],
                               cwd=ROOT, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL)
        time.sleep(1.2)
    bases = [("local", TARGET or LOCAL)] + ([] if LOCAL_ONLY else [("live", LIVE)])
    rows = []
    try:
        with sync_playwright() as p:
            br = p.chromium.launch()
            for route in ROUTES:
                name = slug(route)
                row = {"route": route}
                for label, base in bases:
                    ctx = br.new_context(viewport={"width": 1440, "height": 900},
                                         device_scale_factor=1,
                                         reduced_motion="no-preference")
                    page = ctx.new_page()
                    e, b = capture(page, base + route, SHOTS / label / f"{name}.png")
                    row[f"{label}_err"], row[f"{label}_bad"] = e, b
                    row[f"{label}_h"] = page.evaluate("document.body.scrollHeight")
                    ctx.close()
                row["diff"] = (None if LOCAL_ONLY else
                               diff_ratio(SHOTS / "local" / f"{name}.png",
                                          SHOTS / "live" / f"{name}.png"))
                rows.append(row)
                d = "n/a" if row["diff"] is None else f"{row['diff']*100:5.2f}%"
                live_h = row.get("live_h", "-")
                print(f"{route:60} diff {d}  h {row['local_h']}/{live_h}  "
                      f"err {len(row['local_err'])}  bad {len(row['local_bad'])}")
                for b in row["local_bad"][:6]:
                    print(f"    bad: {b}")
                for e in row["local_err"][:6]:
                    print(f"    err: {e[:160]}")
            br.close()
    finally:
        if srv:
            srv.terminate()

    errs = sum(len(r["local_err"]) for r in rows)
    bad = sum(len(r["local_bad"]) for r in rows)
    worst = max((r["diff"] or 0) for r in rows) if rows else 0
    print(f"\n{len(rows)} routes · {errs} console errors · {bad} failed requests"
          + ("" if LOCAL_ONLY else f" · worst diff {worst*100:.2f}%"))
    print(f"shots in {SHOTS}")
    sys.exit(1 if (errs or bad) else 0)


if __name__ == "__main__":
    main()
