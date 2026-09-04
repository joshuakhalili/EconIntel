/**
 * The `qs` override, and the query-string behaviour it must not change.
 *
 * WHY THIS FILE EXISTS
 *
 * Two moderate advisories sit against `qs` — an array-limit bypass via
 * bracket-key comma parsing (GHSA-x5fp-wj9c-mxmx) and a denial of service via
 * an attacker-controlled `isBuffer` (GHSA-4mjr-xmp4-gh2g). Both are patched in
 * qs 6.16.0. The second is reachable from the query string of any public
 * endpoint, so it is not theoretical here.
 *
 * NO EXPRESS 4 RELEASE CAN REACH THE FIX. express@4.22.2 is the newest 4.x and
 * it pins `qs: ~6.15.1`, which can never resolve to 6.16.0. `npm audit`'s
 * "fix available" is pointing at express 5, not at a 4.x patch. So the fix is a
 * top-level `overrides` entry in package.json, and the thing that can silently
 * undo it is somebody deleting that entry — at which point npm quietly installs
 * 6.15.x again and the advisories come back with no error anywhere.
 *
 * That is what the first test guards. The rest guard the other direction: an
 * override forces a version express never declared support for, so the query
 * shapes this app actually relies on are pinned here as behaviour. Every
 * expectation below was produced by running both 6.15.3 and 6.16.0 against the
 * same inputs; the two agree on all of them, which is why the upgrade is safe.
 *
 * THE COMMA CASE IS THE ONE THAT WOULD BITE. app.js splits `?ids=` and
 * `?countries=` on commas itself, which is only correct while qs hands the
 * comma back inside the string rather than splitting it into an array. That is
 * asserted explicitly.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import express from 'express';

const require = createRequire(import.meta.url);

/*
 * Set before importing the app, for the same reason app.http.test.js does:
 * config.js reads the environment at module load. Nothing here touches the
 * database — the app is imported only to read the query parser it configured.
 */
process.env.SESSION_SECRET ??= 'a'.repeat(64);
process.env.DATABASE_URL ??= 'postgres://unused:unused@127.0.0.1:5432/unused';

const { app } = await import('./app.js');

/** The parser the shipped app will actually run against every request. */
const parse = app.get('query parser fn');

describe('the qs override is installed', () => {
  test('the qs express itself loads is at least 6.16.0, where both advisories are patched', () => {
    /*
     * Resolved from express's own module path rather than from the repo root,
     * because the question is not "is a patched qs installed somewhere" but
     * "which qs does express hand every query string to". Without the override
     * that resolution lands on 6.15.x, which no 4.x release can escape.
     */
    const fromExpress = createRequire(require.resolve('express'));
    let version;
    try {
      ({ version } = fromExpress('qs/package.json'));
    } catch (error) {
      assert.fail(
        `express could not resolve qs at all (${error.code}); the package.json "overrides" entry pinning ^6.16.0 has been lost or the install is stale`,
      );
    }
    const [major, minor] = version.split('.').map(Number);
    assert.ok(
      major > 6 || (major === 6 && minor >= 16),
      `express resolves qs ${version}; the package.json "overrides" entry pinning ^6.16.0 has been lost`,
    );
  });

  test('express is still 4.x — the override is what fixed this, not an upgrade', () => {
    const { version } = require('express/package.json');
    assert.equal(version.split('.')[0], '4');
  });
});

describe('the app still parses the query shapes it depends on', () => {
  test('nested brackets become a nested object', () => {
    assert.deepEqual(parse('a[b]=1&a[c]=2'), { a: { b: '1', c: '2' } });
  });

  test('deep nesting survives to the default depth', () => {
    assert.deepEqual(parse('a[b][c][d]=deep'), { a: { b: { c: { d: 'deep' } } } });
  });

  test('empty brackets collect an array', () => {
    assert.deepEqual(parse('tags[]=x&tags[]=y'), { tags: ['x', 'y'] });
  });

  test('a repeated key collects an array', () => {
    assert.deepEqual(parse('tags=x&tags=y'), { tags: ['x', 'y'] });
  });

  test('indexed brackets collect an array, gaps compacted', () => {
    assert.deepEqual(parse('a[0]=x&a[2]=y'), { a: ['x', 'y'] });
  });

  test('a comma stays inside the value — app.js splits it, qs must not', () => {
    assert.deepEqual(parse('countries=USA,GBR,DEU'), { countries: 'USA,GBR,DEU' });
    assert.deepEqual(parse('ids=1,2,3'), { ids: '1,2,3' });
  });

  test('scalars arrive as strings, which is what the Number() coercions assume', () => {
    assert.deepEqual(parse('limit=24&minRelevance=40'), { limit: '24', minRelevance: '40' });
  });
});

describe('over real HTTP, through express itself', () => {
  let base;
  let server;
  let echo;

  before(async () => {
    /*
     * A bare express app rather than the real one, because every route on the
     * real app is behind the auth gate and needs a database, and none of them
     * echo their query back. The link to the real app is asserted below: both
     * resolve to the same parser function, so what this proves about req.query
     * is true of the shipped app's req.query.
     */
    echo = express();
    echo.get('/echo', (req, res) => res.json(req.query));
    server = createServer(echo);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('the harness runs the same parser the real app runs', () => {
    assert.equal(echo.get('query parser fn'), app.get('query parser fn'));
  });

  test('req.query carries nested and array params through a real request', async () => {
    const response = await fetch(`${base}/echo?filter[country]=USA&tags[]=ai&tags[]=jobs&ids=1,2,3`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      filter: { country: 'USA' },
      tags: ['ai', 'jobs'],
      ids: '1,2,3',
    });
  });

  test('a request with no query string yields an empty object, not undefined', async () => {
    const response = await fetch(`${base}/echo`);
    assert.deepEqual(await response.json(), {});
  });
});
