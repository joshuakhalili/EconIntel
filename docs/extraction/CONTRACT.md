# Extraction contract — read this before you start

You are extracting CHARTABLE NUMBERS from a consulting or institutional report
PDF for Diffusion, a public dashboard about AI's economic effect.

## The one rule that matters

**No number may be invented, estimated, computed, converted or rounded by you.**
Every value you output must appear, as that value, on the page you cite. If a
number only exists as the height of a bar you would have to eyeball, SKIP IT.
Prefer tables, callout statistics and numbers stated in the running text.

A reader can and will open the PDF at the page you name and check. That is the
entire reason this extraction is allowed to exist. A figure that does not
survive that check is worse than no figure at all.

## How to read the PDF

Use the Read tool with the `pages` parameter — max 20 pages per call, e.g.
`pages: "1-20"`. Long reports: read the contents page first and go only to the
sections about AI and the economy. Do not read 300 pages front to back.

## What to look for

3 to 8 figures per report. A figure is a set of numbers that belongs on one
chart. Good candidates:

- share of firms / workers / countries doing something, broken down by
  industry, function, country or size
- a rate over time (adoption, investment, employment)
- a premium or gap between two groups
- counts of something discrete

Skip: single unattached statistics with nothing to compare them to (those are
takeaways, not charts), anything about the consultancy's own methodology, and
anything that is a projection ONLY if the report gives no basis for it — a
labelled forecast is fine as long as `note` says it is one.

## Output

Write ONE json file to the path given in your task, with this exact shape:

```json
{
  "report": {
    "publisher": "<exactly as given in your task>",
    "title": "<exactly as given in your task>",
    "url": "<exactly as given in your task>",
    "published": "YYYY-MM-DD or null",
    "pdf": "<the filename you read>"
  },
  "figures": [
    {
      "id": "kebab-case-unique-slug",
      "title": "What the chart shows, as a noun phrase",
      "subtitle": "Population, geography and period — who was counted, where, when",
      "page_ref": "p. 11",
      "quote": "The verbatim sentence, table caption or chart title from the PDF that carries these numbers. Copy it exactly.",
      "unit": "% of firms surveyed",
      "unit_symbol": "%",
      "decimals": 0,
      "axis_kind": "category",
      "note": "What this figure cannot show. Sample size, self-reporting, survey vs administrative data, whether it is a projection.",
      "points": [
        { "series": "", "label": "Financial services", "value": 43 },
        { "series": "", "label": "Manufacturing", "value": 21 }
      ]
    }
  ]
}
```

Field notes:

- `id` — start it with the publisher slug, e.g. `pwc-wage-premium-by-sector`.
- `axis_kind` — `"category"` for a breakdown by industry/country/function,
  `"year"` when the labels are years or periods.
- `series` — `""` unless the chart is grouped (e.g. 2024 vs 2026 bars side by
  side), in which case put the group name here and repeat labels across series.
- `points` — at least 2, at most 20. `label` verbatim from the report.
- `note` — REQUIRED and it must be real. "Self-reported by 1,491 respondents;
  a firm saying it uses AI is not the same as AI being used at scale" is a
  note. "Data from the report" is not.
- `subtitle` — REQUIRED. Say who was counted and over what period.

## Also return

At the end of your final message, list any figure you decided to SKIP and why,
in one line each. That list is as useful as the extraction.

Write the file, then reply with: the file path, the number of figures, and the
skip list. Do not paste the JSON into your reply.
