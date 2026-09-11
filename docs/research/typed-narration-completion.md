# Typed-fact narration completion

The production narrator no longer requests or accepts free-form model sentences. `narration-facts.js` hashes each complete fact tuple (indicator, geography, unit, latest/prior values and dates, provider statuses, source reference and scenario basis). Selection accepts only one or two existing IDs. Fixed templates render values and comparisons; provider breaks and ambiguous/mismatched geography withhold comparisons. Projected values and hypothetical scenarios remain explicitly qualified.

The write path stores the deterministic body, full facts and selection under a new renderer version. Both lens and simulation repositories reconstruct the body against current grounding before exposing cached text. Old renderer versions, stale IDs and tampered text fail closed. Generation needs no Cloudflare/model credentials. Lens geography comes from the observation or declared source default, never from an assumption that country-less observations must be global.

Readers can inspect the full fact tuples, selected IDs, source references and qualifications. The overview no longer falsely claims every research sentence was human-written. This is a safeguard against semantic swaps, not certification of source accuracy, causal interpretation or the simulation model.

Tests cover country/unit/date/value/status/source swaps, invented prose with valid numbers, null versus zero, absent dates, breaks, forecast/scenario labels, invalid selections, storage without model/network calls, poisoned caches, and explicit reselection. The integration suite on September 11 currently passes 777 tests with one optional fixture skip (778 total); agents are still integrating additional work, so a final full-suite/build run is required before release.

Historical numeric-token validators are retained for their regression corpus only; they do not govern the new storage or reader path.
