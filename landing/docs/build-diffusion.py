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

import ast
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from content_diffusion import (  # noqa: E402
    REPLACEMENTS, HIDE_CSS, WORDMARK_VIEWBOX, LINKS, NAV_LINKS,
    CHUNK_PATCHES, NAV_APP_LINKS_JS,
    SITE_ORIGIN, STALE_ORIGIN, SITEMAP_PATHS,
    PAIRED, PAIR_WINDOW, WORD_REVEAL,
)

ROOT = Path(__file__).resolve().parent.parent
MAP_PATH = Path(__file__).resolve().parent / "content_diffusion.py"
MARKER = ROOT / ".content-applied"
HIDE_CSS_PATH = ROOT / "assets/css/content.css"
NAV_JS_PATH = ROOT / "assets/js/nav.js"
ROBOTS_PATH = ROOT / "robots.txt"
SITEMAP_PATH = ROOT / "sitemap.xml"

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
    # sitemap.xml and robots.txt carry the host rather than copy, and are
    # rewritten wholesale from SITE_ORIGIN further down rather than substituted.
    return [f for f in files if f.is_file()]


# ---------------------------------------------------------------------------
# Gate: a dict literal in the content map may not name the same key twice
# ---------------------------------------------------------------------------
#
# Python collapses `{"a": 1, "a": 2}` to `{"a": 2}` at parse time, without a
# warning, so a duplicated key inside one group is invisible to the map's own
# cross-group check — it never sees the discarded value. The cost is the same:
# a sentence that is in the map, reads correctly, and reaches no page. Read the
# source instead of the object.
def duplicate_keys_in_source(path):
    dups = []
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if not isinstance(node, ast.Dict):
            continue
        seen = set()
        for k in node.keys:
            if k is None:          # {**other} spread carries no key
                continue
            try:
                key = ast.literal_eval(k)
            except Exception:
                continue           # a computed key; nothing to compare
            if not isinstance(key, str):
                continue
            if key in seen:
                dups.append((getattr(k, "lineno", 0), key))
            seen.add(key)
    return sorted(dups)


# ---------------------------------------------------------------------------
# The hero's word-by-word scroll reveal
# ---------------------------------------------------------------------------
#
# One <span> per word, each holding the word twice — dimmed, then bright and
# absolutely positioned over it. See the note above WORD_REVEAL in the content
# map for why no whole-sentence key can ever reach this.
WORD_SPAN_RE = re.compile(
    r'<span style="display:inline-block;margin-right:0\.3em;margin-bottom:0\.2em;'
    r'position:relative;white-space:normal;color:(?P<dim>[^"]*)">'
    r'(?P<word>[^<>]*)'
    r'<span style="(?P<bright>position:absolute;inset:0;[^"]*)">'
    r'(?P=word)</span></span>'
)


def word_span(dim, bright, word):
    return ('<span style="display:inline-block;margin-right:0.3em;'
            'margin-bottom:0.2em;position:relative;white-space:normal;'
            'color:%s">%s<span style="%s">%s</span></span>'
            % (dim, word, bright, word))


def rewrite_word_reveals(text, table, hits):
    """Rebuild any run of word spans whose joined text is in `table`."""
    runs, current = [], []
    for m in WORD_SPAN_RE.finditer(text):
        if current and m.start() != current[-1].end():
            runs.append(current)
            current = []
        current.append(m)
    if current:
        runs.append(current)

    out, pos = [], 0
    for run in runs:
        sentence = " ".join(m.group("word") for m in run)
        if sentence not in table:
            continue
        dim, bright = run[0].group("dim"), run[0].group("bright")
        out.append(text[pos:run[0].start()])
        out.append("".join(word_span(dim, bright, w)
                           for w in table[sentence].split(" ")))
        pos = run[-1].end()
        hits[sentence] = hits.get(sentence, 0) + 1
    out.append(text[pos:])
    return "".join(out)


# ---------------------------------------------------------------------------
# The strings the template uses twice
# ---------------------------------------------------------------------------
def merge_windows(spans):
    merged = []
    for a, b in sorted(spans):
        if merged and a <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return merged


def apply_paired(text, entries, took, left):
    """Replace `old` only near `anchor`; leave every other occurrence alone."""
    for anchor, old, new in entries:
        if old not in text:
            continue
        windows = merge_windows(
            (max(0, m.start() - PAIR_WINDOW), m.end() + PAIR_WINDOW)
            for m in re.finditer(re.escape(anchor), text))
        parts, pos = [], 0
        for m in re.finditer(re.escape(old), text):
            inside = any(a <= m.start() and m.end() <= b for a, b in windows)
            parts.append(text[pos:m.start()])
            parts.append(new if inside else m.group(0))
            pos = m.end()
            took[(anchor, old)] = took.get((anchor, old), 0) + int(inside)
            left[(anchor, old)] = left.get((anchor, old), 0) + int(not inside)
        parts.append(text[pos:])
        text = "".join(parts)
    return text


