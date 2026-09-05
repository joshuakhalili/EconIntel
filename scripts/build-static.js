/**
 * Assemble the two halves of the site into one static directory.
 *
 * Express serves this site from two roots and resolves the overlap by ORDER:
 * try `landing/`, fall through to `public/`. A CDN has no fall-through, so the
 * deploy needs a single directory where every path is already decided.
 *
 * Three things that ordering was quietly handling, which have to become
 * explicit here:
 *
 * 1. BOTH HALVES HAVE AN index.html. `landing/index.html` is the front door;
 *    `public/index.html` is the React shell. Express tries landing first and
 *    wins. Here the shell is written to `app.html` and every app route is
 *    rewritten to it in vercel.json.
 *
 * 2. `landing/` CONTAINS MORE THAN THE SITE. `docs/` is the clone pipeline and
 *    `.mirror-cache/` is the original Framer template as downloaded, before the
 *    content map replaced its copy with Diffusion's. Both were being served to
 *    anyone who asked until 2026-08-30. Neither is deployed.
 *
 * 3. THE WAITLIST PAGES ARE NOT SHIPPED AT ALL. `/waitlist` renders an invented
 *    "1,200+ people on the waitlist" — a fabricated number on a site whose
 *    first rule is to invent nothing. Express redirects them; here they are
 *    simply absent, and vercel.json redirects the URLs.
 *
 * The two `assets/` directories merge safely and that is not luck: Framer
 * content-hashes its filenames and Vite emits `index-<hash>`, so a collision
 * would require a hash collision. The check below asserts it anyway, because
 * "cannot collide" is the kind of claim that stops being true silently.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * IT ALSO WRITES A SHELL PER PAGE, WHICH IS WHY IT TALKS TO THE DATABASE
 *
 * Measured on production, 2026-09-04: `/q/adoption` returned 200 and 2,832
 * bytes — the app shell, carrying the site-wide title, no description of its
 * own and no og or twitter tags of any kind. All 23 question pages shared one
 * title, and the sitemap listed three URLs, none of them a question. So no
 * question page could be found through search, linked with a preview,
 * archived, or cited, on a project written for researchers.
 *
 * The sign-in gate stays; the DATA behind a page still needs a session. What
 * changes is that the SHELL a crawler receives carries that page's own title,
 * description, canonical and og tags. `AppShell` already sets the same title
 * client-side, from the same rows — this is that, rendered early enough for a
 * machine that does not run JavaScript.
 *
 * Every question, lens, series and scenario gets a file. That is more than the
 * meta tags need, and it is deliberate: a path that exists as a file is served
 * by the CDN before `vercel.json`'s rewrite table is consulted, so those
 * addresses never reach the function that answers 404 for the ones that are
 * left. Fast where the page exists, honest where it does not.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *
 * WHAT A DESCRIPTION IS ALLOWED TO SAY
 *
 * A meta description is the page as a stranger meets it: the grey line under a
 * search result, the body of a social card, the summary an archive keeps. It is
 * quoted, and it is quoted without the page. So it has to be true on its own,
 * and it is assembled under three rules, in order of how much they cost:
 *
 *   1. WHOLE SENTENCES ONLY. Cutting editorial prose at a character count is
 *      how a description ends "…graduates aged 25 to 34 is 3.8% — both well"
 *      and changes what the page says.
 *
 *   2. NOTHING THAT A LATER SENTENCE OVERTURNS. Whole sentences are not enough
 *      on their own. `/q/entry-level` answers "not yet", then reverses itself
 *      one sentence later — "But several studies measuring at a finer grain say
 *      otherwise" — and `/q/vacancies` reports the clearest signal on the site
 *      before "The OECD … finds the opposite". Both descriptions ended at a
 *      clean full stop and both said the opposite of their page. So when the
 *      prose that does NOT fit contains a reversal, the prose is dropped whole
 *      and the description falls back to the subtitle, which describes the page
 *      without answering it. See `REVERSES` for what that costs.
 *
 *   3. NEVER EMPTY. Three of the 140 series shells shipped
 *      `<meta name="description" content="">` — a page asserting it has nothing
 *      to say — because their one stored sentence was longer than the budget on
 *      its own. A series always has a name and a unit, so there is always
 *      something true to fall back to; and if even that fails, `shellFor` omits
 *      the tag rather than shipping an empty one.
 *
 * Nothing here writes prose. Every description is stored text, cut at a
 * sentence boundary or dropped — the same rule `indicatorProse.js` states for
 * the same reason.
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* The same trimmer /data and /data/:id render through. `indicators.description`
   holds build notes as well as reader prose, and without this one shipped
   series description read "A change-type series, so it renders on a diverging
   palette — negative growth must be visually distinct from positive." to
   anyone who shared the link. */
