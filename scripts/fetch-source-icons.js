/**
 * Resolve each publisher's favicon and write it out as a seed.
 *
 *     node scripts/fetch-source-icons.js            # dry run, prints findings
 *     node scripts/fetch-source-icons.js --write    # writes db/seeds/022_source_icons.sql
 *
 * WHY A SCRIPT THAT WRITES A SEED, RATHER THAN AN INGESTION STEP
 *
 * A favicon changes roughly never, and fetching seven of them on every deploy
 * would make the deploy depend on seven news organisations' servers being up.
 * So this runs by hand, the result is committed as SQL, and a fresh clone gets
 * the icons with no network at all. The script is the record of how they were
 * obtained; the seed is the record of what was obtained.
 *
 * WHY THE BYTES ARE INLINED
 *
 * The full reasoning is in db/migrations/0018_source_icons.sql. Short version:
 * pointing a reader's browser at ft.com tells the FT who is reading this site,
 * and the CSP forbids it anyway.
 *
 * HOW AN ICON IS CHOSEN
 *
 * /favicon.ico is the last resort, not the first. It is usually a multi-size
 * ICO, which is both large and awkward, and plenty of publishers no longer
 * maintain it. The homepage's own <link rel="icon"> tags are what the browser
 * would use, so they are what this uses: prefer PNG or SVG, prefer a declared
 * size in the range a 20px slot can use, and fall back down the list.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { query, closePool } from '../src/server/db/pool.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SEED = new URL('../db/seeds/022_source_icons.sql', import.meta.url);

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/** The migration's own ceiling, minus room for the `data:image/...;base64,` prefix. */
const MAX_DATA_URI = 40_000;

/**
 * Named rather than borrowed: a source should be able to see who asked.
 *
 * The contact was the owner's personal Gmail until 4 Sep 2026. A User-Agent is
 * broadcast to every third-party server this script touches AND this is a public
 * repository, so that address was published twice over. The repo URL is the
 * contact route now, matching the four ingestion adapters; the owner's chosen
 * public contact is https://www.linkedin.com/in/joshuakhalili/ and is on the site.
 */
const USER_AGENT =
  'Diffusion/1.0 (+https://github.com/joshuakhalili/EconIntel)';

const TIMEOUT_MS = 15_000;

async function get(url, accept) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: accept },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}

/**
 * Score a candidate <link rel="icon">. Higher is better.
 *
 * A 32px PNG is the target: big enough not to look soft on a retina screen at
 * the 20px this is rendered at, small enough not to bloat every news response.
 * An SVG scores well because it is usually tiny and always sharp.
 */
function score({ href, sizes, type }) {
  let points = 0;

  const ext = href.split('?')[0].split('.').pop()?.toLowerCase();
  if (type?.includes('svg') || ext === 'svg') points += 40;
  else if (type?.includes('png') || ext === 'png') points += 30;
  else if (ext === 'ico') points += 5;

  const px = Number(String(sizes ?? '').split('x')[0]);
  if (Number.isFinite(px)) {
    // Closest to 32 wins, with a gentle penalty rather than a cliff so a
    // 48px icon still beats one with no declared size at all.
    points += Math.max(0, 25 - Math.abs(px - 32) / 4);
  }

  return points;
}

/**
 * Pull the frame closest to 32px out of a multi-size .ico and rebuild it as an
 * .ico of one frame.
 *
 * WHY THIS IS WORTH THIRTY LINES
 *
 * A publisher's favicon.ico routinely packs 16, 32, 48, 64 and 256px versions
 * into one file. CNBC's is 132kB and the Federal Reserve's is 32kB, both far
 * past what belongs inside every news response, and both would otherwise be
 * dropped for size — the site would show no mark for two real sources because
 * their icons were too GOOD.
 *
 * ICO is a trivial container: a six-byte header, then a sixteen-byte directory
 * entry per frame giving its size and where its bytes start. Copying one
 * entry's bytes out and writing a one-frame header in front of them needs no
 * image library and no decoding — the payload, whether BMP or PNG, is carried
 * across untouched.
 *
 * Returns null for anything that is not an icon directory, so a PNG served as
 * image/x-icon passes through unharmed.
 */

/**
 * A frame's real pixel width.
 *
 * The directory's width byte is one byte, so 256 is stored as 0 — and some
 * encoders write 0 for every frame regardless. MIT Technology Review's icon
 * does exactly that: six frames, all declaring width 0, none of them 256px.
 * Trusting the byte there picks a frame at random and labels it "256px",
 * which is worse than not labelling it at all.
 *
 * So the payload is asked instead. Both forms an ICO frame can take carry
 * their own dimensions in the first few bytes.
 */
