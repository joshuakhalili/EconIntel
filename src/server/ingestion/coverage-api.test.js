import { test } from 'node:test';
import assert from 'node:assert/strict';
import { observationStatus, dbnomicsValueStatus } from './sources/dbnomics.js';
import { fetchStrand } from './sources/openalex.js';
import { parseBackfillArgs } from '../../../scripts/backfill-country-coverage.js';
import { describeIntegrations } from '../config.js';
import { ingestCheckpointedCorpus } from './openalex-checkpoint.js';

test('quality codes preserve labels and align with each observation', () => {
  const series = { observations_attributes: [['OBSV_STATUS', [null, 'B', 'E', 'Q']]] };
  const dataset = { attributes_values_labels: { OBSV_STATUS: { B: 'Break in series', E: 'Estimated' } } };
  assert.equal(observationStatus(series, dataset, 0), null);
  assert.equal(observationStatus(series, dataset, 1), 'OBSV_STATUS=B (Break in series)');
  assert.equal(observationStatus(series, dataset, 2), 'OBSV_STATUS=E (Estimated)');
  assert.equal(observationStatus(series, dataset, 3), 'OBSV_STATUS=Q');
  const eurostat = { observations_attributes: [['CONF_STATUS', ''], ['OBS_FLAG', 'bu']] };
  const labels = { attributes_values_labels: { OBS_FLAG: { bu: 'break in time series, low reliability' } } };
  assert.equal(observationStatus(eurostat, labels, 20), 'OBS_FLAG=bu (break in time series, low reliability)');
});

test('forecast reconstruction distinguishes AMECO annual forecasts from current-period measurements', () => {
  const bounds = { periodStart: '2026-01-01', periodEnd: '2026-12-31' };
  assert.equal(dbnomicsValueStatus('AMECO/series', bounds, 96.29, null, '2026-09-10'), 'projected');
  assert.equal(dbnomicsValueStatus('OTHER/series', bounds, 96.29, null, '2026-09-10'), null);
  assert.equal(dbnomicsValueStatus('AMECO/series', bounds, null, null, '2026-09-10'), null);
  assert.equal(dbnomicsValueStatus('OTHER/series', { periodStart: '2027-01-01', periodEnd: '2027-12-31' }, 2, 'OBS_FLAG=p', '2026-09-10'), 'projected;OBS_FLAG=p');
  assert.equal(dbnomicsValueStatus('AMECO/series', bounds, 96.29, null, '2027-01-02'), null);
});

test('OpenAlex uses bounded pages, header auth, and exposes resume cursor after acknowledged page', async () => {
  const checkpoints = [];
  const result = await fetchStrand({ id: 'test', filters: () => [] }, {
    apiKey: 'test-only', startCursor: 'resume', maxPages: 1,
    request: async (url, options) => {
      assert.equal(new URL(url).searchParams.get('per-page'), '100');
      assert.equal(new URL(url).searchParams.get('cursor'), 'resume');
      assert.ok(!url.includes('test-only'));
      assert.equal(options.headers.Authorization, 'Bearer test-only');
      return { meta: { count: 2, next_cursor: 'next' }, results: [{ display_name: '' }] };
    }, onPage: async (page) => checkpoints.push(page),
  });
  assert.equal(result.truncated, true);
  assert.equal(result.nextCursor, 'next');
  assert.equal(checkpoints[0].nextCursor, 'next');
  await assert.rejects(fetchStrand({}, { perPage: 200 }), /perPage/);
  await assert.rejects(fetchStrand({}, { maxPages: 0 }), /maxPages/);
});

test('country backfill defaults to preview and requires exact ids to execute', () => {
  assert.deepEqual(parseBackfillArgs([]), { execute: false, ids: [] });
  assert.throws(() => parseBackfillArgs(['--execute']), /explicit/);
  assert.throws(() => parseBackfillArgs(['--execute', 'all']), /exact/);
  assert.deepEqual(parseBackfillArgs(['--execute', 'wb.IT.NET.USER.ZS']), { execute: true, ids: ['wb.IT.NET.USER.ZS'] });
});

test('a key does not advertise an absent adapter as ready', () => {
  for (const name of ['Ember', 'EIA', 'BLS', 'Copernicus']) {
    const integration = describeIntegrations().find((item) => item.name === name);
    assert.equal(integration.ready, false);
    assert.equal(integration.implemented, false);
  }
});

test('OpenAlex resumes a committed page after later failure, never skips an uncommitted page', async () => {
  let saved;
  const save = async (checkpoint) => { saved = structuredClone(checkpoint); };
  const insert = async () => ({ written: 1, duplicates: 0, skipped: 0 });
  await assert.rejects(ingestCheckpointedCorpus({ save, insert,
    fetch: async (strand, options) => {
      await options.onPage({ documents: [{}], nextCursor: 'page-two' });
      throw new Error('upstream outage');
    },
  }), /outage/);
  assert.equal(Object.values(saved.cursors)[0], 'page-two');
  let first = true;
  const result = await ingestCheckpointedCorpus({ previous: saved, save, insert,
    fetch: async (strand, options) => {
      if (first) assert.equal(options.startCursor, 'page-two');
      first = false;
      await options.onPage({ documents: [{}], nextCursor: null });
    },
  });
  assert.equal(result.details.checkpoint.complete, true);
  assert.equal(result.written, 2);
  await assert.rejects(ingestCheckpointedCorpus({ save,
    insert: async () => { throw new Error('database failed'); },
    fetch: async (strand, options) => options.onPage({ documents: [{}], nextCursor: 'must-not-save' }),
  }), /database failed/);
  assert.deepEqual(saved.cursors, {});
});