import { readerDescription } from '../src/client/components/indicatorProse.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANDING = path.join(ROOT, 'landing');
const PUBLIC = path.join(ROOT, 'public');
const OUT = path.join(ROOT, 'dist');

/**
 * The host every canonical and og:url is written against.
 *
 * A canonical tag pointing at a preview deployment tells a crawler that the
 * preview is the real page, so this is a decision and not a guess. It matches
 * the host already written into landing/sitemap.xml and robots.txt.
 */
const SITE = 'https://trydiffusion.vercel.app';

/** Meta descriptions: whole sentences only, up to this many characters. */
const DESCRIPTION_BUDGET = 300;

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

/** Never deployed: build tooling, the un-hardened original, the fabricated page. */
const EXCLUDE_FROM_LANDING = new Set([
  'docs',
  '.mirror-cache',
  'waitlist',
  'thanks',
]);

function fail(message) {
  console.error(`\n${RED}✗ ${message}${RESET}`);
  process.exit(1);
}

/** Every file under `dir`, as paths relative to it. */
function filesUnder(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory()
      ? filesUnder(full, base)
      : [path.relative(base, full)];
  });
}

// ── Descriptions ─────────────────────────────────────────────────────────────

const escapeAttribute = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * A sentence opening that overturns the sentences before it.
 *
 * THIS IS DELIBERATELY OVER-CAUTIOUS AND IT IS WORTH KNOWING WHAT THAT COSTS.
 *
 * The test is syntactic: it cannot tell whether a "But" argues with the text
 * that was kept or with a sentence that was itself dropped. Across the 23
 * questions, 5 lenses and 1 scenario in the database on 2026-09-04 it fires on
 * three pages. Two are the real thing — `/q/entry-level` and `/q/vacancies`,
 * whose descriptions each asserted the opposite of their page's finding. On the
 * third, `/q/exposed-productivity`, the "But" contrasts with a dropped sentence
 * about the EU27 series and the kept text was accurate; that page loses a
 * sentence it could have kept.
 *
 * One accurate sentence, against two social cards that contradicted their own
 * pages. Over-caution is the cheaper error here, and the expensive one is the
 * one this project exists to avoid.
 *
 * "Neither" and "Nor" are NOT in this list: in this editorial voice they
 * continue a negation rather than reverse it ("Both show a long decline …
 * Neither shows one accelerating"), and including them cost `/q/clerical` a
 * description that was already true.
 */
const REVERSES =
  /^(But|However|Yet|Although|Though|Nevertheless|Nonetheless|Whereas|On the other hand|In contrast|By contrast|That said)\b|\b(finds? the opposite|says? otherwise)\b/;

/**
 * Split stored prose into sentences.
 *
 * The split requires whitespace and a capital after the full stop, which is
 * what keeps "8.5%", "1.76%" and "$13,543" intact — a naive split on "." would
 * cut a figure in half and publish the half.
 */
const sentences = (prose) =>
  String(prose)
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z“"(])/)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * A description made of WHOLE SENTENCES from stored prose, never a truncation.
 *
 * `lead` is a label — a subtitle, a series name — and is always kept, budget or
 * not, because it is the one part of the description that answers nothing and
 * so cannot be contradicted by what follows it. Sentences of `prose` are then
 * added while they fit; see the three rules in this file's header for what
 * happens when they do not.
 */
export function describe(lead, prose, budget = DESCRIPTION_BUDGET) {
  let out = (lead ?? '').trim();
  // Subtitles and units are labels, not sentences, and run straight into the
  // prose that follows without one: "across eight countries These series say".
  if (out && !/[.!?]$/.test(out)) out += '.';
  if (!prose) return out;

  const all = sentences(prose);
  let taken = 0;
  for (const sentence of all) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > budget) break;
    out = next;
    taken += 1;
  }

  // Rule 2. What was left behind decides whether what was kept may be quoted.
  const dropped = all.slice(taken);
  if (dropped.some((sentence) => REVERSES.test(sentence))) {
    return describe(lead, null, budget);
  }
  return out;
}

