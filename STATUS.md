# Diffusion — where things stand

Read this first in a new session. Say "read STATUS.md and catch me up" and Claude
will pick up from here without you re-explaining anything.

Last updated: 2026-08-30.

## The project is now called Diffusion (was EconIntel)

In economics, *technology diffusion* is the term for how an innovation spreads
through an economy and shows up in measured output. In AI, diffusion models are
a core architecture. The name states the subject and the thesis at once.

The rename is done in code. **Two things still carry the old name and are
Phase 6 work:** the GitHub repo is still `joshuakhalili/EconIntel`, and the
outbound `User-Agent` strings in the ingestion adapters already point at
`github.com/joshuakhalili/Diffusion`, which will 404 until the repo is
renamed. The contact email in those strings is correct and working, which is
what SEC EDGAR actually requires. The folder on disk is still
`~/Projects/EconIntel`.

`legacy/` still says EconIntel throughout. That is dead reference code kept
for behaviour that was tuned over time; it is loaded by nothing.

**The concept was substantially rethought on 2026-08-28.** The full decision
record — purpose, audience, the lens taxonomy replacement, the research layer,
the circular-financing feature, and what is deliberately deferred — is in
`CONCEPT-GRILL-LOG.md`. Read that before planning any new work; it is more
current than the sections below.

**Standing rule for this file:** nothing gets written here as a present-tense
fact ("X prevents Y", "the rule that governs Z") unless there's a code path
that actually enforces it right now. Schema and intent go under "What's NOT
built yet" or get an explicit "designed, not enforced" caveat — a grill session
on 2026-08-28 found the narration/grounding rule below stated as governing
fact with zero enforcing code behind it.

## The front end was rewritten in React — read this first

The hand-built `public/app.js` is gone. The front end is now React 19 + Tailwind
v4 + **BoardUI** components, built by Vite from `src/client/` into `public/`.

**`public/` is build output now and is gitignored.** Nothing in it is source.
If you edit a file there it will be destroyed by the next build. The old
hand-written files are kept in `legacy/` as the reference for behaviour that was
tuned over time; they are not loaded by anything and can be deleted once you are
confident nothing else needs porting.

**You must run a build before `npm start` shows anything**, because `public/`
starts empty on a fresh clone:

```
npm install
npm run build      # writes public/
npm start          # http://localhost:3000
```

For development use `npm run dev`, which runs Express on 3000 and Vite on 5173
together — open **5173**, which hot-reloads and proxies `/api` to Express.

Two things BoardUI assumes that are not true here, both handled without editing
its generated files so `npx boardui@latest init` can be re-run later:

- It is built for Next.js and expects `next/font` to define `--font-inter` and
  `--font-mono-source`. Those are defined in `src/client/styles/app.css`.
- Its dark mode keys off a `.dark` class, so the app uses that too rather than
  the old `data-theme` attribute.

**BoardUI's chart components are all paid**, as are its page templates. Charts
are **Recharts**. The free BoardUI set is still large (28 base components plus
Data Table, Sidebar, Settings Modal, Notification Center) — run
`npx boardui@latest list` to see it.

## What this project is

A public dashboard measuring AI's economic effect worldwide. Not a database
browser — organised as **lenses**, each containing questions, contextual price
tickers, and news. Two reading modes (Plain / Technical) show different registers
of the same stored answer, not the same text with jargon added.

The five lenses are classical economics subfields, ordered the way the causation
is supposed to run: **Investment & Capital → Growth & Productivity → Labour
Markets → Prices & Markets → Policy & Regulation**. They replaced an earlier
mixed set (Money / Work / Infrastructure / Policy / Adoption) that mixed inputs,
outputs and mechanisms at the same level — see `CONCEPT-GRILL-LOG.md`.

**The rule that will govern the LLM layer, once it exists:** an LLM must never be
asked to invent a number or a citation — only handed SQL-computed values and
stored claims and asked to connect them in a sentence. **This is schema, not
enforcement.** The `narrations` table (`input_hash`, `grounding`, `prompt_version`
— see `0006_analysis.sql`) exists to key and cache that rule once something calls
an LLM, but as of this writing nothing in `src/` constructs a prompt, calls
Cloudflare Workers AI, or validates model output against it. There is no LLM call
site yet, so there is currently nothing for this rule to protect. Do not describe
it as active until a call site exists and this note is updated.

## The site is now two halves, served as one

