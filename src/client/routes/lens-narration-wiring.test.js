/**
 * The staleness warning is only alive if it is wired.
 *
 * NarrationBlock computes whether the stored machine-written paragraph has
 * fallen behind the live tickers printed directly above it, and tells the
 * reader when it has. That check needs the `tickers` prop. Without it,
 * `narrationStaleness(series, undefined)` returns tickerPeriod null and
 * hardcodes `stale` to false, so the warning can never fire — silently, and
 * with the component's own 15-line docblock still explaining why it matters.
 *
 * That is exactly what shipped. The mechanism was built in NarrationBlock.jsx
 * and mounted in LensPage.jsx, and the seam between the two files swallowed it:
 * every lens reported "not stale", including the two that were. Measured at the
 * time — regulation's narration was 1 Aug against tickers of 1 Sep, and prices
 * was 28 Aug against 2 Sep. /lens/regulation is the page the docblock was
 * written about.
 *
 * This is a source-level assertion rather than a render test because the
 * failure is a missing PROP, which no amount of exercising the component can
 * catch — the component was always correct. Only the call site was wrong.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lensPage = readFileSync(new URL('./LensPage.jsx', import.meta.url), 'utf8');
const block = readFileSync(
  new URL('../components/NarrationBlock.jsx', import.meta.url),
  'utf8'
);

describe('the lens narration staleness warning is wired, not just built', () => {
  test('NarrationBlock still takes the prop the check depends on', () => {
    assert.match(
      block,
      /export default function NarrationBlock\(\{[^}]*\btickers\b[^}]*\}\)/,
      'NarrationBlock no longer accepts `tickers` — if the prop was renamed, the ' +
        'call site below needs renaming with it'
    );
    assert.match(
      block,
      /narrationStaleness\(\s*series\s*,\s*tickers\s*\)/,
      'NarrationBlock no longer passes tickers into narrationStaleness'
    );
  });

  test('LensPage passes tickers, so the warning can actually fire', () => {
    const mount = lensPage.match(/<NarrationBlock[^/>]*\/>/s);
    assert.ok(mount, 'LensPage no longer mounts NarrationBlock');
    assert.match(
      mount[0],
      /\btickers=/,
      'LensPage mounts NarrationBlock WITHOUT `tickers`, so narrationStaleness ' +
        'gets tickerPeriod null and hardcodes stale=false. The staleness warning ' +
        'is dead and every lens will silently report that its narration is current.'
    );
  });
});