/**
 * One series, described from the two things every series has.
 *
 * The stored description goes through `readerDescription` first, so a note
 * addressed to whoever wires the adapter does not become the page's public
 * summary. What survives may still be a single sentence longer than the whole
 * budget — three of the 140 are — and in that case nothing of it can be quoted
 * whole, so the fall-back is the series' own name with its unit, which is
 * short, true and always present.
 *
 * The unit trails rather than leads: it is a label, and "percent." as an
 * opening sentence reads as a mistake.
 */
export function describeIndicator({ name, unit, description }, budget = DESCRIPTION_BUDGET) {
  const unitClause = unit ? `Unit: ${unit}.` : '';
  const prose = readerDescription(description);
  const full = describe(null, prose ? `${prose} ${unitClause}`.trim() : unitClause, budget);
  return full || describe(name, unitClause, budget);
}

/** The built shell, with this page's head written into it. */
export function shellFor(shell, { title, description, url, type }) {
  const tags = [
    `<title>${escapeAttribute(title)}</title>`,
    /* An empty description is a page asserting it has nothing to say, which is
       worse than a page that says nothing — a crawler reads the first as a
       claim. When there is no description the tags are simply absent. */
    ...(description
      ? [
          `<meta name="description" content="${escapeAttribute(description)}">`,
        ]
      : []),
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="Diffusion">`,
    `<meta property="og:title" content="${escapeAttribute(title)}">`,
    ...(description
      ? [`<meta property="og:description" content="${escapeAttribute(description)}">`]
      : []),
    `<meta property="og:url" content="${url}">`,
    /* `summary`, not `summary_large_image`. There is no image for these pages
       and claiming a large one produces an empty card; the landing page's
       og:image is a separate problem and is not borrowed here. */
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeAttribute(title)}">`,
    ...(description
      ? [`<meta name="twitter:description" content="${escapeAttribute(description)}">`]
      : []),
  ].join('\n');

  const stripped = shell
    .replace(/<title>[\s\S]*?<\/title>\n?/, '')
    .replace(/<meta name="description"[^>]*>\n?/, '');

  if (!stripped.includes('</head>')) fail('the app shell has no </head> to write into');
  // A function replacement: a description containing `$&` must not be read as
  // a backreference.
  return stripped.replace('</head>', () => `${tags}\n</head>`);
}

/**
 * Every page that has a row behind it.
 *
 * Read at build time rather than baked into a list, because the list changes
 * without any code changing — `035_activate_questions.sql` switched twelve
 * questions on in one seed run.
 *
 * The activity conditions match the API handlers exactly, so a page that gets
 * a shell is a page that renders: `getQuestion`/`getLens` require `is_active`,
 * `getScenario` requires `status = 'published'`, and `/api/indicators/:id`
 * applies no filter at all.
 */
