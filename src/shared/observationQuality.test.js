import test from 'node:test';
import assert from 'node:assert/strict';
import { hasSeriesBreak, crossesSeriesBreak, isProjected } from './observationQuality.js';
import { buildChartModel, rankEntities, describeSeriesChart } from '../client/components/charts/chartModel.js';
import { inferCadence, fmtDate } from '../client/lib/format.js';

const points = [
  { date: '2020-01-01', value: 10 },
  { date: '2021-01-01', value: 20, value_status: 'OBSV_STATUS=B (Break in series)' },
  { date: '2022-01-01', value: 21 },
];
test('provider break codes are read without treating other flags as breaks', () => {
  assert.equal(hasSeriesBreak(points[1]), true);
  assert.equal(hasSeriesBreak({ value_status: 'OBS_STATUS=B; CONF_STATUS=F' }), true);
  assert.equal(hasSeriesBreak({ value_status: 'OBS_STATUS=Q' }), false);
  assert.equal(hasSeriesBreak({ value_status: 'OBS_FLAG=bu (break in time series, low reliability)' }), true);
  assert.equal(hasSeriesBreak({ value_status: 'projected' }), false);
  assert.equal(crossesSeriesBreak(points, '2020-01-01', '2022-01-01'), true);
  assert.equal(crossesSeriesBreak(points, '2021-01-01', '2022-01-01'), false);
});
test('line does not bridge a source break and raw table data is preserved', () => {
  const model = buildChartModel([{ label: 'Survey', points }], 'annual', false);
  assert.equal(model.rows[1].Survey, null);
  assert.equal(points[1].value, 20);
  assert.match(describeSeriesChart([{ label: 'Survey', points }]), /Historical comparison withheld/);
});
test('ranked comparisons cannot cross a break', () => {
  const model = rankEntities([{ label: 'Survey', points }]);
  assert.equal(model.entities[0].baseline, null);
  assert.equal(model.entities[0].breakBetween, true);
  assert.equal(model.entities[0].latest.value, 21);
});

test('projection classification survives additional provider metadata', () => {
  assert.equal(isProjected({ value_status: 'projected;status_unverified' }), true);
  assert.equal(isProjected({ value_status: 'projected; OBS_FLAG=p (provisional)' }), true);
  assert.equal(isProjected({ value_status: 'OBS_FLAG=p (provisional)' }), false);
  const model = buildChartModel([{ label: 'Forecast', points: [
    { date: '2025-01-01', value: 3, value_status: 'projected;status_unverified' },
  ] }], 'annual', false);
  assert.equal(model.rows[0].Forecast, null);
  assert.equal(model.rows[0]['Forecast (projected)'], 3);
});

test('fortnightly surveys retain distinct reference dates', () => {
  const points = [{ date: '2026-08-10', value: 22.4 }, { date: '2026-08-24', value: 22.5 }];
  assert.equal(inferCadence(points), 'fortnightly');
  assert.equal(fmtDate(points[0].date, 'fortnightly'), '10 Aug 2026');
  assert.notEqual(fmtDate(points[0].date, 'fortnightly'), fmtDate(points[1].date, 'fortnightly'));
});
