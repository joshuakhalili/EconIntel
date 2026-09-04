/**
 * `safeNextPath` decides where a reader is sent after signing in, from a value
 * anyone can put in a URL. Two things have to hold and only one of them is
 * obvious:
 *
 *   1. A shared link survives the sign-in. `/q/entry-level` in, `/q/entry-level`
 *      out — this is the whole point of the parameter existing.
 *   2. The page cannot be turned into a redirector to somewhere else. The
 *      hostile shapes below are not hypothetical; `//host`, `/\host` and a
 *      path with a newline in it are the three standard ways an open redirect
 *      gets through a `startsWith('/')` check.
 *
 * The escapes are written out rather than pasted so the bytes under test are
 * unambiguous: '\\' is one backslash, '\n' is one line feed.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { safeNextPath, qs } from './api.js';

describe('safeNextPath — the shared link survives', () => {
  test('returns a same-site path unchanged', () => {
    assert.equal(safeNextPath('/q/entry-level'), '/q/entry-level');
    assert.equal(safeNextPath('/lens/labour'), '/lens/labour');
    assert.equal(safeNextPath('/data/fred.CGBD2534'), '/data/fred.CGBD2534');
  });

  test('keeps the query string, which carries the reader’s selections', () => {
    assert.equal(
      safeNextPath('/simulate/ai-capex-dotcom?country=GBR&capex=100'),
      '/simulate/ai-capex-dotcom?country=GBR&capex=100'
    );
  });

  test('falls back to the overview when there is nothing to return to', () => {
    assert.equal(safeNextPath(null), '/overview');
    assert.equal(safeNextPath(undefined), '/overview');
    assert.equal(safeNextPath(''), '/overview');
    assert.equal(safeNextPath(42), '/overview');
    assert.equal(safeNextPath({}), '/overview');
  });

  test('refuses to send a reader back to the page they just completed', () => {
    assert.equal(safeNextPath('/login'), '/overview');
    assert.equal(safeNextPath('/login?next=/login'), '/overview');
  });

  test('the fallback is caller-supplied, so this is reusable', () => {
    assert.equal(safeNextPath('//evil.example', '/'), '/');
  });
});

describe('safeNextPath — the page is not a redirector', () => {
  test('rejects an absolute URL', () => {
    assert.equal(safeNextPath('https://evil.example/phish'), '/overview');
    assert.equal(safeNextPath('http://evil.example'), '/overview');
    assert.equal(safeNextPath('javascript:alert(1)'), '/overview');
  });

  test('rejects a protocol-relative URL, which a browser reads as a host', () => {
    assert.equal(safeNextPath('//evil.example'), '/overview');
    assert.equal(safeNextPath('//evil.example/q/entry-level'), '/overview');
  });

  test('rejects a backslash, which is read as a slash in this position', () => {
    // '/\evil.example' — one backslash.
    assert.equal(safeNextPath('/\\evil.example'), '/overview');
    assert.equal(safeNextPath('\\\\evil.example'), '/overview');
  });

  test('rejects a URL that only becomes protocol-relative once stripped', () => {
    // The browser removes tab, LF and CR from a URL wherever they appear, so
    // each of these is assigned as "//evil.example".
    assert.equal(safeNextPath('/\n/evil.example'), '/overview');
    assert.equal(safeNextPath('/\r/evil.example'), '/overview');
    assert.equal(safeNextPath('/\t/evil.example'), '/overview');
    assert.equal(safeNextPath('/\n\\evil.example'), '/overview');
  });

  test('rejects leading whitespace, which a browser also trims before parsing', () => {
    assert.equal(safeNextPath(' //evil.example'), '/overview');
    assert.equal(safeNextPath('\n//evil.example'), '/overview');
  });

  test('an encoded slash is a path segment, not a host — and stays', () => {
    // %2F is not decoded before the browser decides on the origin, so this
    // never leaves the site and there is nothing to reject.
    assert.equal(safeNextPath('/%2F%2Fevil.example'), '/%2F%2Fevil.example');
  });
});

describe('qs', () => {
  test('drops empties so an absent filter does not appear as "?x="', () => {
    assert.equal(qs({ country: 'USA', industry: null, from: '', tags: [] }), '?country=USA');
    assert.equal(qs({}), '');
  });

  test('joins an array with commas, as the API reads it', () => {
    assert.equal(qs({ ids: ['a', 'b'] }), '?ids=a%2Cb');
  });
});