**`landing/` is a cloned static site.** A hardened mirror of a Framer template
(`atmos-system.framer.website`), committed as source. It owns `/`, `/login`'s
CTAs, `/waitlist`, `/thanks` and `/legal/*`. Its build pipeline lives in
`landing/docs/`: edit `content_diffusion.py`, then
`bash docs/reset.sh && python3 docs/build-diffusion.py`. **Never hand-edit the
built HTML** — the build refuses to run twice and resets from the
`pristine-mirror` tag in `~/Projects/diffusion-landing`.

**`src/client/` is the React app.** Everything else: lenses, questions, `/data`,
`/explore`, `/news`, `/pipeline`.

Express serves both from one origin (`src/server/index.js`). They can share
`/assets` only because their filenames cannot collide — Framer content-hashes,
Vite emits `index-<hash>`.

## Sign-in

Reading the data needs a free account; the landing page stays public. Two
routes, **no password by either**: a name and an email (unverified — a
readership record, not a security check), or GitHub.

`readers_editor_must_be_verified` in the database refuses `is_editor` on any
non-GitHub identity. Editing rights are Joshua's alone, granted by hand in SQL,
and nothing in the app can set them.

Needs `SESSION_SECRET` in `.env` (already set locally). `GITHUB_CLIENT_ID` and
`GITHUB_CLIENT_SECRET` are optional — without them the GitHub button is hidden
and email sign-in still works.

## The app is dark only

Light mode is deleted, not fixed. `atmos.css` is the whole token layer and
re-points BoardUI's neutral ramp, which is what every one of its ~60 surface
tokens resolves through. `index.html` hardcodes `class="dark"`.

Type matches the landing page: Inter Display (self-hosted from the same woff2
that page serves), Trispace for eyebrows, Fragment Mono for figures.

Five lens pages, each with its own signature module in
`components/lens/LensSignature.jsx` — Prices shows the divergence, Investment a
materials board, Labour the disagreement, Growth adoption ranked, Policy the
rule counts. Per-lens accent in `lib/lensAccent.js` is **chrome only** and must
never draw a data series.

## On GitHub, public, `main` is current

Pushed 2026-08-29. `react-rewrite` was fast-forward merged into `main`, and the
two are kept in sync — there is no longer a "working vanilla version" anywhere;
the React site *is* the site. Repo: `github.com/joshuakhalili/EconIntel`, public,
0 open Dependabot alerts.

**There is no LICENSE file.** The README says "cite, don't redistribute", but
with no licence declared, nobody can legally reuse the code at all. MIT is the
usual answer for a portfolio project; it is a decision, not an oversight, and
it is still open.

Two remote branches are not local work: a Dependabot branch (`undici-7.29.0`)
and `claude/capabilities-workflow-questions-76ss3l`. Neither is merged.

## Stack

Node 24 ESM, Express 4, Postgres 18.4 on Render (Frankfurt). Front end is
React 19 + Tailwind v4 + BoardUI, bundled by Vite; charts are Recharts; data
fetching is TanStack Query; routing is React Router on real paths (Express has
a catch-all so a deep link loads). Cloudflare Workers AI for the LLM layer
(free tier, 10k neurons/day) — key is in `.env`, never committed.

## What's built and working

- **Data:** 76,788 observations. 115 indicators declared, **111 of which have
  any observations** — the other four are the declared-but-uncomputed ones
  listed under "Known broken things". 50 countries, but see the country note
  below before quoting that number. 24 sources:
  FRED, World Bank, DBnomics (93 agencies via one adapter), SEC EDGAR, Epoch AI,
  Federal Register, LBMA (gold/silver), GDELT (broken — see below), 7 RSS feeds.
- **Lens layer:** 5 lenses, each with a thesis (plain + technical), a ticker
  strip (each price states *why* it's on that specific lens — copper means
  something different on Money vs Infrastructure), and lens-filtered news via a
  stored search query per lens (deterministic, not model-classified).
- **Question layer:** 11 questions nested under lenses, each with hero/supporting/
  context charts, a stored answer in both registers, and a caveat as a first-class
  section — not a footnote.
