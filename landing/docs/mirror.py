#!/usr/bin/env python3
"""
Mirror a Framer site into a self-contained static site.

Phase 1 (pristine): read the source's sitemap, fetch every page, download every
asset it references (JS chunks, images, fonts, videos, search index JSON, CMS
blobs), rewrite all absolute framerusercontent / gstatic / third-party CDN URLs
to local relative paths.

Idempotent. Raw downloads are cached in .mirror-cache/ so re-runs are fast and
the rewrite always starts from pristine bytes.

  python3 docs/mirror.py --source https://template.framer.website
  python3 docs/mirror.py                 # re-run using clone.json
  python3 docs/mirror.py --refresh       # re-download everything
  python3 docs/mirror.py --prune         # delete assets/ files this run did not make

Writes clone.json at the repo root: the source URL, the route map and the extra
asset hosts. Every other script in this skill reads it, so this must run first.
COMMIT THE RESULT UNTOUCHED and tag it `pristine-mirror`. Every later pass
rebuilds one-way from that tag.
"""

import html
import json
import os
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".mirror-cache"
CONFIG = ROOT / "clone.json"
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

REFRESH = "--refresh" in sys.argv

# Always mirrored. Anything else the pages reference is reported at the end so
# it can be added to clone.json's "extra_hosts" (templates often pull video or
# imagery from a CDN of the publisher's own choosing).
BASE_HOSTS = ("framerusercontent.com", "fonts.gstatic.com")
# Never mirrored: phoning home is exactly what detach.py strips.
IGNORE_HOSTS = ("events.framer.com", "www.framer.com", "framer.com",
                "fonts.googleapis.com", "google-analytics.com",
                "googletagmanager.com")

TEXT_EXT = {".mjs", ".js", ".json", ".css", ".map"}
DIR_FOR = {
    ".mjs": "assets/js", ".js": "assets/js", ".map": "assets/js",
    ".css": "assets/css", ".json": "assets/data",
    ".woff2": "assets/fonts", ".woff": "assets/fonts", ".ttf": "assets/fonts",
    ".otf": "assets/fonts",
    ".mp4": "assets/video", ".webm": "assets/video", ".mov": "assets/video",
    ".webp": "assets/images", ".png": "assets/images", ".jpg": "assets/images",
    ".jpeg": "assets/images", ".gif": "assets/images", ".avif": "assets/images",
    ".svg": "assets/images", ".ico": "assets/images",
    # CMS stores: binary blobs, must sit beside the chunk that resolves them
    ".framercms": "assets/js",
}

# Framer's CMS stores build their data URLs at runtime from an absolute
# /modules/.../<id>.js base, then swap /modules/ for /cms/. Localising that base
# leaves `new URL(rel, "../../assets/js/x.js")` -> "Invalid base URL", which
# kills hydration for the whole page. Rebase on import.meta.url instead: the
# chunk's own absolute URL, so it stays correct at any hosting root.
CMS_RE = re.compile(
    r"new URL\(`\./([\w.\-]+\.framercms)`,`(https://framerusercontent\.com/modules/[^`]+?\.js)`\)"
)
REL_IMPORT_RE = re.compile(r"""["'`](\.{1,2}/[\w.\-/]+\.(?:mjs|js|json))["'`]""")
ANY_URL_RE = re.compile(r"https://([a-z0-9.\-]+\.[a-z]{2,})/[^\s\"'`\\<>]*")

BASE = None
HOSTS = ()
URL_RE = None
PAGES = {}

ASSETS = {}       # key -> {"local": str, "url": str}
TAKEN = {}        # local path -> key
PATCHED = {}      # key -> patched text for assets that needed a source fix


def sh(args):
    return subprocess.run(args, capture_output=True)


def arg(flag, default=None):
    return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else default


def fetch(url, dest: Path, ok=("200",)):
    """Download url to dest (cache path). Returns True if bytes are on disk."""
    if dest.exists() and dest.stat().st_size > 0 and not REFRESH:
        return True
    dest.parent.mkdir(parents=True, exist_ok=True)
    code = "000"
    for _ in range(3):
        r = sh(["curl", "-sSL", "--compressed", "--max-time", "120",
                "-A", UA, "-o", str(dest), "-w", "%{http_code}", url])
        code = r.stdout.decode().strip().split()[-1] if r.stdout else "000"
        if code in ok and dest.exists() and dest.stat().st_size > 0:
            return True
    print(f"  !! FAILED {code} {url}")
    if dest.exists():
        dest.unlink()
    return False


def out_for(route: str) -> str:
    """Route -> local file. Slash-less clean URLs, so /x becomes x/index.html."""
    if route in ("/", ""):
        return "index.html"
    if route == "/404":
        return "404.html"
    return route.strip("/") + "/index.html"