function frameWidth(payload, declared) {
  // PNG: 8-byte signature, then an IHDR whose width is a big-endian uint32.
  if (payload.length >= 24 && payload.readUInt32BE(0) === 0x89504e47) {
    return payload.readUInt32BE(16);
  }
  // BMP inside an ICO: a BITMAPINFOHEADER whose biWidth is at offset 4. The
  // height is doubled to cover the AND mask, but the width is honest.
  if (payload.length >= 8 && payload.readUInt32LE(0) === 40) {
    return payload.readInt32LE(4);
  }
  // Neither form recognised. `declared` may be a real width or may be the 0
  // that means "not stated"; null rather than a guess, so the caller reports
  // "smallest of 6" instead of confidently naming a size it does not know.
  return declared || null;
}

function smallestIcoFrame(buffer, targetPx = 32) {
  if (buffer.length < 22) return null;
  if (buffer.readUInt16LE(0) !== 0 || buffer.readUInt16LE(2) !== 1) return null;

  const count = buffer.readUInt16LE(4);
  if (count < 2) return null; // one frame already — nothing to choose between

  let best = null;
  for (let i = 0; i < count; i += 1) {
    const at = 6 + i * 16;
    if (at + 16 > buffer.length) return null;
    const bytes = buffer.readUInt32LE(at + 8);
    const offset = buffer.readUInt32LE(at + 12);
    if (offset + bytes > buffer.length) return null;

    const width = frameWidth(buffer.subarray(offset, offset + bytes), buffer.readUInt8(at));

    // Ties broken by size, so an icon declaring several frames at the same
    // width contributes the cheapest of them.
    // An unknown width sorts last on distance but still competes on size,
    // which is what makes "smallest of 6" the sensible fallback.
    const distance = (width == null ? 1000 : Math.abs(width - targetPx)) * 1_000_000 + bytes;
    if (!best || distance < best.distance) {
      best = { distance, width, bytes, offset, entry: buffer.subarray(at, at + 16) };
    }
  }
  if (!best) return null;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.from(best.entry);
  entry.writeUInt32LE(22, 12); // the payload now starts right after the header

  return {
    buffer: Buffer.concat([header, entry, buffer.subarray(best.offset, best.offset + best.bytes)]),
    width: best.width,
    frames: count,
  };
}

/**
 * Icon paths that are conventional rather than declared.
 *
 * Tried after whatever the homepage advertises and before /favicon.ico. Three
 * of eight publishers either serve no <link rel="icon"> a parser can reach or
 * refuse the homepage request outright, and two of those do serve
 * /apple-touch-icon.png without complaint.
 */
const CONVENTIONAL = [
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/favicon-32x32.png',
  '/favicon.png',
];

/** Every icon the homepage declares, best first, then the conventional paths. */
async function candidates(homepage) {
  const found = [];

  try {
    const html = await (await get(homepage, 'text/html')).text();
    const $ = cheerio.load(html);

    $('link[rel]').each((_, el) => {
      const rel = String($(el).attr('rel') ?? '').toLowerCase();
      if (!/\b(icon|shortcut icon|apple-touch-icon)\b/.test(rel)) return;
      const href = $(el).attr('href');
      if (!href) return;
      found.push({
        url: new URL(href, homepage).toString(),
        points: score({ href, sizes: $(el).attr('sizes'), type: $(el).attr('type') }),
      });
    });
  } catch (error) {
    // A homepage that refuses a non-browser request is common and is not fatal
    // — /favicon.ico is usually served without the same scrutiny.
    console.log(`  ${DIM}homepage unreadable (${error.message}), trying /favicon.ico${RESET}`);
  }

  found.sort((a, b) => b.points - a.points);
  for (const path of CONVENTIONAL) {
    found.push({ url: new URL(path, homepage).toString(), points: -1 });
  }
  found.push({ url: new URL('/favicon.ico', homepage).toString(), points: -2 });
  return found;
}

