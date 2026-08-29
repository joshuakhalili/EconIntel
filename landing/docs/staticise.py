#!/usr/bin/env python3
"""
Freeze a Framer mirror into plain static pages: drop the runtime, keep the SSR
markup, reveal everything the appear animations were holding invisible.

WHEN YOU NEED THIS: the template's CMS content fights your real content. Framer
CMS blobs sit on Framer's CDN addressed by byte offset and are effectively
uneditable, so if the template ships 8 cars and the client has 23, the runtime
re-renders the template's 8 over yours. Worse, any structural edit breaks
hydration, and when React fails to hydrate it DISCARDS the SSR DOM and the whole
page reverts to template content. Taking the runtime out ends that fight: the
SSR markup is already the finished design.

WHEN YOU DO NOT: if the collection sizes happen to match and you only swap text,
leave the runtime alone and edit the blobs with blobtool.py instead.

THE COST: every behaviour the runtime provided has to be re-implemented, usually
about 250 lines of vanilla JS for accordions, galleries, the mobile menu, scroll
reveal and any filters. That is the trade against 2 MB of chunks you cannot edit.

  python3 docs/staticise.py            # rewrite every page in place
  python3 docs/staticise.py --dry-run  # report only

Or import `staticise(html)` from a build script.
"""
import re
import sys
from pathlib import Path

# Framer hides appear-animated elements with opacity:0 / 0.001 and a small pixel
# offset, then animates them in. Percentage translates are LAYOUT
# (translateX(-50%) centres the nav), so they MUST survive: neutralising them
# shoves the header half a viewport to the right. Match pixel translates only.
PX_TRANSLATE = re.compile(
    r"transform\s*:\s*(?:translateX\(-?\d*\.?\d+px\)|translateY\(-?\d*\.?\d+px\)|"
    r"translate\(-?\d*\.?\d+px[^)]*\))"
    r"(?:\s*translate[XY]\(-?\d*\.?\d+px\))*"
    r"(?:\s*scale\([^)]*\))?(?:\s*rotate\([^)]*\))?(?:\s*skew[XY]\([^)]*\))*")
HIDDEN_OPACITY = re.compile(r"opacity\s*:\s*0(?:\.0+1?)?\s*(?=;|$)")
STYLE_ATTR = re.compile(r'style="([^"]*)"')

RUNTIME_SCRIPT = re.compile(
    r'<script[^>]*data-framer-bundle="main"[^>]*>\s*</script>', re.I)
MODULEPRELOAD = re.compile(r'<link[^>]+rel="modulepreload"[^>]*>', re.I)
EVENTS_SCRIPT = re.compile(
    r'<script[^>]+src="https://events\.framer\.com[^"]*"[^>]*>\s*</script>', re.I)
SEARCH_META = re.compile(r'<meta[^>]+name="framer-search-index[^"]*"[^>]*>', re.I)
HANDOVER = re.compile(
    r'<script[^>]+type="framer/handover"[^>]*>.*?</script>', re.I | re.S)
HYDRATE_ATTR = re.compile(r'\sdata-framer-hydrate-v2="[^"]*"')
APPEAR_ATTR = re.compile(r'\sdata-framer-appear-id="[^"]*"')


def unhide(style):
    """Reveal an element the appear animation was holding invisible."""
    if not HIDDEN_OPACITY.search(style):
        return None
    out = HIDDEN_OPACITY.sub("opacity:1", style)
    out = PX_TRANSLATE.sub("transform:none", out)
    out = re.sub(r"will-change\s*:\s*[^;]*;?", "", out)
    return out.strip().strip(";")


def staticise(html):
    html = RUNTIME_SCRIPT.sub("", html)
    html = MODULEPRELOAD.sub("", html)
    html = EVENTS_SCRIPT.sub("", html)
    html = SEARCH_META.sub("", html)
    html = HANDOVER.sub("", html)
    html = HYDRATE_ATTR.sub("", html)
    html = APPEAR_ATTR.sub("", html)

    def fix(m):
        new = unhide(m.group(1))
        return m.group(0) if new is None else f'style="{new}"'

    html = STYLE_ATTR.sub(fix, html)
    # a few elements start scaled/translated from a CSS variable instead
    html = html.replace("opacity:0.001", "opacity:1")
    return html


def main():
    root = Path(__file__).resolve().parent.parent
    dry = "--dry-run" in sys.argv
    pages = sorted(p for p in root.rglob("*.html") if ".mirror-cache" not in p.parts)
    changed = 0
    for p in pages:
        before = p.read_text(encoding="utf-8")
        after = staticise(before)
        if after != before:
            changed += 1
            if not dry:
                p.write_text(after, encoding="utf-8")
    verb = "would change" if dry else "changed"
    print(f"{verb} {changed}/{len(pages)} pages")
    print("Now re-implement the runtime's behaviours in your own JS and include "
          "it on every page: accordions, gallery, mobile menu, scroll reveal, "
          "filters. Check every interactive element before calling this done.")


if __name__ == "__main__":
    main()
