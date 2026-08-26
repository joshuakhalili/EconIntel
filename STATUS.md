# EconIntel — where things stand

Read this first in a new session. Say "read STATUS.md and catch me up" and Claude
will pick up from here without you re-explaining anything.

Last updated: 2026-08-26.

## What this project is

A public dashboard measuring AI's economic effect worldwide. Not a database
browser — organised as **lenses** (ways of looking at the subject: Money, Work,
Infrastructure, Policy, Adoption), each containing questions, contextual price
tickers, and news. Two reading modes (Plain / Technical) show different registers
of the same stored answer, not the same text with jargon added.

**The rule that governs everything:** an LLM is never asked to invent a number or
a citation. It's handed SQL-computed values and stored claims and asked only to
connect them in a sentence. See `narrations.input_hash` in the schema.

## ⚠️ Not pushed to GitHub

25 local commits, none pushed. Run `git push` when ready — nothing here exists
anywhere but this laptop until then.

## Stack

Node 24 ESM, Express 4, Postgres 18.4 on Render (Frankfurt). Hand-built SVG
charts, no chart library, no front-end framework. Cloudflare Workers AI for the
LLM layer (free tier, 10k neurons/day) — key is in `.env`, never committed.

## What's built and working

- **Data:** 76,788 observations across 115 indicators, 50 countries. Sources:
  FRED, World Bank, DBnomics (93 agencies via one adapter), SEC EDGAR, Epoch AI,
  Federal Register, LBMA (gold/silver), GDELT (broken — see below), 7 RSS feeds.
- **Lens layer:** 5 lenses, each with a thesis (plain + technical), a ticker
  strip (each price states *why* it's on that specific lens — copper means
  something different on Money vs Infrastructure), and lens-filtered news via a
  stored search query per lens (deterministic, not model-classified).
- **Question layer:** 7 questions nested under lenses, each with hero/supporting/
  context charts, a stored answer in both registers, and a caveat as a first-class
  section — not a footnote.
- **Front end:** lens pages, question pages, a chart-builder ("Build a chart"),
  a news feed, a pipeline/status page. Context drawer: click a point on any chart
  → see news and events from that period.
- **Mobile:** just finished. Chart axis text was rendering at 8.8px on real
  screens — fixed, now renders at a true 14px at every width. Bottom tab bar
  below 700px. 44px touch targets. `manifest.json` + PWA icons so "Add to Home
  Screen" works.
- **Security:** `.env` gitignored, pre-commit hook blocks anything shaped like a
  key/token/secret (case-insensitive, shape-based — not a list of known provider
  names, which had already gone stale twice).
- **44 tests passing.**

## What's NOT built yet

In rough priority order:

1. **Literature layer** — academic papers via OpenAlex, findings extracted by
   the Cloudflare LLM, structured so a conflict between two papers is a SQL
   query. Schema not written yet (`0011_literature.sql` planned but doesn't
   exist — the `0011` migration that does exist is `lens_news_query`, unrelated).
2. **Event extraction** — the `events` table is empty. This is what would power
   the circular-financing diagram (Nvidia → OpenAI → Oracle → Nvidia) the user
   asked for. Needs the LLM extracting from SEC 8-Ks and news.
3. **News images and source logos** — asked for, not done.
4. **`render.yaml` + actual deploy.** The local `.env` already points at the
   live Render Postgres, so production data is already migrated and seeded —
   just the app itself isn't deployed yet.

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
npm start                    # runs on localhost:3000
npm test                     # 44 tests, should all pass
npm run ingest -- rss --force   # refresh news (do this periodically — nothing auto-schedules it yet)
```

Then just talk to Claude about what you want next — the lens layer, the
literature layer, deploy, whatever. This file plus `git log` plus the code
itself is the full picture; there's no other hidden state anywhere.
