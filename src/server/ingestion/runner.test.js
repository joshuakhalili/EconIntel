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

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  matchDocumentJobs,
  detectRegressions,
  classifyOutcome,
  parseAllowFail,
  DERIVED_JOB_IDS,
} from './runner.js';
import { FEEDS } from './sources/rss.js';

// FEEDS is not all RSS: it also carries `gov:federal_reserve`, which is why
// the prefix test below counts the rss ones rather than the whole list. The
// first draft of this test asserted FEEDS.length and failed — correctly.
const RSS_FEEDS = FEEDS.filter((f) => f.sourceId.startsWith('rss:'));

// Document jobs that are not feeds. Named individually rather than counted,
// because the point of this file is that a job which stops being selectable
// fails loudly — and `FEEDS.length + n` would go on passing if one of these
// were dropped and another added.
const NON_FEED_JOBS = ['openalex'];

test('no filter selects every document job', () => {
  const expected = FEEDS.length + NON_FEED_JOBS.length;
  assert.equal(matchDocumentJobs(null).length, expected);
  assert.equal(matchDocumentJobs(undefined).length, expected);
});

test('the academic corpus is a document job, not a feed', () => {
  // OpenAlex produces documents but has no RSS feed and is not in FEEDS, so it
  // reaches DOCUMENT_JOBS by a different route. It was previously possible for
  // that route to exist and for `npm run ingest -- openalex` still to match
  // nothing, which is the failure this whole file is about.
  assert.deepEqual(matchDocumentJobs('openalex'), ['openalex']);
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


/**
 * Regression detection — the two questions a single run cannot answer.
 *
 * The nightly workflow tolerates a declared known-degraded source so that a
 * permanently red X stops being noise. That tolerance is only safe if something
 * still notices CHANGE: a job that worked yesterday and failed today is not the
 * standing condition the allow list was written for, and a job that succeeded
 * while returning nothing is the exact rot this runner exists to catch, one
 * level up. `details.fetched` has been stored per run since the runner was
 * written and nothing has ever read it.
 */
describe('detectRegressions', () => {
  test('a job that succeeded yesterday and failed today is a regression', () => {
    const found = detectRegressions(
      [{ id: 'fred.PAYEMS', status: 'failed' }],
      { 'fred.PAYEMS': { status: 'succeeded', fetched: 900 } }
    );
    assert.equal(found.length, 1);
    assert.equal(found[0].kind, 'newly_failing');
  });

  test('a job that failed yesterday and fails again today is not', () => {
    // GDELT. This is precisely what the allow list is for, and escalating it
    // would put the daily red X back.
    assert.deepEqual(
      detectRegressions(
        [{ id: 'derived.ai_news_volume', status: 'failed' }],
        { 'derived.ai_news_volume': { status: 'failed', fetched: null } }
      ),
      []
    );
  });

  test('a job with no history is never a regression', () => {
    // A first run has nothing to be worse than. Treating "new" as "broken"
    // would paint the nightly run red on the day any indicator is added.
    assert.deepEqual(detectRegressions([{ id: 'fred.NEW', status: 'failed' }], {}), []);
    assert.deepEqual(
      detectRegressions([{ id: 'fred.NEW', status: 'succeeded', fetched: 0 }], {}),
      []
    );
  });

  test('a job that succeeds while returning nothing is a regression', () => {
    // The dangerous one: green tick, fresh `last_ingested_at`, empty response.
    // Nothing else in this codebase would notice.
    const found = detectRegressions(
      [{ id: 'rss:ft', status: 'succeeded', fetched: 0 }],
      { 'rss:ft': { status: 'succeeded', fetched: 42 } }
    );
    assert.equal(found.length, 1);
    assert.equal(found[0].kind, 'returned_nothing');
    assert.match(found[0].message, /42/);
  });

  test('a source that returned nothing last time either is not a change', () => {
    // A known-empty feed is a staleness question, not a regression, and
    // reporting it every night would be a second alarm nobody reads.
    assert.deepEqual(
      detectRegressions(
        [{ id: 'rss:ft', status: 'succeeded', fetched: 0 }],
        { 'rss:ft': { status: 'succeeded', fetched: 0 } }
      ),
      []
    );
  });

  test('a smaller but non-empty response is not a regression', () => {
    // Feeds are lumpy. Only ZERO is unambiguous, and a threshold on the drop
    // would be a number this project chose rather than measured.
    assert.deepEqual(
      detectRegressions(
        [{ id: 'rss:ft', status: 'succeeded', fetched: 3 }],
        { 'rss:ft': { status: 'succeeded', fetched: 400 } }
      ),
      []
    );
  });

  test('a missing count on either side decides nothing', () => {
    // An older run stored no `fetched`, or a job never reported one. Absence of
    // evidence must not read as evidence of emptiness.
    assert.deepEqual(
      detectRegressions(
        [{ id: 'x', status: 'succeeded' }],
        { x: { status: 'succeeded', fetched: 5 } }
      ),
      []
    );
    assert.deepEqual(
      detectRegressions(
        [{ id: 'x', status: 'succeeded', fetched: 0 }],
        { x: { status: 'succeeded', fetched: null } }
      ),
      []
    );
  });

  test('a recovered job is not reported as anything', () => {
    assert.deepEqual(
      detectRegressions(
        [{ id: 'derived.ai_news_volume', status: 'succeeded', fetched: 3288 }],
        { 'derived.ai_news_volume': { status: 'failed', fetched: null } }
      ),
      []
    );
  });

  test('several jobs are judged independently', () => {
    const found = detectRegressions(
      [
        { id: 'a', status: 'failed' },
        { id: 'b', status: 'succeeded', fetched: 0 },
        { id: 'c', status: 'succeeded', fetched: 10 },
      ],
      {
        a: { status: 'succeeded', fetched: 1 },
        b: { status: 'succeeded', fetched: 1 },
        c: { status: 'succeeded', fetched: 1 },
      }
    );
    assert.deepEqual(found.map((r) => r.id), ['a', 'b']);
  });
});


/**
 * The exit code, which is the entire point of the failure policy.
 *
 * WHY THIS FILE HAD TO GROW THIS SECTION
 *
 * Two waves of work shipped "the failure policy" for the nightly Ingest
 * workflow — the summary rendering, then the allow-to-fail list — and the
 * workflow stayed red, because nothing anywhere demonstrated the exit code
 * either half produces. The only way to find out was to wait for 05:40 UTC and
 * read the failure email. That is not a test, and the thing it failed to catch
 * was not subtle: `npm run check:data` ran as its own step with no
 * `continue-on-error`, so it painted the job red whatever the ingestion
 * verdict said.
 *
 * `classifyOutcome` is the whole decision and takes everything as an argument,
 * so the two runs that matter can be stated directly:
 *
 *   GDELT ECONNRESETs on a GitHub runner and nothing else fails  → exit 0
 *   FRED fails                                                   → exit 1
 */
describe('classifyOutcome', () => {
  const GDELT = 'derived.ai_news_volume';

  test('a clean run passes', () => {
    const d = classifyOutcome({});
    assert.equal(d.code, 0);
    assert.equal(d.verdict, 'pass');
    assert.equal(d.reason, 'every job succeeded');
  });

  test('a declared-degraded source failing alone exits 0 and says so', () => {
    // B-20, stated as a test. This is the run that has been arriving red every
    // morning: GDELT's host refuses connections from GitHub's runners, one job
    // out of roughly 160 fails, and the whole workflow went red for a reason
    // that was neither new nor actionable.
    const d = classifyOutcome({ failures: [{ id: GDELT }], allowFail: GDELT });
    assert.equal(d.code, 0);
    assert.equal(d.verdict, 'pass');
    assert.deepEqual(d.allowed, [GDELT]);
    assert.deepEqual(d.blocking, []);
    // The warning has to be findable in the reason, or a pass with a broken
    // source is indistinguishable from a pass with nothing broken.
    assert.match(d.reason, /known-degraded/);
    assert.match(d.reason, new RegExp(GDELT.replace(/\./g, '\\.')));
  });

  test('FRED failing exits 1 even while GDELT is excused', () => {
    const d = classifyOutcome({
      failures: [{ id: GDELT }, { id: 'fred.PAYEMS' }],
      allowFail: GDELT,
    });
    assert.equal(d.code, 1);
    assert.equal(d.verdict, 'fail');
    assert.deepEqual(d.blocking, ['fred.PAYEMS']);
    assert.deepEqual(d.allowed, [GDELT]);
    // Names only the blocking job. A reason listing both would send whoever
    // reads the email to look at the source that is fine.
    assert.match(d.reason, /fred\.PAYEMS/);
    assert.doesNotMatch(d.reason, new RegExp(GDELT.replace(/\./g, '\\.')));
  });

  test('an empty allow list makes every failure fatal', () => {
    // What a laptop has. `npm run ingest` must not inherit the nightly job's
    // tolerance for a source that is broken only on GitHub's runners.
    const d = classifyOutcome({ failures: [{ id: GDELT }] });
    assert.equal(d.code, 1);
    assert.deepEqual(d.blocking, [GDELT]);
  });

  test('the allow list cannot excuse a regression', () => {
    // A source is tolerated on the understanding that it stays broken. The day
    // it works and breaks again, tolerating it is hiding a live failure — so
    // this branch is tested BEFORE the allow list, and this test is what says
    // the order is not an accident.
    const d = classifyOutcome({
      failures: [{ id: GDELT }],
      regressions: [{ id: GDELT, kind: 'newly_failing', message: 'x' }],
      allowFail: GDELT,
    });
    assert.equal(d.code, 1);
    assert.equal(d.verdict, 'fail');
    assert.match(d.reason, /worse than their own last run/);
  });

  test('a job that succeeded while returning nothing fails the run', () => {
    // M-36's runner half, end to end: `detectRegressions` finds it, and this is
    // what happens to the exit code once it has. Nothing failed — the job
    // reported success — and the run is still red.
    const regressions = detectRegressions(
      [{ id: 'rss:ft', status: 'succeeded', fetched: 0 }],
      { 'rss:ft': { status: 'succeeded', fetched: 42 } }
    );
    assert.equal(regressions.length, 1);
    const d = classifyOutcome({ failures: [], regressions, allowFail: GDELT });
    assert.equal(d.code, 1);
    assert.match(d.reason, /rss:ft/);
  });

  test('an abort outranks everything, including an otherwise-excused failure', () => {
    // The run threw before it could finish, so the absence of further failures
    // says nothing. Treating this as "no blocking FAIL lines, therefore pass"
    // would make a wrong DATABASE_URL the greenest run of the week.
    const d = classifyOutcome({
      aborted: true,
      failures: [{ id: GDELT }],
      allowFail: GDELT,
    });
    assert.equal(d.code, 1);
    assert.match(d.reason, /aborted/);
  });

  test('failures may be ids or job records', () => {
    // `runIngestion` returns {id, message}; a caller with only ids should not
    // have to wrap them.
    assert.equal(classifyOutcome({ failures: ['fred.PAYEMS'] }).code, 1);
    assert.deepEqual(classifyOutcome({ failures: ['fred.PAYEMS'] }).blocking, ['fred.PAYEMS']);
  });
});

describe('parseAllowFail', () => {
  const GDELT = 'derived.ai_news_volume';

  test('accepts the shapes the workflow can be written in', () => {
    // INGEST_ALLOW_FAIL is edited by hand in a YAML file. Commas, spaces,
    // newlines and trailing separators all have to mean the same thing, or the
    // list silently stops matching and the red X comes back.
    assert.deepEqual(parseAllowFail(GDELT), [GDELT]);
    assert.deepEqual(parseAllowFail(`${GDELT},fred.PAYEMS`), [GDELT, 'fred.PAYEMS']);
    assert.deepEqual(parseAllowFail(`${GDELT} fred.PAYEMS`), [GDELT, 'fred.PAYEMS']);
    assert.deepEqual(parseAllowFail(` ${GDELT}, \n fred.PAYEMS `), [GDELT, 'fred.PAYEMS']);
  });

  test('nothing set means nothing excused', () => {
    assert.deepEqual(parseAllowFail(undefined), []);
    assert.deepEqual(parseAllowFail(null), []);
    assert.deepEqual(parseAllowFail(''), []);
    assert.deepEqual(parseAllowFail('   '), []);
  });

  test('a partial id does not match a real one', () => {
    // 'derived' must not excuse every derived job.
    assert.equal(classifyOutcome({ failures: [{ id: GDELT }], allowFail: 'derived' }).code, 1);
  });
});

/**
 * And the same two runs as REAL process exit codes, through the real CLI.
 *
 * `classifyOutcome` returning `{code: 0}` is not the claim B-20 makes. The claim
 * is that the PROCESS exits 0, and between those two sits the wiring that reads
 * INGEST_ALLOW_FAIL out of the environment, catches an abort and assigns
 * `process.exitCode`.
 *
 * WHAT THE PREVIOUS VERSION OF THIS BLOCK GOT WRONG
 *
 * It could not reach that wiring — a top-level `if (process.argv[1] === …)`
 * block only runs when runner.js is the entry point, and it opens a database —
 * so it spawned a probe that RE-IMPLEMENTED the three lines and asserted the
 * probe. Measured on 2026-09-04: changing `process.exitCode = decision.code` to
 * `process.exitCode = 1` in runner.js left all 29 tests passing. The one thing
 * B-20 is about was the one thing not covered, for the third wave running.
 *
 * The block is now `runCli()` — argv in, exit code out, with `run` and
 * `shutdown` injectable purely so this file can stub them. So the child below
 * imports and calls the SAME function `npm run ingest` calls, differing only in
 * that its jobs are stubbed instead of talking to eight upstreams. Mutate any
 * line of that function and these go red.
 */
describe('the exit code a shell would see', () => {
  const RUNNER = new URL('./runner.js', import.meta.url).href;

  /**
   * Drive the real CLI in a child process and read the code the shell reads.
   *
   * `shutdown` is stubbed because the pool is never opened — the stubbed `run`
   * issues no query — and `closePool()` on an unopened pool is a pointless
   * dependency on a reachable database inside a unit test.
   */
  function runCliWith({ result = {}, argv = [], allowFail = undefined, throws = null } = {}) {
    const child = `
      import { runCli } from ${JSON.stringify(RUNNER)};
      await runCli({
        argv: ${JSON.stringify(argv)},
        env: ${JSON.stringify(allowFail === undefined ? {} : { INGEST_ALLOW_FAIL: allowFail })},
        run: async (options) => {
          console.log('ARGV ' + JSON.stringify(options));
          ${throws ? `throw new Error(${JSON.stringify(throws)});` : ''}
          return ${JSON.stringify({ succeeded: 0, failed: 0, written: 0, failures: [], regressions: [], ...result })};
        },
        shutdown: async () => {},
      });
    `;
    const spawned = spawnSync(process.execPath, ['--input-type=module', '-e', child], {
      encoding: 'utf8',
      // INGEST_ALLOW_FAIL is passed through `env:` above, not through the
      // process environment, so a value leaking in from the shell that runs the
      // suite cannot change the answer.
      env: { ...process.env, INGEST_ALLOW_FAIL: 'this-must-be-ignored' },
    });
    assert.equal(spawned.error, undefined, `child failed to start: ${spawned.error}`);
    return { code: spawned.status, stdout: spawned.stdout, stderr: spawned.stderr };
  }

  test('a clean run really exits 0', () => {
    const { code, stdout } = runCliWith({});
    assert.equal(code, 0);
    assert.match(stdout, /^VERDICT pass — every job succeeded$/m);
  });

  test('GDELT alone: the process really exits 0, loudly', () => {
    const { code, stdout, stderr } = runCliWith({
      result: { failed: 1, failures: [{ id: 'derived.ai_news_volume', message: 'ECONNRESET' }] },
      allowFail: 'derived.ai_news_volume',
    });
    assert.equal(code, 0, `expected exit 0, got ${code}. stderr: ${stderr}`);
    // The workflow greps this line and refuses to be quieter than it.
    assert.match(stdout, /^VERDICT pass — only known-degraded jobs failed: derived\.ai_news_volume$/m);
    // And a pass with a broken source has to say so where it cannot be missed,
    // or the allow list becomes the same silence as a permanently red X.
    assert.match(stdout, /WARNING\s+known-degraded source\(s\) failed: derived\.ai_news_volume/);
  });

  test('FRED: the process really exits 1', () => {
    const { code, stdout } = runCliWith({
      result: {
        failed: 2,
        failures: [{ id: 'fred.PAYEMS' }, { id: 'derived.ai_news_volume' }],
      },
      allowFail: 'derived.ai_news_volume',
    });
    assert.equal(code, 1);
    assert.match(stdout, /^VERDICT fail — failures outside the allow-to-fail list: fred\.PAYEMS$/m);
  });

  test('a regression exits 1 even with nothing failed and the source excused', () => {
    // M-36's runner half through the real exit path: the job REPORTED SUCCESS,
    // returned nothing, and the run is red anyway.
    const { code, stdout } = runCliWith({
      result: {
        succeeded: 1,
        regressions: [{ id: 'rss:ft', kind: 'returned_nothing', message: 'returned 0 rows' }],
      },
      allowFail: 'derived.ai_news_volume',
    });
    assert.equal(code, 1);
    assert.match(stdout, /^VERDICT fail — job\(s\) worse than their own last run: rss:ft$/m);
  });

  test('with no allow list set, the same GDELT run exits 1', () => {
    // What a laptop has. The tolerance belongs to the workflow, not to the code.
    const { code, stdout } = runCliWith({
      result: { failed: 1, failures: [{ id: 'derived.ai_news_volume' }] },
    });
    assert.equal(code, 1);
    assert.match(stdout, /^VERDICT fail — failures outside the allow-to-fail list: derived\.ai_news_volume$/m);
  });

  test('a run that throws exits 1 and prints the prefix the workflow greps for', () => {
    const { code, stdout, stderr } = runCliWith({ throws: 'password authentication failed' });
    assert.equal(code, 1);
    assert.match(stderr, /^Ingestion aborted: password authentication failed$/m);
    assert.match(stdout, /^VERDICT fail — the run aborted before finishing$/m);
  });

  test('the dispatch inputs reach the ingestion run', () => {
    // `.github/workflows/ingest.yml` builds an argv array from its two dispatch
    // inputs. A source id that arrived as `null`, or a `--force` that never
    // reached `runIngestion`, would make a targeted re-run silently do the
    // wrong thing — and "Nothing due, exited 0" is this pipeline's oldest bug.
    const { stdout } = runCliWith({ argv: ['fred', '--force'] });
    assert.match(stdout, /^ARGV \{"sourceId":"fred","force":true\}$/m);

    const bare = runCliWith({ argv: [] });
    assert.match(bare.stdout, /^ARGV \{"sourceId":null,"force":false\}$/m);
  });
});


/**
 * The runner and the workflow have to agree, and nothing checked that they did.
 *
 * `.github/workflows/ingest.yml` and this runner are one mechanism written in
 * two languages. The workflow names a job id in `INGEST_ALLOW_FAIL` and greps
 * the runner's log for a `VERDICT` line. Both couplings are strings, neither is
 * type-checked by anything, and both fail SILENTLY in the same direction: a
 * mistyped id excuses nothing and the red X comes back, a changed verdict
 * wording makes the workflow conclude the runner "died before it could decide".
 * Either would look exactly like the condition B-20 describes, and the only way
 * to find out was to wait for 05:40 UTC.
 */
describe('the workflow and the runner agree', () => {
  const WORKFLOW = readFileSync(new URL('../../../.github/workflows/ingest.yml', import.meta.url), 'utf8');

  /** The value of a top-level `KEY: 'value'` in the workflow's env block. */
  function workflowEnv(key) {
    const match = WORKFLOW.match(new RegExp(`^\\s*${key}:\\s*'([^']*)'\\s*$`, 'm'));
    assert.ok(match, `${key} is not set as a single-quoted scalar in ingest.yml`);
    return match[1];
  }

  test('every id in INGEST_ALLOW_FAIL is a job this runner can produce', () => {
    const allowed = parseAllowFail(workflowEnv('INGEST_ALLOW_FAIL'));

    // An empty list is legitimate — it is what the list should become the day
    // GDELT is fixed — so this asserts nothing about its length.
    for (const id of allowed) {
      if (id.startsWith('derived.')) {
        // A derived id is fully knowable from this file, so there is no excuse
        // for one that does not exist. `derived.ai_news_volumes` would parse,
        // match no FAIL line, and quietly restore the daily failure email.
        assert.ok(
          DERIVED_JOB_IDS.includes(id),
          `INGEST_ALLOW_FAIL names "${id}", which is not a derived job. Known: ${DERIVED_JOB_IDS.join(', ')}`
        );
      } else if (matchDocumentJobs(null).includes(id)) {
        // A document job. Fully known too, and already checked by matching.
      } else {
        // A fetch job id comes out of the `indicators` table, so it cannot be
        // verified without a database. Shape only: `source.SERIES_CODE`, which
        // is what the runner prints for every handler in HANDLERS.
        assert.match(
          id,
          /^[a-z_]+\.[A-Za-z0-9_.:-]+$/,
          `INGEST_ALLOW_FAIL names "${id}", which is not shaped like any job id this runner prints`
        );
      }
    }
  });

  test("the workflow's VERDICT grep matches the line the runner actually prints", () => {
    // Read the pattern out of the workflow rather than restating it, or this
    // test would assert that two copies of a string I wrote agree with each
    // other, which is the mistake the block above this one was written to undo.
    const grep = WORKFLOW.match(/grep -E '(\^VERDICT [^']*)'/);
    assert.ok(grep, 'ingest.yml no longer greps for a VERDICT line');
    const pattern = new RegExp(grep[1], 'm');

    const RUNNER = new URL('./runner.js', import.meta.url).href;
    const child = `
      import { runCli } from ${JSON.stringify(RUNNER)};
      await runCli({
        env: { INGEST_ALLOW_FAIL: 'derived.ai_news_volume' },
        run: async () => ({ failures: [{ id: 'derived.ai_news_volume' }], regressions: [] }),
        shutdown: async () => {},
      });
    `;
    const spawned = spawnSync(process.execPath, ['--input-type=module', '-e', child], {
      encoding: 'utf8',
    });
    assert.equal(spawned.status, 0);
    assert.match(spawned.stdout, pattern);

    // And the field the workflow takes from it. `awk '{print $2}'` on that line
    // has to be the verdict word, not the em dash or a stray prefix.
    const line = spawned.stdout.split('\n').find((l) => pattern.test(l));
    assert.equal(line.trim().split(/\s+/)[1], 'pass');
  });
});
