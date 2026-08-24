/**
 * HTTP client for data-source adapters.
 *
 * Every outbound request in this project goes through here, which buys us four
 * things that would otherwise be copy-pasted (and subtly wrong) in each adapter:
 *
 *   1. Per-host rate limiting  — we are guests on free APIs. Getting throttled
 *                                or banned would take the dashboard down.
 *   2. Retry with backoff      — transient 5xx and network blips are normal at
 *                                this scale and should not fail an ingestion run.
 *   3. Fixture mode            — replay recorded responses instead of hitting
 *                                the network, so tests are fast and offline
 *                                development works in restricted networks.
 *   4. Honest errors           — a typed error that says which host failed and
 *                                why, instead of a bare "fetch failed".
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { config } from '../config.js';

const FIXTURES_DIR = fileURLToPath(new URL('../../../fixtures/http', import.meta.url));

/** Thrown for any non-recoverable HTTP failure. Carries context for the log. */
export class HttpError extends Error {
  constructor(message, { url, status, body } = {}) {
    super(message);
    this.name = 'HttpError';
    this.url = url;
    this.status = status;
    this.body = body;
  }
}

/**
 * Token-bucket rate limiter, one bucket per host.
 *
 * Chosen over a fixed delay because real APIs publish a rate as
 * "N requests per minute", which permits a burst then a steady drip. A fixed
 * sleep between calls would be needlessly slow for small batches while still
 * being wrong for large ones.
 */
class RateLimiter {
  /** @param {number} capacity @param {number} refillPerSecond */
  constructor(capacity, refillPerSecond) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.refillPerSecond = refillPerSecond;
    this.lastRefill = Date.now();
  }

  async take() {
    for (;;) {
      const now = Date.now();
      const elapsedSeconds = (now - this.lastRefill) / 1000;
      this.tokens = Math.min(
        this.capacity,
        this.tokens + elapsedSeconds * this.refillPerSecond
      );
      this.lastRefill = now;

      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }

      const waitMs = ((1 - this.tokens) / this.refillPerSecond) * 1000;
      await sleep(Math.ceil(waitMs));
    }
  }
}

/**
 * Published rate limits, per host. Deliberately set BELOW each provider's
 * stated maximum — being a well-behaved client of a free public service costs
 * us a few seconds and protects the project from being blocked.
 */
const LIMITERS = {
  // FRED documents 120 req/min with a key. We take 60.
  'api.stlouisfed.org': new RateLimiter(10, 1),
  // SEC asks for no more than 10 req/sec. We take 5.
  'efts.sec.gov': new RateLimiter(5, 5),
  'data.sec.gov': new RateLimiter(5, 5),
  // World Bank and DBnomics publish no hard limit; stay modest anyway.
  'api.worldbank.org': new RateLimiter(10, 4),
  'api.db.nomics.world': new RateLimiter(10, 4),
};

const DEFAULT_LIMITER = new RateLimiter(5, 2);

function limiterFor(url) {
  return LIMITERS[new URL(url).hostname] ?? DEFAULT_LIMITER;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Stable filename for a URL's recorded response. */
function fixturePath(url) {
  const { hostname, pathname } = new URL(url);
  // Hash the full URL (including query) so different queries to the same path
  // get different fixtures, but keep the host and path in the name so a human
  // can tell what a fixture is without opening it.
  const digest = createHash('sha256').update(url).digest('hex').slice(0, 12);
  const slug = `${hostname}${pathname}`.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 80);
  return path.join(FIXTURES_DIR, `${slug}__${digest}.json`);
}

/**
 * Statuses worth retrying. 4xx (except 429) means we sent something wrong —
 * retrying an identical bad request just wastes the provider's quota.
 */
function isRetryable(status) {
  return status === 429 || status === 408 || (status >= 500 && status < 600);
}

/**
 * Fetch JSON with rate limiting, retries and optional fixture replay.
 *
 * @param {string} url
 * @param {object}  [options]
 * @param {Record<string,string>} [options.headers]
 * @param {number}  [options.timeoutMs=20000]
 * @param {number}  [options.retries=3]
 * @param {boolean} [options.record]  write the response to a fixture file
 * @returns {Promise<unknown>}
 */
export async function fetchJson(url, options = {}) {
  const {
    headers = {},
    timeoutMs = 20_000,
    retries = 3,
    record = false,
  } = options;

  if (config.useFixtures) {
    return readFixture(url);
  }

  await limiterFor(url).take();

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    // A fresh AbortController per attempt — reusing an aborted one would make
    // every retry fail instantly.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');

        if (isRetryable(response.status) && attempt < retries) {
          // Honour Retry-After when the server sends it; the server knows
          // better than our backoff curve does.
          const retryAfter = Number(response.headers.get('retry-after'));
          const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : backoffMs(attempt);

          lastError = new HttpError(
            `HTTP ${response.status} from ${new URL(url).hostname}`,
            { url, status: response.status, body: body.slice(0, 500) }
          );
          await sleep(delayMs);
          continue;
        }

        throw new HttpError(
          `HTTP ${response.status} from ${new URL(url).hostname}: ${body.slice(0, 200)}`,
          { url, status: response.status, body: body.slice(0, 500) }
        );
      }

      const data = await response.json();
      if (record) await writeFixture(url, data);
      return data;
    } catch (error) {
      if (error instanceof HttpError) throw error;

      // Network-level failure (DNS, TLS, timeout, blocked egress).
      lastError = new HttpError(
        `Request to ${new URL(url).hostname} failed: ${error.message}`,
        { url }
      );
      if (attempt < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

/**
 * Exponential backoff with jitter. The jitter matters: without it, several
 * parallel jobs that fail together retry in lockstep and hammer a recovering
 * server at exactly the same moment.
 */
function backoffMs(attempt) {
  const base = 500 * 2 ** attempt;
  return base + Math.random() * base * 0.3;
}

async function readFixture(url) {
  const file = fixturePath(url);
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new HttpError(
        `No fixture recorded for ${url}\n` +
          `  expected: ${file}\n` +
          `  Record it with USE_FIXTURES=false and record:true, ` +
          `or run with network access.`,
        { url }
      );
    }
    throw error;
  }
}

async function writeFixture(url, data) {
  await mkdir(FIXTURES_DIR, { recursive: true });
  await writeFile(fixturePath(url), JSON.stringify(data, null, 2), 'utf8');
}

/** Exposed so adapters can build fixture files in tests without a network. */
export const __testing = { fixturePath, backoffMs, RateLimiter };