- **Front end — rebuilt as an editorial site, not a dashboard.** Eight routes:
  overview (`/`), lens, question, **the data browser (`/data`) and per-series
  detail (`/data/:id`)**, chart-builder, news, pipeline/status. Context drawer:
  click a point on any chart → news and events from that period.
  - **Lens and question pages read as articles** — heading, thesis as prose,
    then the claim being tested, how it is measured, the evidence, and what
    others have published. Caveat sits directly under the answer, above every
    chart.
  - **`/data` makes every series reachable without going through an argument**,
    and the detail page is the only place licence and attribution have ever
    been shown, despite being recorded for every source since 0002.
  - **No country filter anywhere, deliberately.** The catalogue has one country
    with real depth (USA, 61 indicators); 39 of 49 have the same six World Bank
    series. A country control would promise a comparison the data cannot
    support. *(This changes when more data lands.)*
  - **11 questions across 5 lenses** (was 7). `jobs` had 24 indicators and
    `policy` 4; the split is in `016_question_split.sql`.
  - Identity: warm neutrals, vermilion accent used only for interactive state,
    Instrument Serif headings. The chrome stays quiet because nine colours
    already carry meaning (six chart hues + the direction trio) and every
    vivid brand hue collided with one of them.
- **Mobile:** rail becomes a bottom tab bar below the `lg` breakpoint (1024px),
  with a "More" sheet rendering the same nav data. 44px touch targets.
  `manifest.json` + PWA icons so "Add to Home Screen" works.
- **Security:** audited 2026-08-28, before the first public push. See the
  dedicated section below.
- **Chart palette re-validated** against BoardUI's surfaces with the dataviz
  validator. Dark mode needed its own steps because BoardUI's dark card is
  lighter than the old one — see the note in `src/client/styles/charts.css`,
  which records the numbers and the command to re-run.
- **62 tests passing.** Mostly backend; `src/client/lib/format.test.js` is the
  only front-end suite, covering the number and unit formatting. There are no
  component or route tests.
- **Three build gates**, all green: `npm test`, `npm run check:tokens` (every
  Tailwind utility and runtime `var()` resolves to a real token — the guard
  built after seven nonexistent classes silently generated no CSS for weeks),
  and `npm run check:contrast` (WCAG AA on both themes).
- **A README** that leads with the project's rules rather than its stack, and
  states the data weaknesses in the open. Five screenshots in
  `docs/screenshots/`.

## What's NOT built yet

In rough priority order:

1. **Country coverage — the known gap, and the thing to work on next.**
   The catalogue reports 50 countries, and that number flatters it badly. The
   USA has 61 indicators; Japan is next at 15; **39 of 49 carry the same six
   World Bank annual series** (~26 points each, 2000–2025). So the gap is not
   missing countries, it is missing *depth* — the fix is more series for the
   handful of countries that already have some breadth (UK, Japan, Australia,
   France, Canada, Germany, Korea, China), not more flags.
   The DBnomics adapter already reaches 93 statistical agencies through one
   code path and is the obvious route. **No country filter or comparison UI
   exists, deliberately**, and none should be built before the data supports
   the comparison it would imply.
2. **The twelve reports are cited but not read.** `014_reading.sql` seeds BIS,
   IMF ×2, OECD, WEF, Stanford HAI, McKinsey, PwC, Deloitte, KPMG, EY and
   Accenture as citations. **Every `takeaway` is NULL and every `stance` is
   `background`** — that value is a placeholder meaning "not yet read", not a
   judgement about what the report argues. Filling either in requires reading
   the PDFs (on the Desktop, deliberately never committed: link and cite,
   never redistribute), and is a job to do *with* Joshua rather than infer
   from a title.
   The rest of the layer is done: `question_reading` renders on both question
   and lens pages, and `theory`, `method`, `strength` and `last_reviewed` are
   populated on all 11 questions. **That prose is Claude-drafted and Joshua has
   not reviewed the economics yet** — `productivity` most of all.
   Still to come: the OpenAlex academic corpus. `stale_questions` lists pages
   whose prose has not been reviewed in six months.
3. **Event extraction** — the `events` table is empty. This is what would power
   the circular-financing diagram (Nvidia → OpenAI → Oracle → Nvidia) the user
   asked for. `entities` already holds 35 real rows and the
   `investment_edges` / `monthly_investment` views are built on top, so the
   feature needs rows, not schema.
4. **News images and source logos** — asked for, not done.
5. **Deploy.** Decided: **Vercel + Neon**. The local `.env` points at the live
   Render Postgres, so data is already migrated and seeded — but the app is
   written as a long-lived Express process (`app.listen`, a `pg.Pool`), which
   is the wrong shape for serverless. Needs `@neondatabase/serverless`, a
   handler export, `fra1` region pinning, and every endpoint under the 10s
   function timeout. The `/api/overview` query was 5.9s cold before it was
   restructured around a CTE; it is 0.87s cold now, which is the only reason
   that budget is reachable.