def main():
    if MARKER.exists():
        print(
            f"{RED}✗ refusing to run twice{RESET}\n"
            f"{DIM}Substitution is not idempotent. Reset to the tag first:\n"
            f"    bash docs/reset.sh && python3 docs/build-diffusion.py{RESET}"
        )
        return 1

    # ---- Gates on the map itself, before a single file is touched ----------
    dups = duplicate_keys_in_source(MAP_PATH)
    if dups:
        print(f"{RED}✗ {len(dups)} duplicate key(s) inside one dict in "
              f"{MAP_PATH.name}{RESET}")
        for lineno, key in dups:
            print(f"  {RED}line {lineno}{RESET} {DIM}{key[:80]!r}{RESET}")
        print(f"{DIM}Python keeps only the last one and says nothing. Delete "
              f"the dead entry, or move it to PAIRED if the two really are "
              f"different components.{RESET}")
        return 1

    # A word of a rebuilt reveal is a whole text node, so a short REPLACEMENTS
    # key equal to one of those words would match it and rewrite a single word
    # of the hero sentence.
    reveal_words = {w for s in WORD_REVEAL.values() for w in s.split(" ")}
    shadowed = sorted(reveal_words & set(REPLACEMENTS))
    if shadowed:
        print(f"{RED}✗ {len(shadowed)} word(s) of the hero statement are also "
              f"replacement keys{RESET}")
        for w in shadowed:
            print(f"  {RED}{w!r}{RESET} {DIM}-> {REPLACEMENTS[w]!r}{RESET}")
        print(f"{DIM}Each word of the reveal is its own text node, so the key "
              f"would rewrite it. Reword the statement or the key.{RESET}")
        return 1

    # ---- The two passes that have to run before the flat map --------------
    #
    # WORD_REVEAL first, because it keys on the template's sentence and the
    # brand pass is about to rename the first word of it. PAIRED second, for
    # the same reason: it anchors on strings the flat map is about to replace.
    reveal_hits, paired_took, paired_left = {}, {}, {}
    reveal_files = paired_files = 0
    for path in targets():
        original = path.read_text(encoding="utf-8", errors="surrogateescape")
        updated = original
        if path.suffix == ".html":
            updated = rewrite_word_reveals(updated, WORD_REVEAL, reveal_hits)
            if updated != original:
                reveal_files += 1
        before_pair = updated
        updated = apply_paired(updated, PAIRED, paired_took, paired_left)
        if updated != before_pair:
            paired_files += 1
        if updated != original:
            path.write_text(updated, encoding="utf-8", errors="surrogateescape")

    dead_pairs = [(a, o) for a, o, _ in PAIRED if not paired_took.get((a, o))]
    if dead_pairs:
        print(f"{RED}✗ {len(dead_pairs)} paired key(s) matched nothing{RESET}")
        for anchor, old in dead_pairs:
            seen = paired_left.get((anchor, old), 0)
            print(f"  {RED}{old[:40]:42}{RESET} {DIM}near {anchor[:40]!r} "
                  f"— {seen} occurrence(s) found, none within "
                  f"{PAIR_WINDOW} chars{RESET}")
        print(f"{DIM}Either the tree is not a pristine mirror, or the template "
              f"moved one of the two strings apart. Reset before retrying."
              f"{RESET}")
        return 1

    if not reveal_hits:
        print(f"{RED}✗ the hero statement's word spans were not found{RESET}")
        print(f"{DIM}Nothing in WORD_REVEAL matched a run of word spans, so "
              f"the SSR markup still carries the template's sentence at every "
              f"breakpoint. Check WORD_SPAN_RE against the current markup."
              f"{RESET}")
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
    #
    # THE TRAILING BACKSLASH IS NOT OPTIONAL. Framer's hydration payload is
    # JSON embedded in a <script> inside the HTML, so a string literal there
    # reads \"Key\" — the closing quote is escaped. The lookahead used to
    # demand a bare quote, so a short key matched the SSR markup and missed
    # the payload sitting further down the same file. React finds the mismatch
    # on hydration and patches the DOM to the payload's value, which is how
    # both legal pages ended up showing contact@atmos.com in a browser while
    # the file on disk said something else. The opening side needs no such
    # allowance: in \"Key the character before the key is already a quote.
    quoted = (re.compile(r"(?<=[`\"])(" + "|".join(re.escape(k) for k in short_keys) + r")(?=\\?[`\"])")
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

    # Hrefs. Applied to HTML and chunks alike: Framer re-renders anchors from
    # the chunk on mount, so patching only the markup gets overwritten. Done as
    # plain replacement of the quoted value, which is why LINKS keys carry
    # their own quotes — an unquoted "/waitlist" would also match the string
    # inside a route table and break navigation.
    #
    # HITS ARE COUNTED PER KEY, AND A KEY THAT MATCHED NOTHING IS AN ERROR.
    # `'"/waitlist"': '"/login"'` sat here reading perfectly and matching nothing
    # for weeks, because the anchors it was meant to fix are page links resolved
    # from the chunk rather than hrefs in the markup. A silent no-op in a link
    # table is the worst kind of bug in this build: it looks like the fix.
    all_links = {**LINKS, **NAV_LINKS}
    link_hits = {k: 0 for k in all_links}
    link_fixes = 0
    for path in [p for p in targets() if p.suffix in {".html", ".mjs"}]:
        text = path.read_text(encoding="utf-8", errors="surrogateescape")
        before = text
        for old_href, new_href in all_links.items():
            link_hits[old_href] += text.count(old_href)
            text = text.replace(old_href, new_href)
        if text != before:
            path.write_text(text, encoding="utf-8", errors="surrogateescape")
            link_fixes += 1

    # Code edits in Framer's own bundle. Same rule, enforced harder: these are
    # the fixes that cannot be expressed as content, so if one stops matching
    # the build has no business succeeding.
    chunk_hits = {k: 0 for k in CHUNK_PATCHES}
    chunk_fixes = 0
    for path in sorted((ROOT / "assets/js").glob("*.mjs")):
        text = path.read_text(encoding="utf-8", errors="surrogateescape")
        before = text
        for old, new in CHUNK_PATCHES.items():
            chunk_hits[old] += text.count(old)
            text = text.replace(old, new)
        if text != before:
            path.write_text(text, encoding="utf-8", errors="surrogateescape")
            chunk_fixes += 1

    # The app-link click handler, appended to harden.py's nav.js. See the note
    # on NAV_APP_LINKS_JS: nav.js is restored from the pristine-mirror commit by
    # reset.sh, so this has to be written by the build, not committed into it.
    if NAV_JS_PATH.exists():
        nav = NAV_JS_PATH.read_text(encoding="utf-8")
        if "APP_ORIGIN" not in nav:
            NAV_JS_PATH.write_text(nav + NAV_APP_LINKS_JS, encoding="utf-8")

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
            # Absolute, like every other canonical on the site, so the check
            # below covers this stub too rather than needing an exception.
            f'    <link rel="canonical" href="{SITE_ORIGIN}/legal/privacy-policy">\n'
            '    <meta name="robots" content="noindex">\n  </head>\n'
            '  <body><a href="/legal/privacy-policy">Privacy Policy</a></body>\n'
            '</html>\n',
            encoding="utf-8",
        )

    # ---- The host, in one place -------------------------------------------
    #
    # Every canonical tag, og:url and twitter:url on all eight pages, plus
    # robots.txt and sitemap.xml, named https://diffusion.observer — a host
    # with no DNS record at all. A canonical tag is an instruction to a search
    # engine that the real copy of the page lives elsewhere; pointing it at
    # nothing is the strongest available way to ask not to be indexed, and
    # og:url is what Slack and LinkedIn fetch when the link is pasted.
    #
    # There were two writers and they disagreed. docs/detach.py takes the host
    # as --domain, and this file then hardcoded diffusion.observer over the top
    # of the sitemap it had written, so passing the right --domain did not fix
    # it. Now there is one writer and one constant: SITE_ORIGIN.
    host_fixes = host_hits = 0
    for path in targets() + [p for p in (ROBOTS_PATH, SITEMAP_PATH) if p.exists()]:
        text = path.read_text(encoding="utf-8", errors="surrogateescape")
        n = text.count(STALE_ORIGIN)
        if not n:
            continue
        path.write_text(text.replace(STALE_ORIGIN, SITE_ORIGIN),
                        encoding="utf-8", errors="surrogateescape")
        host_fixes += 1
        host_hits += n

    # robots.txt and sitemap.xml are then rewritten outright rather than
    # patched, so the host is not the only thing about them that is correct.
    # The sitemap deliberately omits /404 and the retired /waitlist and
    # /thanks: every call to action now points at /login, so those two are
    # orphans that Express redirects, and one of them still renders the
    # template's invented "1,200+ people on the waitlist".
    #
    # Written here rather than committed for the same reason as
    # legal/index.html: reset.sh restores the tag, and a hand-edit would vanish
    # on every rebuild.
    ROBOTS_PATH.write_text(
        f"User-agent: *\nAllow: /\n\nSitemap: {SITE_ORIGIN}/sitemap.xml\n",
        encoding="utf-8",
    )
    SITEMAP_PATH.write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{SITE_ORIGIN}{p}</loc></url>\n"
                  for p in SITEMAP_PATHS)
        + "</urlset>\n",
        encoding="utf-8",
    )

    # AND THEN CHECK THE END STATE, not the number of substitutions. A count
    # of zero is ambiguous — it means either "already correct" or "never
    # matched" — so the gate asserts the property instead: every canonical,
    # og:url and twitter:url that exists names SITE_ORIGIN, and at least one
    # of them exists, so the check cannot pass by finding nothing.
    HOST_TAGS = re.compile(
        r'<link rel="canonical" href="([^"]*)"'
        r'|<meta (?:property|name)="(?:og:url|twitter:url)" content="([^"]*)"')
    wrong_host, host_tags_seen = [], 0
    for path in [p for p in targets() if p.suffix == ".html"]:
        html = path.read_text(encoding="utf-8", errors="surrogateescape")
        for m in HOST_TAGS.finditer(html):
            url = m.group(1) or m.group(2)
            host_tags_seen += 1
            if not url.startswith(SITE_ORIGIN):
                wrong_host.append((path.relative_to(ROOT).as_posix(), url))
    if wrong_host or not host_tags_seen:
        print(f"\n{RED}✗ canonical/og:url check failed{RESET}")
        if not host_tags_seen:
            print(f"  {RED}no canonical or og:url tag on any page{RESET}")
        for rel, url in wrong_host[:12]:
            print(f"  {RED}{rel:38}{RESET} {DIM}{url[:70]}{RESET}")
        print(f"{DIM}Every one of them must name {SITE_ORIGIN}.{RESET}")
        return 1

    applied = {k: n for k, n in counts.items() if n}
    missed = [k for k, n in counts.items() if not n]

    print(f"{GREEN}✓{RESET} hero word-reveal rebuilt in {reveal_files} file(s) "
          f"{DIM}({sum(reveal_hits.values())} runs of spans){RESET}")
    print(f"{GREEN}✓{RESET} paired strings resolved in {paired_files} file(s)")
    for anchor, old, _ in PAIRED:
        print(f"    {DIM}{old[:34]:36} near {anchor[:28]:30} "
              f"{paired_took.get((anchor, old), 0)} taken, "
              f"{paired_left.get((anchor, old), 0)} left for the flat map{RESET}")
    print(f"{GREEN}✓{RESET} {len(applied)} of {len(REPLACEMENTS)} strings applied "
          f"across {touched} files {DIM}({sum(counts.values())} substitutions){RESET}")
    print(f"{GREEN}✓{RESET} host rewritten to {SITE_ORIGIN} "
          f"{DIM}({host_hits} occurrence(s) in {host_fixes} file(s); "
          f"{host_tags_seen} canonical/og:url tags checked){RESET}")
    print(f"{GREEN}✓{RESET} content.css written and linked into {linked} pages")
    print(f"{GREEN}✓{RESET} wordmark viewBox refitted in {wordmark_fixes} file(s)")
    print(f"{GREEN}✓{RESET} links repointed in {link_fixes} file(s) "
          f"{DIM}({sum(link_hits.values())} hrefs){RESET}")
    print(f"{GREEN}✓{RESET} bundle patched in {chunk_fixes} chunk(s) "
          f"{DIM}({sum(chunk_hits.values())} sites){RESET}")
    print(f"{GREEN}✓{RESET} app-link handler appended to assets/js/nav.js")

    dead = ([("link", k) for k, n in link_hits.items() if not n]
            + [("bundle", k) for k, n in chunk_hits.items() if not n])
    if dead:
        print(f"\n{RED}✗ {len(dead)} link/bundle key(s) matched nothing{RESET}")
        for kind, k in dead:
            print(f"  {RED}{kind:6}{RESET} {DIM}{k[:96]}{RESET}")
        print(f"{DIM}An entry that matches nothing is not a fix. Either the "
              f"template moved the string, or it was never there. Reset before "
              f"retrying.{RESET}")
        return 1

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
    # So every chunk is parsed before this build is allowed to succeed. nav.js is
    # in the list too, because this pass now appends to it: a handler that does
    # not parse takes every link on the site with it, and silently, since the
    # page still renders.
    import subprocess

    broken = []
    for chunk in sorted((ROOT / "assets/js").glob("*.mjs")) + [NAV_JS_PATH]:
        if not chunk.exists():
            continue
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
