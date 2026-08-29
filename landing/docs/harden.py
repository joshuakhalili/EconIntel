#!/usr/bin/env python3
"""
Make the mirror actually work on a host that is not Framer. Run after
docs/detach.py, before any content work.

A pristine mirror LOOKS perfect on every route and is still broken the moment a
visitor clicks. Three things are wrong, all inherited from Framer's runtime, and
none of them show up in a route-by-route screenshot check:

  1. CMS BYTE RANGES. Framer fetches collection data with a `?range=` query that
     only its own CDN honours. Anywhere else the whole file comes back, the
     loader's length check throws "Request failed: Unexpected response length",
     and the unhandled rejection switches the page to non-interactive. Framer
     prefetches the next route ON HOVER, so this fires from any page with links.
     Fix: the loader reads whole files, and the blobs stay byte-for-byte
     pristine (editing one shifts every later offset).

  2. RELATIVE HREFS. The runtime writes ./projects/x and resolves it against
     document.baseURI, so it only lands correctly from a slash-less path. Made
     root-absolute per page here, so a host that adds a trailing slash cannot
     break navigation.

  3. CLIENT-SIDE ROUTING. The router renders the next page from a prefetch cache
     that does not hold the collection data. Every page in a mirror is a
     complete document, so a normal page load is both correct and cheaper.
     nav.js intercepts clicks and does one.

  python3 docs/harden.py
  python3 docs/harden.py --dry-run

Idempotent. Verify with docs/verify-nav.py, which is what catches all three.
"""

import posixpath
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DRY = "--dry-run" in sys.argv

NAV_JS_NAME = "assets/js/nav.js"
NAV_JS = """/* Written by docs/harden.py.

   Framer's client-side router tries to render the next page from the current
   page's prefetch cache. When the next page needs collection data the cache
   does not hold, the CMS asks for a byte range, which only Framer's own CDN
   serves. Every page here is a complete document, so a normal page load is both
   correct and cheaper.

   Relative hrefs (./projects/thing) are also resolved against the page's own
   slash-less path, so the site behaves the same whether the host adds a
   trailing slash or not. */
document.addEventListener("click", function (e) {
  if (e.defaultPrevented || e.button !== 0) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  var a = e.target && e.target.closest && e.target.closest("a[href]");
  if (!a) return;
  var href = a.getAttribute("href");
  if (!href || href.indexOf("#") !== -1) return;
  if (a.target && a.target !== "_self") return;
  var target;
  if (href.charAt(0) === "/") {
    target = href;
  } else if (href.charAt(0) === ".") {
    var here = location.pathname.replace(/\\/$/, "");
    var dir = here.slice(0, here.lastIndexOf("/") + 1) || "/";
    try {
      target = new URL(href, location.origin + dir).pathname;
    } catch (err) { return; }
  } else {
    return;
  }
  e.stopPropagation();
  e.preventDefault();
  window.location.assign(target);
}, true);
"""

MARKER = "throw Error(`Request failed: Unexpected response length`);"


def html_files():
    return sorted(p for p in ROOT.rglob("*.html") if ".mirror-cache" not in p.parts)


def chunk_files():
    return sorted((ROOT / "assets/js").glob("*.mjs"))


def quiet_prefetch():
    """Let the CMS read a whole file instead of a byte range."""
    n, skipped = 0, 0
    for p in chunk_files():
        t = p.read_text(encoding="utf-8")
        if MARKER not in t:
            continue
        i = t.index(MARKER)
        head, tail = t[:i], t[i + len(MARKER):]
        buf = re.search(r"=new Uint8Array\([\w$]+\);if\(([\w$]+)\.length!==[\w$]+\)$",
                        head[-160:])
        loop = re.match(r"let ([\w$]+)=new ([\w$]+),[\w$]+=0;for\(let .*?\}", tail, re.S)
        if not buf or not loop:
            print(f"  !! {p.name}: could not read the loader shape, left alone. "
                  f"Framer changed the bundle: re-derive the two regexes above "
                  f"from the code around the marker string.")
            skipped += 1
            continue
        resp, store, cls = buf.group(1), loop.group(1), loop.group(2)
        tail = (f"void 0;let {store}=new {cls};{store}.write(0,{resp});"
                + tail[loop.end():])
        head = head.replace("searchParams.set(`range`,", "searchParams.delete(`range`,")
        if not DRY:
            p.write_text(head + tail, encoding="utf-8")
        n += 1
    print(f"  CMS loader reads whole files in {n} chunks"
          + (f", {skipped} left alone" if skipped else ""))
    return skipped


def absolutise_hrefs():
    """Relative hrefs -> root-absolute, per page."""
    changed = 0
    for p in html_files():
        t = orig = p.read_text(encoding="utf-8")
        rel = p.relative_to(ROOT).as_posix()
        url = "/" + (rel[:-len("index.html")] if rel.endswith("index.html")
                     else rel[:-len(".html")])
        base = posixpath.dirname(url.rstrip("/")) or "/"

        def absolute(m):
            target = posixpath.normpath(posixpath.join(base, m.group(1)))
            if m.group(1).endswith("/") and not target.endswith("/"):
                target += "/"
            return f'href="{target}"'

        t = re.sub(r'href="(\.{1,2}/[^"]*)"', absolute, t)
        if t != orig:
            changed += 1
            if not DRY:
                p.write_text(t, encoding="utf-8")
    print(f"  relative hrefs made root-absolute in {changed} pages")


def install_nav():
    """Write nav.js and put it on every page."""
    js = ROOT / NAV_JS_NAME
    if not DRY:
        js.parent.mkdir(parents=True, exist_ok=True)
        js.write_text(NAV_JS, encoding="utf-8")
    added = 0
    for p in html_files():
        t = p.read_text(encoding="utf-8")
        if NAV_JS_NAME in t:
            continue
        depth = p.relative_to(ROOT).as_posix().count("/")
        tag = f'<script src="{"../" * depth}{NAV_JS_NAME}" defer></script>'
        if "</body>" in t:
            t = t.replace("</body>", f"    {tag}\n</body>", 1)
        elif "</head>" in t:
            t = t.replace("</head>", f"    {tag}\n</head>", 1)
        else:
            continue
        added += 1
        if not DRY:
            p.write_text(t, encoding="utf-8")
    print(f"  nav.js added to {added} pages")


def main():
    if not list(html_files()):
        sys.exit("no pages found, run docs/mirror.py first")
    print("Hardening" + (" (dry run)" if DRY else ""))
    skipped = quiet_prefetch()
    absolutise_hrefs()
    install_nav()
    print("\nNow run docs/verify-nav.py. Expect 0 wrong hops and 0 failed "
          "requests. Anything left is real.")
    return 1 if skipped else 0


if __name__ == "__main__":
    sys.exit(main())