6. **A LICENSE file** — see the GitHub section above.

## Security

Audited 2026-08-28, before the first push of this branch. **The GitHub repo is
public**, so anything committed is published immediately.

Verified clean:

- **Secrets have never entered git history.** `.env` is gitignored and was
  never committed; all 30k added lines across the 34 unpushed commits were
  scanned against the pre-commit hook's own patterns with zero hits;
  `.env.example` holds only empty fields and a localhost placeholder. The hook
  is active (`core.hooksPath = .githooks`) and is shape-based rather than a
  list of provider names, which had already gone stale twice.
- **SQL injection surface is zero.** Every query is parameterised, including
  the optional filters, which use `$1::text IS NULL OR …` rather than
  assembling SQL strings. No `ORDER BY` is caller-controlled.
- **XSS surface is minimal.** No `dangerouslySetInnerHTML` or `innerHTML`
  anywhere in the client, so React escapes all rendered content — which matters
  because news headlines come from third-party RSS. Both external links carry
  `rel="noopener noreferrer"`.
- **Every endpoint has a bounded cost** (observations capped at 20k rows,
  `/api/series` at 12 series, documents at 200), and the pool sets
  `statement_timeout` at 30s, so no request can run away.
- **Zero vulnerabilities** in production dependencies (`npm audit --omit=dev`).
- Error messages are hidden in production, `x-powered-by` is disabled.

Fixed in this pass:

- **`ingestion_runs.error_message` is served publicly by `/api/status` and was
  stored unredacted.** `HttpError` redacts its own message, but only some
  failures are `HttpError`s — a native fetch `TypeError`, a pg error, or
  anything a future adapter throws arrived unfiltered, and a request URL
  carrying `api_key=` in one of those would have been rendered on a public
  page. Redaction now happens in `finishRun`, at the point of storage, so the
  guarantee holds for every error type rather than depending on every throw
  site getting it right.
- **Response security headers added** (`src/server/lib/security.js`): CSP,
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`, and HSTS in production only. The CSP hashes the one
  inline script (the pre-paint theme block) **computed at boot from the served
  `index.html`**, rather than a hash pasted into source that would drift
  silently the moment anyone edited that script. `style-src` deliberately keeps
  `'unsafe-inline'` because Recharts renders through React's `style` prop.
- **CORS is now a deliberate decision, not a default.** It stays open because
  the API is read-only public data with no auth, no cookies and no session —
  a cross-origin caller can do nothing `curl` cannot, and open access is a
  stated goal. `credentials` is explicitly off. **If authentication is ever
  added this must become an allowlist**, since open CORS plus cookie auth is
  how a read API becomes a CSRF hole.

Known gap, deliberately deferred:

- **No rate limiting.** In-process limiting is close to useless on serverless,
  where each instance keeps its own counters, so this belongs at the edge —
  Vercel's firewall or a KV-backed limiter — and is Phase 6 deploy work rather
  than application code. Bounded query cost and `statement_timeout` are what
  currently limit the damage.

## Known broken things

- **GDELT news-volume series (`derived.ai_news_volume`) — connection timeouts.**
  The adapter code looks correct; this session self-rate-limited testing it and
  hasn't gotten back in. Worth just trying again fresh, possibly from a
  different network/time.
- **`derived.policy_investment_stance` and `derived.policy_regulation_stance`**
  — indicators exist, no computation defined yet.

## Recent finding worth knowing about

The RSS news pipeline had **never actually run on a schedule** — it existed,
had tests, but nothing in the ingestion runner called it. `npm run ingest -- rss`
matched no indicator (news isn't an "indicator"), printed nothing, and exited 0
— reporting success while doing nothing. Fixed in commit `c8ca282`. First real
run pulled in 73 new articles. If the news feed still looks thin, run:

```
npm run ingest -- rss --force
```

## How to pick this up

```
cd ~/Projects/EconIntel
npm run dev                  # Express :3000 + Vite :5173 — open 5173
npm run build && npm start   # production build, served on :3000
npm test                     # 62 tests, should all pass
npm run check:tokens         # every Tailwind class and var() resolves
npm run check:contrast       # WCAG AA on both themes
npm run ingest -- rss --force   # refresh news (do this periodically — nothing auto-schedules it yet)
```

Then just talk to Claude about what you want next — the lens layer, the
literature layer, deploy, whatever. This file plus `git log` plus the code
itself is the full picture; there's no other hidden state anywhere.