async function resolveIcon(homepage) {
  for (const candidate of await candidates(homepage)) {
    try {
      const response = await get(candidate.url, 'image/*');
      const type = (response.headers.get('content-type') ?? '').split(';')[0].trim();

      // An HTML error page served with 200 is the usual failure here, and it
      // would be stored as a "logo" that renders as nothing.
      if (!type.startsWith('image/')) {
        throw new Error(`content-type ${type || 'missing'}`);
      }

      let bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0) throw new Error('empty response');

      // A multi-size .ico is mostly frames nobody here will use.
      let note = '';
      if (type === 'image/x-icon' || type === 'image/vnd.microsoft.icon') {
        const frame = smallestIcoFrame(bytes);
        if (frame && frame.buffer.length < bytes.length) {
          note = frame.width
            ? ` (${frame.width}px frame of ${frame.frames})`
            : ` (smallest of ${frame.frames} frames)`;
          bytes = frame.buffer;
        }
      }

      const dataUri = `data:${type};base64,${bytes.toString('base64')}`;
      if (dataUri.length > MAX_DATA_URI) {
        throw new Error(`${Math.round(dataUri.length / 1024)}kB — over the ceiling`);
      }

      return { dataUri, from: candidate.url, bytes: bytes.length, type, note };
    } catch (error) {
      console.log(`  ${DIM}${candidate.url} — ${error.message}${RESET}`);
    }
  }
  return null;
}

const write = process.argv.includes('--write');

const { rows: sources } = await query(
  `SELECT id, name, homepage_url
     FROM sources
    WHERE homepage_url IS NOT NULL
      AND id IN (SELECT DISTINCT source_id FROM documents)
    ORDER BY id`
);

console.log(
  `Resolving icons for ${sources.length} source(s) that actually have documents.\n`
);

const resolved = [];
const failed = [];

for (const source of sources) {
  console.log(`${source.name} ${DIM}${source.homepage_url}${RESET}`);
  const icon = await resolveIcon(source.homepage_url);
  if (icon) {
    console.log(
      `  ${GREEN}✓${RESET} ${icon.type} ${Math.round(icon.bytes / 102.4) / 10}kB${icon.note} ` +
        `${DIM}${icon.from}${RESET}`
    );
    resolved.push({ ...source, ...icon });
  } else {
    console.log(`  ${RED}✗ no usable icon${RESET}`);
    failed.push(source);
  }
}

console.log(
  `\n${GREEN}✓${RESET} ${resolved.length} resolved` +
    (failed.length ? `, ${YELLOW}${failed.length} without an icon${RESET}` : '')
);

if (!write) {
  console.log(`${DIM}Dry run. Pass --write to update db/seeds/022_source_icons.sql${RESET}`);
  await closePool();
  process.exit(failed.length ? 1 : 0);
}

/*
 * The seed is generated rather than hand-maintained, and it is idempotent for
 * the same reason every other seed here is: a re-run must not depend on
 * whether it has run before.
 *
 * A source with no icon is left NULL rather than given a placeholder. The news
 * card renders the publisher's name either way; an invented mark would be a
 * small lie of exactly the kind this project spends its effort avoiding.
 */
const today = new Date().toISOString().slice(0, 10);
const body = resolved
  .map(
    (r) =>
      `-- ${r.name} — ${r.type}, ${Math.round(r.bytes / 102.4) / 10}kB, from ${r.from}\n` +
      `UPDATE sources SET icon_data_uri = '${r.dataUri}' WHERE id = '${r.id}';`
  )
  .join('\n\n');

writeFileSync(
  SEED,
  `-- ============================================================================\n` +
    `-- 022_source_icons.sql — publisher marks, fetched ${today}\n` +
    `--\n` +
    `-- GENERATED by scripts/fetch-source-icons.js. Do not hand-edit: re-run\n` +
    `--     node scripts/fetch-source-icons.js --write\n` +
    `-- and commit the result, which is also the record of where each icon came\n` +
    `-- from and how big it was on the day it was taken.\n` +
    `--\n` +
    `-- These are data: URIs rather than links, on purpose. The reasoning is in\n` +
    `-- db/migrations/0018_source_icons.sql: linking would tell every publisher\n` +
    `-- who reads this site, and the CSP forbids it.\n` +
    `--\n` +
    (failed.length
      ? `-- No icon could be resolved for: ${failed.map((f) => f.name).join(', ')}.\n` +
        `-- Those rows stay NULL and their cards render the name alone.\n--\n`
      : '') +
    `-- ============================================================================\n\n` +
    `${body}\n`,
  'utf8'
);

console.log(`${GREEN}✓${RESET} wrote ${SEED.pathname.replace(ROOT, '')}`);
await closePool();