def read_sitemap(base: str):
    """Routes from the source's sitemap.xml, in sitemap order, plus /404."""
    dest = CACHE / "sitemap.xml"
    if not fetch(base + "/sitemap.xml", dest):
        sys.exit("no sitemap.xml at the source: list routes in clone.json "
                 "under \"pages\" and re-run")
    xml = dest.read_text(encoding="utf-8", errors="replace")
    routes = []
    for loc in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml):
        p = urllib.parse.urlsplit(html.unescape(loc)).path or "/"
        p = "/" if p == "/" else "/" + p.strip("/")
        if p not in routes:
            routes.append(p)
    if "/404" not in routes:
        routes.append("/404")
    return routes


def load_config():
    """Merge clone.json with the command line. --source wins and is required once."""
    global BASE, HOSTS, URL_RE, PAGES
    cfg = json.loads(CONFIG.read_text()) if CONFIG.exists() else {}
    BASE = (arg("--source") or cfg.get("source") or "").rstrip("/")
    if not BASE:
        sys.exit("first run needs --source https://the-template.framer.website")

    extra = tuple(cfg.get("extra_hosts", []))
    HOSTS = tuple(dict.fromkeys(BASE_HOSTS + extra))
    URL_RE = re.compile(
        r"https://(?:" + "|".join(h.replace(".", r"\.") for h in HOSTS)
        + r")/[^\s\"'`\\<>]+")

    routes = cfg.get("pages") or read_sitemap(BASE)
    PAGES = {r: out_for(r) for r in routes}
    return cfg


def save_config(cfg, external):
    cfg.update({
        "source": BASE,
        "pages": list(PAGES.keys()),
        "extra_hosts": [h for h in HOSTS if h not in BASE_HOSTS],
        "unmirrored_hosts": sorted(external),
    })
    CONFIG.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")


def trim(tok: str) -> str:
    """Strip trailing punctuation the URL regex over-captured (css url(), csv, ...)."""
    while tok:
        c = tok[-1]
        if c == ")":
            if tok.count("(") >= tok.count(")"):
                break
            tok = tok[:-1]
        elif c in ",;:.!'\"}]":
            tok = tok[:-1]
        else:
            break
    return tok


def canon(url: str):
    """Dedupe key + canonical download url.

    Framer image URLs carry ?width=&height= (metadata only, same bytes) and
    ?scale-down-to=N (a genuinely different, smaller file). Collapse the former,
    keep the latter.
    """
    u = urllib.parse.urlsplit(html.unescape(url))
    q = urllib.parse.parse_qs(u.query)
    sd = q.get("scale-down-to", [None])[0]
    key = (u.netloc, urllib.parse.unquote(u.path), sd)
    return key, html.unescape(url)


def local_for(key, url) -> str:
    netloc, path, sd = key
    name = os.path.basename(path) or "index"
    stem, ext = os.path.splitext(name)
    ext = ext.lower()
    if not ext:
        ext = ".json" if "searchIndex" in stem else ".bin"
    # keep the basename byte-exact where legal: Framer builds some chunk URLs at
    # runtime from its own manifest, so a renamed chunk is a 404 nobody rewrites.
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem) or "asset"
    if sd:
        stem = f"{stem}-sd{sd}"
    d = DIR_FOR.get(ext, "assets/misc")
    cand = f"{d}/{stem}{ext}"
    if TAKEN.get(cand, key) != key:                     # different asset, same name
        import hashlib
        h = hashlib.md5(f"{netloc}{path}{sd}".encode()).hexdigest()[:6]
        cand = f"{d}/{stem}-{h}{ext}"
    TAKEN[cand] = key
    return cand


def add(url: str, queue: list):
    key, real = canon(url)
    if key not in ASSETS:
        ASSETS[key] = {"local": local_for(key, real), "url": real}
        queue.append(key)


def patch_cms(text: str, queue: list):
    """Pull each collection's .framercms blobs local and rebase the URL maths."""
    def repl(m):
        name, base = m.group(1), m.group(2)
        add(urllib.parse.urljoin(base, "./" + name).replace("/modules/", "/cms/"),
            queue)
        stub = os.path.basename(urllib.parse.urlsplit(base).path)
        return f"new URL(`./{name}`,new URL(`./{stub}`,import.meta.url).href)"
    return CMS_RE.sub(repl, text)


def discover(text: str, queue: list, base_url: str = None, external=None):
    for m in URL_RE.finditer(text):
        add(trim(m.group(0)), queue)
    if external is not None:
        src_host = urllib.parse.urlsplit(BASE).netloc
        for m in ANY_URL_RE.finditer(text):
            h = m.group(1)
            if h not in HOSTS and h != src_host and h not in IGNORE_HOSTS:
                external[h] = external.get(h, 0) + 1
    # Framer chunks import each other (and the badge) with bare relative
    # specifiers that no absolute-URL scan can see.
    if base_url:
        for m in REL_IMPORT_RE.finditer(text):
            u = urllib.parse.urljoin(base_url, m.group(1))
            if urllib.parse.urlsplit(u).netloc in HOSTS:
                add(u, queue)


