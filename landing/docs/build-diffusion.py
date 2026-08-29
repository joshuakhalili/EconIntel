#!/usr/bin/env python3
"""
Apply docs/content_diffusion.py to a pristine mirror. One-way, once.

    bash docs/reset.sh && python3 docs/build-diffusion.py

REFUSES TO RUN TWICE. Substitution is not idempotent — the second pass would
see already-replaced text and, where a replacement contains a key, replace it
again. The marker file is the guard, and the only correct rebuild is to reset
to the tag and run this once more.

WHY ONE PASS, LONGEST KEY FIRST
-------------------------------
Every key is applied in a single sweep, sorted by length descending, because a
short key that is a substring of a longer one corrupts it otherwise. The skill
records the real damage: "Studio Owner" became "About Owner" because "Studio"
was substituted before the phrase containing it. Sorting is what prevents that,
not luck.

THE FOUR SURFACES
-----------------
Framer puts the same string in four places and missing one leaves the old text
visible somewhere:

  1. the HTML — SSR markup, plus ~50 `ssr-variant` blocks, so most copy
     appears once per breakpoint
  2. the JS chunks — component defaults, rehydrated over the SSR markup
  3. assets/data/searchIndex-*.json — the site search index
  4. the .framercms blobs — here, only the two legal documents

Blobs are NOT touched. They are addressed by byte offset and fetched with range
requests; rewriting one shifts every later offset and the loader fails. The
legal pages are rewritten as whole files instead.

ESCAPED JSON
------------
Inside <script type="framer/handover"> and data-framer-hydrate-v2, the payload
is JSON with escaped quotes. Replacing display text in there is safe because it
is the same literal text; what must NOT change there are slugs and ids, and no
key in the content map is one.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from content_diffusion import REPLACEMENTS, HIDE_CSS, WORDMARK_VIEWBOX  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
MARKER = ROOT / ".content-applied"
HIDE_CSS_PATH = ROOT / "assets/css/content.css"

GREEN, RED, YELLOW, DIM, RESET = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"

# Below this length a key is treated as generic and must be delimited. 25 is
# comfortably above the longest single English word likely to appear inside a
# library identifier, and below the shortest distinctive phrase in the map.
LONG_KEY = 25


def targets():
    """Every file that can hold a user-visible string."""
    files = []
    files += sorted(ROOT.glob("*.html"))
    files += sorted(ROOT.glob("*/index.html"))
    files += sorted(ROOT.glob("*/*/index.html"))
    files += sorted((ROOT / "assets/js").glob("*.mjs"))
    files += sorted((ROOT / "assets/data").glob("searchIndex-*.json"))
    # sitemap/robots carry the domain, not copy; detach.py owns those.
    return [f for f in files if f.is_file()]


def main():
    if MARKER.exists():
        print(
            f"{RED}✗ refusing to run twice{RESET}\n"
            f"{DIM}Substitution is not idempotent. Reset to the tag first:\n"
            f"    bash docs/reset.sh && python3 docs/build-diffusion.py{RESET}"
        )
        return 1

    # Longest first. This is the whole safety property of the pass.
    keys = sorted(REPLACEMENTS, key=len, reverse=True)

    # SHORT KEYS MUST BE DELIMITED, AND THIS IS NOT OPTIONAL.
    #
    # The first run of this script replaced the word "Message" everywhere,
    # including inside react.mjs, turning MessageChannel into "p. 221Channel"
    # and postMessage into "postp. 221". React threw a SyntaxError, the whole
    # runtime died, and the hero globe silently stopped rendering.
    #
    # So a short key only matches where it is unambiguously a whole piece of
    # visible content: between HTML tags, or as a complete quoted string in the
    # JS. Long keys are distinctive enough to match as plain substrings.
    long_keys = [k for k in keys if len(k) >= LONG_KEY]
    short_keys = [k for k in keys if len(k) < LONG_KEY]

    plain = re.compile("|".join(re.escape(k) for k in long_keys)) if long_keys else None
    # >Key<  — a whole text node in the markup.
    tagged = (re.compile(r"(?<=>)(" + "|".join(re.escape(k) for k in short_keys) + r")(?=<)")
              if short_keys else None)
    # `Key` or "Key" — a complete string literal in the minified chunks.
    quoted = (re.compile(r"(?<=[`\"])(" + "|".join(re.escape(k) for k in short_keys) + r")(?=[`\"])")
              if short_keys else None)

    counts = {k: 0 for k in REPLACEMENTS}
    touched = 0

    def swap(m):
        hit = m.group(len(m.groups()))
        counts[hit] += 1
        return REPLACEMENTS[hit]

    for path in targets():
        original = path.read_text(encoding="utf-8", errors="surrogateescape")
        updated = original

        if plain:
            updated = plain.sub(lambda m: swap(m), updated)
        if tagged and path.suffix == ".html":
            updated = tagged.sub(swap, updated)
        if quoted:
            updated = quoted.sub(swap, updated)

        if updated != original:
            path.write_text(updated, encoding="utf-8", errors="surrogateescape")
            touched += 1

    # The hide rules go in their own sheet, linked after detach.css so it wins.
    HIDE_CSS_PATH.parent.mkdir(parents=True, exist_ok=True)
    HIDE_CSS_PATH.write_text(HIDE_CSS, encoding="utf-8")

    linked = 0
    for path in [p for p in targets() if p.suffix == ".html"]:
        html = path.read_text(encoding="utf-8", errors="surrogateescape")
        if "assets/css/content.css" in html:
            continue
        # Root-absolute, matching what harden.py did to every other href.
        tag = '<link rel="stylesheet" href="/assets/css/content.css">'
        if "</head>" in html:
            html = html.replace("</head>", f"  {tag}\n</head>", 1)
            path.write_text(html, encoding="utf-8", errors="surrogateescape")
            linked += 1

    # The wordmark's viewBox is the old word's advance width; a longer word
    # clips against it. See the note in content_diffusion.py.
    wordmark_fixes = 0
    for path in [p for p in targets() if p.suffix in {".html", ".mjs"}]:
        html = path.read_text(encoding="utf-8", errors="surrogateescape")
        before = html
        for old_vb, new_vb in WORDMARK_VIEWBOX.items():
            # The value itself, not the attribute wrapper. Framer writes it as
            # viewBox="0 0 …" in the HTML and viewBox:`0 0 …` in the minified
            # chunks, and the chunk wins — it re-renders the SVG on mount, so
            # patching only the HTML form gets silently overwritten. Four
            # space-separated numbers is distinctive enough to replace bare.
            html = html.replace(old_vb, new_vb)
        if html != before:
            path.write_text(html, encoding="utf-8", errors="surrogateescape")
            wordmark_fixes += 1

    # Framer's router probes the collection's parent path at runtime, which
    # 404s and logs a console error on both legal pages. Written here rather
    # than committed, because reset.sh cleans anything not in the tag and a
    # hand-added file would vanish on every rebuild.
    legal_index = ROOT / "legal/index.html"
    if legal_index.parent.is_dir():
        legal_index.write_text(
            '<!DOCTYPE html>\n<html lang="en">\n  <head>\n'
            '    <meta charset="utf-8">\n    <title>Legal — Diffusion</title>\n'
            '    <meta http-equiv="refresh" content="0; url=/legal/privacy-policy">\n'
            '    <link rel="canonical" href="/legal/privacy-policy">\n'
            '    <meta name="robots" content="noindex">\n  </head>\n'
            '  <body><a href="/legal/privacy-policy">Privacy Policy</a></body>\n'
            '</html>\n',
            encoding="utf-8",
        )

    applied = {k: n for k, n in counts.items() if n}
    missed = [k for k, n in counts.items() if not n]

    print(f"{GREEN}✓{RESET} {len(applied)} of {len(REPLACEMENTS)} strings applied "
          f"across {touched} files {DIM}({sum(counts.values())} substitutions){RESET}")
    print(f"{GREEN}✓{RESET} content.css written and linked into {linked} pages")
    print(f"{GREEN}✓{RESET} wordmark viewBox refitted in {wordmark_fixes} file(s)")

    if missed:
        # A key that matched nothing is usually a typo against the template, or
        # a string that only exists inside a CMS blob. Worth seeing every time
        # rather than discovering it as leftover template text on the page.
        print(f"\n{YELLOW}! {len(missed)} key(s) matched nothing:{RESET}")
        for k in missed[:25]:
            print(f"  {DIM}{k[:88]}{RESET}")
        if len(missed) > 25:
            print(f"  {DIM}… and {len(missed) - 25} more{RESET}")

    # SYNTAX GATE.
    #
    # A content pass edits minified library code, and a bad substitution there
    # does not fail loudly — it throws once at runtime and the whole Framer
    # app dies silently, taking the globes and every animation with it. That
    # happened: replacing the word "Message" turned React's MessageChannel
    # into "p. 221Channel". The page still served 200 and still looked like a
    # page. Nothing but the browser console said otherwise.
    #
    # So every chunk is parsed before this build is allowed to succeed.
    import subprocess

    broken = []
    for chunk in sorted((ROOT / "assets/js").glob("*.mjs")):
        r = subprocess.run(["node", "--check", str(chunk)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            broken.append((chunk.name, r.stderr.strip().splitlines()[:2]))

    if broken:
        print(f"\n{RED}✗ {len(broken)} JS chunk(s) no longer parse{RESET}")
        for name, err in broken:
            print(f"  {RED}{name}{RESET}")
            for line in err:
                print(f"    {DIM}{line[:100]}{RESET}")
        print(f"{DIM}A key matched inside library code. Delimit it, or raise "
              f"LONG_KEY. Reset before retrying.{RESET}")
        return 1

    print(f"{GREEN}✓{RESET} all {len(list((ROOT / 'assets/js').glob('*.mjs')))} "
          f"JS chunks parse")

    MARKER.write_text("built by docs/build-diffusion.py\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
