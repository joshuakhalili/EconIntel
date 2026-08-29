#!/usr/bin/env python3
"""
Read and rewrite Framer's .framercms CMS blobs.

The blobs are the only place a blog or project collection keeps its real
content, and hydration renders index cards from them, so a text swap that skips
them shows template content on every card while the page body looks correct.

They are a simple length-prefixed binary: a value is a tag byte, a 4-byte
big-endian length, then that many UTF-8 bytes. Tag 0x0c is a plain string
(title, slug, author); 0x0a is a JSON payload (image fields carrying src +
srcSet); 0x0b is rich text (article bodies) and carries one extra flag byte
before its length. Replacing a value therefore means rewriting its length
prefix too, and every later byte offset shifts.

THAT SHIFT IS THE TRAP. The JS chunks address blobs BY BYTE OFFSET and fetch
them with HTTP range requests, which only Framer's own CDN serves. On any other
host the range request fails and Framer switches the page to non-interactive.
So: either patch the loader to read whole files and leave the blobs
byte-for-byte pristine, or strip the runtime entirely (see staticise.py). Use
this tool to READ what is in there, and only rewrite once you have confirmed
the loader tolerates it.

  python3 docs/blobtool.py list [substring]   # every string in every blob
  python3 docs/blobtool.py check              # round-trip parse, no writes

Import `strings()` and `rewrite()` from a build script to do the actual swap.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BLOBS = sorted((ROOT / "assets/js").glob("*.framercms"))
# tag -> bytes of header between the tag and the 4-byte big-endian length.
TAGS = {0x0C: 0, 0x0A: 0, 0x0B: 1}
MAXLEN = 500_000


def strings(buf: bytes):
    """Yield (offset, tag, header size, payload length, text) per tagged value."""
    i, n = 0, len(buf)
    while i < n:
        extra = TAGS.get(buf[i])
        if extra is not None:
            hdr = 1 + extra + 4
            if i + hdr <= n:
                ln = int.from_bytes(buf[i + 1 + extra:i + hdr], "big")
                if 0 < ln <= MAXLEN and i + hdr + ln <= n:
                    try:
                        txt = buf[i + hdr:i + hdr + ln].decode("utf-8")
                    except UnicodeDecodeError:
                        i += 1
                        continue
                    yield i, buf[i], hdr, ln, txt
                    i += hdr + ln
                    continue
        i += 1


def rewrite(buf: bytes, edit) -> tuple:
    """Return (new bytes, hits). `edit` is {old: new} or a callable(text)->text
    returning the same text when there is nothing to change."""
    fn = edit if callable(edit) else (lambda t: edit.get(t, t))
    out, last, hits = bytearray(), 0, 0
    for off, tag, hdr, ln, txt in strings(buf):
        new_txt = fn(txt)
        if new_txt != txt:
            new = new_txt.encode("utf-8")
            out += buf[last:off]
            out += buf[off:off + hdr - 4]                 # tag (+ flag byte)
            out += len(new).to_bytes(4, "big") + new
            last = off + hdr + ln
            hits += 1
    out += buf[last:]
    return bytes(out), hits


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    needle = sys.argv[2] if len(sys.argv) > 2 else None
    if not BLOBS:
        print("no .framercms blobs in assets/js: this template has no CMS, "
              "or mirror.py has not run")
        return
    for p in BLOBS:
        buf = p.read_bytes()
        found = list(strings(buf))
        covered = sum(hdr + ln for _, _, hdr, ln, _ in found)
        print(f"\n=== {p.name}  {len(buf)} bytes, {len(found)} strings, "
              f"{covered * 100 // len(buf)}% of file is string data")
        if cmd == "check":
            continue
        for off, tag, hdr, ln, txt in found:
            if needle and needle.lower() not in txt.lower():
                continue
            one = txt.replace("\n", "\\n")
            print(f"  {tag:#04x} @{off:6} {ln:6}  {one[:150]}")


if __name__ == "__main__":
    main()
