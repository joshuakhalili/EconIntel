#!/usr/bin/env python3
"""
Detach the mirror from the source site. Run straight after docs/mirror.py.

Removes what belongs to the template's own publisher rather than to the design:
Framer's visitor-analytics beacon (it phones home to whoever published the
template), the editor-bar hook, the "Made in Framer" badge, the "Remix Template"
store link, the generator meta, and canonical / og:url / twitter:url tags still
pointing at the source.

Idempotent. With --domain https://example.com it writes the canonical tags,
robots.txt and sitemap.xml for the new home instead of just stripping them.

  python3 docs/detach.py
  python3 docs/detach.py --domain https://example.com

Reads the source URL from clone.json, so mirror.py must have run first.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "clone.json"
if not CONFIG.exists():
    sys.exit("no clone.json, run docs/mirror.py first")
SOURCE = json.loads(CONFIG.read_text())["source"].rstrip("/")

DOMAIN = None
if "--domain" in sys.argv:
    DOMAIN = sys.argv[sys.argv.index("--domain") + 1].rstrip("/")

DETACH_CSS = """/* Written by docs/detach.py. Hides the source template's own chrome:
   the Framer badge, the template-store "Remix Template" link, and the floating
   buy-this-template / marketplace buttons the template author pins to a corner.
   Hidden rather than deleted so React hydration still finds its own DOM.
   The :has() rules take the wrapping Framer container out of layout too, since
   hiding only the anchor can leave a positioned empty box behind. */
#__framer-badge-container,
[data-framer-name="Remix Template"],
a[href*="lemonsqueezy.com"],
a[href*="framer.com/marketplace"],
a[href*="frameruni.link"],
a[href*="lunaui.co"],
div:has(> a[href*="lemonsqueezy.com"]),
div:has(> a[href*="framer.com/marketplace"]),
div:has(> a[href*="frameruni.link"]),
div:has(> a[href*="lunaui.co"]) {
  display: none !important;
}
"""

CSS_HREF = "assets/css/detach.css"

CUTS = [
    # Framer's visitor analytics beacon (phones home to the template publisher)
    (r"[ \t]*<script async src=\"https://events\.framer\.com/script\?v=2\"[^>]*>"
     r"</script>\n?", "analytics beacon"),
    # editor-bar hook, only ever useful inside Framer itself
    (r"[ \t]*<script>try\{if\(localStorage\.getItem\(\"__framer_force_showing_"
     r"editorbar_since\"\)\).*?</script>\n?", "editor-bar hook"),
    (r"[ \t]*<meta name=\"generator\" content=\"Framer[^\"]*\">\n?", "generator meta"),
    (r"<!-- Made in Framer[^>]*-->\n?", "made-in-framer comment"),
    (r"<!-- Published [^>]*-->\n?", "published comment"),
]

# Framer's relative-href normaliser is called with the site origin as a dummy
# base (usually only the 404 page carries it). location.origin is the same value
# without naming the source site.
SUBS = [(r'\}\)\(\)\("' + re.escape(SOURCE) + r'", ', '})()(location.origin, ',
         "404 link-normaliser origin")]


def head_inject(html: str, tag: str) -> str:
    # Match on the stylesheet path, not the whole tag: harden.py rewrites the
    # href to root-absolute, so an exact-tag check misses it on a re-run and
    # injects a second, relative copy.
    if CSS_HREF in html:
        return html
    marker = "<!-- Start of headEnd -->"
    if marker in html:
        return html.replace(marker, f"{tag}\n    {marker}", 1)
    return html.replace("</head>", f"    {tag}\n</head>", 1)


def route_for(page: Path) -> str:
    r = page.relative_to(ROOT).as_posix()
    if r == "index.html":
        return "/"
    if r == "404.html":
        return "/404"
    return "/" + r[: -len("/index.html")]


def main():
    pages = sorted(p for p in ROOT.rglob("*.html")
                   if ".mirror-cache" not in p.parts)
    if not pages:
        sys.exit("no pages found, run docs/mirror.py first")

    css = ROOT / CSS_HREF
    css.parent.mkdir(parents=True, exist_ok=True)
    css.write_text(DETACH_CSS, encoding="utf-8")

    esc = re.escape(SOURCE)
    counts = {}
    for page in pages:
        html = orig = page.read_text(encoding="utf-8")
        for pattern, label in CUTS:
            html, n = re.subn(pattern, "", html, flags=re.S)
            counts[label] = counts.get(label, 0) + n
        for pattern, sub, label in SUBS:
            html, n = re.subn(pattern, sub, html)
            counts[label] = counts.get(label, 0) + n

        # canonical / og:url / twitter:url still pointing at the source site
        route = route_for(page)
        if DOMAIN:
            new = DOMAIN + ("/" if route == "/" else route)
            html, a = re.subn(r'(<link rel="canonical" href=")' + esc + r'[^"]*(")',
                              lambda m: m.group(1) + new + m.group(2), html)
            html, b = re.subn(r'(<meta (?:property|name)="(?:og:url|twitter:url)" '
                              r'content=")' + esc + r'[^"]*(")',
                              lambda m: m.group(1) + new + m.group(2), html)
        else:
            html, a = re.subn(r'[ \t]*<link rel="canonical" href="' + esc
                              + r'[^"]*">\n?', "", html)
            html, b = re.subn(r'[ \t]*<meta (?:property|name)="(?:og:url|twitter:url)"'
                              r' content="' + esc + r'[^"]*">\n?', "", html)
        counts["canonical/og:url"] = counts.get("canonical/og:url", 0) + a + b

        depth = page.relative_to(ROOT).as_posix().count("/")
        html = head_inject(html, f'<link rel="stylesheet" href="'
                                 f'{"../" * depth}{CSS_HREF}">')
        if html != orig:
            page.write_text(html, encoding="utf-8")

    # stop the badge chunk from being fetched at all
    for chunk in (ROOT / "assets/js").glob("script_main.*.mjs"):
        t = chunk.read_text(encoding="utf-8")
        t2, n = re.subn(r"\w+(&&\w+\(\(\)=>\{\w+\(document\.getElementById\("
                        r"`__framer-badge-container`\))", r"false\1", t)
        counts["badge loader"] = counts.get("badge loader", 0) + (t2 != t)
        if t2 != t:
            chunk.write_text(t2, encoding="utf-8")

    if DOMAIN:
        routes = [route_for(p) for p in pages if p.name != "404.html"]
        urls = "".join(
            f"  <url><loc>{DOMAIN}{'/' if r == '/' else r}</loc></url>\n"
            for r in sorted(routes))
        (ROOT / "sitemap.xml").write_text(
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"{urls}</urlset>\n", encoding="utf-8")
        (ROOT / "robots.txt").write_text(
            f"User-agent: *\nAllow: /\n\nSitemap: {DOMAIN}/sitemap.xml\n",
            encoding="utf-8")
        print(f"wrote sitemap.xml + robots.txt for {DOMAIN}")

    print(f"{len(pages)} pages processed")
    for k, v in counts.items():
        print(f"  {k:26} {v}")
    left = sum(p.read_text(encoding='utf-8').count(SOURCE) for p in pages)
    print(f"  references to source site left: {left}")


if __name__ == "__main__":
    main()
