/**
 * Job selection.
 *
 * These exist because `npm run ingest -- rss` matched nothing, printed
 * nothing, and exited 0 for as long as the RSS adapter had existed — so the
 * news feeds were never fetched on a schedule at all while every run reported
 * success. A filter that silently matches nothing is the worst possible
 * failure mode for a scheduler, and it is exactly the kind that a test catches
 * and a manual run does not.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { matchDocumentJobs } from './runner.js';
import { FEEDS } from './sources/rss.js';

// FEEDS is not all RSS: it also carries `gov:federal_reserve`, which is why
// the prefix test below counts the rss ones rather than the whole list. The
// first draft of this test asserted FEEDS.length and failed — correctly.
const RSS_FEEDS = FEEDS.filter((f) => f.sourceId.startsWith('rss:'));

test('no filter selects every document job', () => {
  assert.equal(matchDocumentJobs(null).length, FEEDS.length);
  assert.equal(matchDocumentJobs(undefined).length, FEEDS.length);
});

test('a bare prefix selects the whole family and nothing else', () => {
  // What anyone actually types. Previously matched nothing at all, because the
  // registered names are 'rss:ft', 'rss:bloomberg' and so on.
  const matched = matchDocumentJobs('rss');
  assert.equal(matched.length, RSS_FEEDS.length);
  assert.ok(matched.every((n) => n.startsWith('rss:')));
  assert.ok(!matched.includes('gov:federal_reserve'));
});

test('a different prefix family is selectable too', () => {
  assert.deepEqual(matchDocumentJobs('gov'), ['gov:federal_reserve']);
});

test('a full name selects exactly one feed', () => {
  assert.deepEqual(matchDocumentJobs('rss:guardian'), ['rss:guardian']);
});

test('an unknown filter selects nothing rather than everything', () => {
  // Must not fall back to "run them all" — a typo would then quietly trigger a
  // full fetch against seven third-party feeds.
  assert.deepEqual(matchDocumentJobs('rrs'), []);
  assert.deepEqual(matchDocumentJobs('fred'), []);
});

test('a prefix does not match a name that merely starts with the same letters', () => {
  // 'rss' must match 'rss:ft' via the colon, not by raw string prefix — or
  // 'r' would match everything.
  assert.deepEqual(matchDocumentJobs('r'), []);
});