def rel(from_file: str, to_asset: str) -> str:
    """Relative path from a page/asset at from_file to assets/... at to_asset."""
    depth = from_file.count("/")
    return ("../" * depth) + to_asset


def rewrite(text: str, from_file: str) -> str:
    def repl(m):
        tok = m.group(0)
        cleaned = trim(tok)
        tail = tok[len(cleaned):]
        key, _ = canon(cleaned)
        a = ASSETS.get(key)
        if not a:
            return tok
        return rel(from_file, a["local"]) + tail
    return URL_RE.sub(repl, text)


def main():
    CACHE.mkdir(exist_ok=True)
    cfg = load_config()
    queue = []
    external = {}

    # ---- 1. pages
    print(f"Source {BASE}\nFetching {len(PAGES)} pages")
    raw_pages = {}
    for route, out in PAGES.items():
        dest = CACHE / "pages" / out
        # the /404 route legitimately answers 404 while serving its page
        if not fetch(BASE + route, dest, ok=("200", "404")):
            sys.exit(f"cannot continue, page failed: {route}")
        raw_pages[route] = dest.read_text(encoding="utf-8", errors="replace")
        discover(raw_pages[route], queue, external=external)
    print(f"  {len(ASSETS)} assets referenced by pages")

    # ---- 2. assets, breadth-first (chunks reference chunks / images / fonts)
    done = 0
    while queue:
        key = queue.pop(0)
        a = ASSETS[key]
        dest = CACHE / a["local"]
        if fetch(a["url"], dest):
            done += 1
            if os.path.splitext(a["local"])[1].lower() in TEXT_EXT:
                text = patch_cms(dest.read_text(encoding="utf-8", errors="replace"),
                                 queue)
                PATCHED[key] = text
                discover(text, queue, base_url=a["url"], external=external)
        if done % 100 == 0:
            print(f"  {done} downloaded, {len(queue)} queued, {len(ASSETS)} known")
    print(f"  {done}/{len(ASSETS)} assets on disk")

    # ---- 3. write rewritten assets
    for key, a in ASSETS.items():
        src = CACHE / a["local"]
        if not src.exists():
            continue
        out = ROOT / a["local"]
        out.parent.mkdir(parents=True, exist_ok=True)
        if os.path.splitext(a["local"])[1].lower() in TEXT_EXT:
            text = PATCHED.get(key) or src.read_text(encoding="utf-8",
                                                     errors="replace")
            out.write_text(rewrite(text, a["local"]), encoding="utf-8")
        else:
            out.write_bytes(src.read_bytes())

    # ---- 4. write rewritten pages
    for route, out in PAGES.items():
        dest = ROOT / out
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(rewrite(raw_pages[route], out), encoding="utf-8")
    # Framer serves /404 as a route; keep both that and the host convention.
    if "/404" in raw_pages:
        (ROOT / "404").mkdir(exist_ok=True)
        (ROOT / "404/index.html").write_text(
            rewrite(raw_pages["/404"], "404/index.html"), encoding="utf-8")

    # opt-in: drop files under assets/ that this run did not produce (stale
    # names from an earlier run). Keep it opt-in so a later rebrand pass can add
    # its own files under assets/ without them being swept away.
    if "--prune" in sys.argv:
        known = {a["local"] for a in ASSETS.values()}
        for p in sorted((ROOT / "assets").rglob("*")):
            r = str(p.relative_to(ROOT))
            if p.is_file() and r not in known:
                print(f"  prune {r}")
                p.unlink()

    save_config(cfg, external)

    sizes = {}
    for p in ROOT.rglob("*"):
        if p.is_file() and ".mirror-cache" not in p.parts and ".git" not in p.parts:
            sizes[p.suffix.lower()] = sizes.get(p.suffix.lower(), 0) + p.stat().st_size
    total = sum(sizes.values())
    print(f"\nMirror written to {ROOT}  ({total/1e6:.1f} MB)")
    for ext, n in sorted(sizes.items(), key=lambda kv: -kv[1])[:8]:
        print(f"  {ext or '(none)':8} {n/1e6:7.2f} MB")

    if external:
        print("\nExternal hosts NOT mirrored (still loaded from someone else's "
              "server at runtime). Add any you want local to \"extra_hosts\" in "
              "clone.json and re-run:")
        for h, n in sorted(external.items(), key=lambda kv: -kv[1]):
            print(f"  {n:5}x  {h}")


if __name__ == "__main__":
    main()
