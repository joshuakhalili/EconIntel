/**
 * Tests for the HTTP layer's non-network behaviour.
 *
 * Credential redaction is tested first and most thoroughly because it is a
 * security property, not merely a correctness one: ingestion errors are
 * persisted to `ingestion_runs.error_message` and printed to stdout, both of
 * which routinely end up in bug reports and CI logs.
 *
 * Run with: npm test
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { redactUrl, HttpError, __testing } from './http.js';

describe('redactUrl', () => {
  test('redacts api_key while preserving other parameters', () => {
    const result = redactUrl(
      'https://api.stlouisfed.org/fred/series?series_id=OPHNFB&api_key=secret123&file_type=json'
    );
    assert.ok(!result.includes('secret123'), 'key must not survive redaction');
    assert.ok(result.includes('series_id=OPHNFB'), 'diagnostic params must survive');
    assert.ok(result.includes('file_type=json'));
  });

  test('redacts every known credential parameter name', () => {
    for (const param of ['api_key', 'apikey', 'token', 'access_token', 'key']) {
      const result = redactUrl(`https://example.com/data?${param}=secret123`);
      assert.ok(
        !result.includes('secret123'),
        `parameter "${param}" was not redacted`
      );
    }
  });

  test('is case-insensitive on parameter names', () => {
    const result = redactUrl('https://example.com/data?API_KEY=secret123');
    assert.ok(!result.includes('secret123'));
  });

  test('leaves URLs without credentials untouched', () => {
    const url = 'https://api.worldbank.org/v2/country/DEU?format=json';
    assert.equal(redactUrl(url), url);
  });

  test('returns unparseable input unchanged rather than throwing', () => {
    // Redaction runs on an error path; throwing there would mask the original
    // failure with a less useful one.
    assert.equal(redactUrl('not a url'), 'not a url');
  });
});

describe('HttpError', () => {
  test('redacts credentials embedded in the message', () => {
    const error = new HttpError(
      'Request failed: https://api.stlouisfed.org/x?api_key=secret123',
      { url: 'https://api.stlouisfed.org/x?api_key=secret123' }
    );
    assert.ok(!error.message.includes('secret123'));
    assert.ok(!error.url.includes('secret123'));
  });

  test('preserves status and body for diagnosis', () => {
    const error = new HttpError('boom', {
      url: 'https://example.com',
      status: 503,
      body: 'upstream unavailable',
    });
    assert.equal(error.status, 503);
    assert.equal(error.body, 'upstream unavailable');
    assert.equal(error.name, 'HttpError');
  });
});

describe('RateLimiter', () => {
  test('permits a burst up to capacity without delay', async () => {
    const limiter = new __testing.RateLimiter(5, 1);
    const startedAt = Date.now();

    for (let i = 0; i < 5; i += 1) await limiter.take();

    assert.ok(
      Date.now() - startedAt < 50,
      'a burst within capacity should not be throttled'
    );
  });

  test('throttles once the bucket is empty', async () => {
    // Capacity 1, refilling 20/sec => the second take waits ~50ms.
    const limiter = new __testing.RateLimiter(1, 20);
    await limiter.take();

    const startedAt = Date.now();
    await limiter.take();
    const elapsed = Date.now() - startedAt;

    assert.ok(elapsed >= 30, `expected throttling, waited only ${elapsed}ms`);
  });
});

describe('backoff', () => {
  test('grows exponentially with attempt number', () => {
    const first = __testing.backoffMs(0);
    const third = __testing.backoffMs(2);
    assert.ok(third > first * 2, 'backoff should grow substantially');
  });

  test('includes jitter so parallel retries do not synchronise', () => {
    const samples = new Set(
      Array.from({ length: 20 }, () => __testing.backoffMs(1))
    );
    assert.ok(
      samples.size > 1,
      'identical backoff across calls would make retries thundering-herd'
    );
  });
});