async function pagesFromDatabase() {
  let db;
  try {
    db = await import('../src/server/db/pool.js');
  } catch (error) {
    return { error };
  }

  try {
    const [questions, lenses, indicators, scenarios] = await Promise.all([
      db.query(
        `SELECT slug, question, subtitle, answer_plain
           FROM questions WHERE is_active ORDER BY slug`
      ),
      db.query(
        `SELECT slug, name, subtitle, thesis_plain
           FROM lenses WHERE is_active ORDER BY sort_order`
      ),
      db.query(`SELECT id, name, unit, description FROM indicators ORDER BY id`),
      db.query(
        `SELECT slug, name, subtitle, thesis_plain
           FROM simulation_scenarios WHERE status = 'published' ORDER BY slug`
      ),
    ]);

    return {
      pages: [
        ...questions.rows.map((row) => ({
          route: 'q',
          id: row.slug,
          type: 'article',
          inSitemap: true,
          title: `${row.question} — Diffusion`,
          description: describe(row.subtitle, row.answer_plain),
        })),
        ...lenses.rows.map((row) => ({
          route: 'lens',
          id: row.slug,
          type: 'website',
          inSitemap: true,
          title: `${row.name} — Diffusion`,
          description: describe(row.subtitle, row.thesis_plain),
        })),
        ...indicators.rows.map((row) => ({
          route: 'data',
          id: row.id,
          type: 'website',
          /* Prerendered but NOT advertised. These are 140 catalogue entries
             behind the sign-in gate; the page a reader wants indexed is the
             question that argues from them. */
          inSitemap: false,
          title: `${row.name} — Diffusion`,
          description: describeIndicator(row),
        })),
        ...scenarios.rows.map((row) => ({
          route: 'simulate',
          id: row.slug,
          type: 'article',
          inSitemap: true,
          title: `${row.name} — Diffusion`,
          description: describe(row.subtitle, row.thesis_plain),
        })),
      ],
    };
  } catch (error) {
    return { error };
  } finally {
    await db.closePool();
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

/*
 * Only when run directly. The description rules above are imported by
 * `src/server/page-descriptions.test.js`, and without this guard that import
 * would delete `dist/`, open a database connection and rebuild the site as a
 * side effect of running the test suite. Same guard, same reason, as the one
 * in `vercel-config.js`.
 */
const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  if (!existsSync(PUBLIC) || !existsSync(path.join(PUBLIC, 'index.html'))) {
    fail('public/index.html is missing — run `vite build` before this script.');
  }
  if (!existsSync(path.join(LANDING, 'index.html'))) {
    fail('landing/index.html is missing — the landing mirror is not checked out.');
  }

  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  // ── The landing half, minus everything that is not the site ────────────────
  for (const entry of readdirSync(LANDING, { withFileTypes: true })) {
    if (EXCLUDE_FROM_LANDING.has(entry.name)) continue;
    cpSync(path.join(LANDING, entry.name), path.join(OUT, entry.name), {
      recursive: true,
    });
  }

  // ── Collision check, before the app half can overwrite anything ────────────
  const landingFiles = new Set(filesUnder(OUT));
  const appFiles = filesUnder(PUBLIC);
  const collisions = appFiles.filter(
    (f) => landingFiles.has(f) && f !== 'index.html'
  );
  if (collisions.length > 0) {
    fail(
      `${collisions.length} file(s) exist in both halves and one would silently ` +
        `overwrite the other:\n  ${collisions.join('\n  ')}\n` +
        `${DIM}Both builders content-hash their output, so this should be ` +
        `impossible. Something has changed about how one of them names files.${RESET}`
    );
  }

  /*
   * ── The app half ──────────────────────────────────────────────────────────
   *
   * Entry by entry, with the shell redirected to `app.html` as it is copied.
   *
   * Copying the directory wholesale and renaming afterwards does NOT work, and
   * the way it fails is quiet: `cpSync(PUBLIC, OUT)` writes the React shell over
   * the landing page's `index.html` first, so the subsequent rename moves the
   * shell to `app.html` and leaves no `/` at all. The front door would simply be
   * missing from the deploy. The assertions below catch it, which is why they
   * are there.
   *
   * The shell keeps `app.html` so the landing page keeps `/`. Every app route is
   * rewritten to it in vercel.json; the two lists are kept in step by
   * scripts/check-routes.js.
   */
  for (const entry of readdirSync(PUBLIC, { withFileTypes: true })) {
    const destination =
      entry.name === 'index.html' ? 'app.html' : entry.name;
    cpSync(path.join(PUBLIC, entry.name), path.join(OUT, destination), {
      recursive: true,
    });
  }

  // ── Report, and assert the result is actually usable ───────────────────────
  for (const required of ['index.html', 'app.html']) {
    if (!existsSync(path.join(OUT, required))) fail(`dist/${required} was not produced`);
  }
  for (const forbidden of [...EXCLUDE_FROM_LANDING]) {
    if (existsSync(path.join(OUT, forbidden))) fail(`dist/${forbidden} should not exist`);
  }

  // ── A shell per page, and a sitemap that knows they exist ──────────────────

  const shell = readFileSync(path.join(OUT, 'app.html'), 'utf8');
  const { pages, error: databaseError } = await pagesFromDatabase();

  if (databaseError) {
    /*
     * On a hosted build this is fatal. Shipping without it is not a smaller
     * deploy, it is 23 question pages that no longer resolve to a file — every
     * one of them falling through to the function, which is the slow path, and
     * every one of them back to a single shared title.
     *
     * On a developer's machine, without a database, it is a warning: the site
     * still builds and still runs.
     */
    const hosted = Boolean(process.env.VERCEL || process.env.CI);
    if (hosted) {
      fail(
        `could not read the pages from the database, so no per-page shell was ` +
          `written and the sitemap would ship with three URLs.\n  ${databaseError.message}`
      );
    }
    console.warn(
      `${RED}!${RESET} no database — dist/ has NO per-page shells and the ` +
        `landing sitemap was copied unchanged.\n  ${DIM}${databaseError.message}${RESET}`
    );
  } else {
    /*
     * The catalogue page, which is the one static route that now shares a name
     * with a directory.
     *
     * `/data` rewrites to the shell, and the 140 series shells live in
     * `dist/data/`. A directory with no index.html is not a page, so the rewrite
     * should still answer `/data` — but "should" is doing the work in that
     * sentence, and the failure mode is the catalogue 404ing in production while
     * every local check passes. A real file at `dist/data.html` settles it.
     *
     * Both strings are DataPage.jsx's own `usePageTitle` arguments, verbatim:
     * `usePageTitle('The data', 'Every series behind this dashboard')` at
     * DataPage.jsx:54. The title gains the same " — Diffusion" that AppShell
     * appends client-side, and the subtitle gains the full stop that `describe`
     * adds to every other subtitle on the site. Nothing else is added: an
     * earlier version of this line described the page in words that appear
     * nowhere in it, under a comment claiming they were copied.
     */
    pages.push({
      route: '',
      id: 'data',
      type: 'website',
      inSitemap: false,
      title: 'The data — Diffusion',
      description: describe('Every series behind this dashboard', null),
    });

    /** `/q/entry-level`, and `/data` for the one page with no route prefix. */
    const href = (page) => (page.route ? `/${page.route}/${page.id}` : `/${page.id}`);

    for (const page of pages) {
      // Ids come out of the database and are about to become file paths.
      if (page.id.includes('/') || page.id.includes('\\') || page.id.startsWith('.')) {
        fail(`"${page.id}" cannot be a file name — it would escape dist/${page.route}/`);
      }

      const file = path.join(OUT, `${href(page)}.html`);
      if (existsSync(file)) fail(`dist${href(page)}.html already exists`);

      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(
        file,
        shellFor(shell, {
          title: page.title,
          description: page.description,
          url: `${SITE}${href(page)}`,
          type: page.type,
        })
      );
    }

    /*
     * The sitemap is REWRITTEN here rather than edited in landing/, because the
     * landing mirror is generated and hand-editing it is how a change gets lost
     * on the next clone. Its three URLs are read back out rather than retyped,
     * so the front door and the two legal pages cannot drift.
     */
    const source = readFileSync(path.join(LANDING, 'sitemap.xml'), 'utf8');
    const existing = [...source.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => loc);
    if (existing.length === 0) fail('landing/sitemap.xml lists no URLs — the parse is wrong');

    const added = pages.filter((page) => page.inSitemap).map((page) => `${SITE}${href(page)}`);
    const urls = [...existing, ...added]
      .map((loc) => `  <url><loc>${loc}</loc></url>`)
      .join('\n');

    writeFileSync(
      path.join(OUT, 'sitemap.xml'),
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
    );

    const withoutDescription = pages.filter((page) => !page.description);
    console.log(
      `${GREEN}✓${RESET} ${pages.length} page shells written ` +
        `${DIM}(sitemap: ${existing.length} landing + ${added.length} app URLs` +
        `${withoutDescription.length > 0 ? `; ${withoutDescription.length} with no description` : ''})${RESET}`
    );
  }

  const all = filesUnder(OUT);
  const bytes = all.reduce((sum, f) => sum + statSync(path.join(OUT, f)).size, 0);
  console.log(
    `${GREEN}✓${RESET} dist/ assembled ${DIM}(${all.length} files, ` +
      `${(bytes / 1024 / 1024).toFixed(1)} MB — landing at /, app shell at ` +
      `/app.html)${RESET}`
  );
}
