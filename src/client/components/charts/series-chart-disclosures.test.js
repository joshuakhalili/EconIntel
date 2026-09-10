import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';

// Render the real SeriesChart branches and hooks. Only the drawing surface is
// stubbed: this regression concerns the surrounding text, not SVG or layout.
const require = createRequire(import.meta.url);
const reactUrl = pathToFileURL(require.resolve('react')).href;
const source = (await readFile(new URL('./SeriesChart.jsx', import.meta.url), 'utf8'))
  .replace("import { useMemo } from 'react';", `import React, { useMemo } from '${reactUrl}';`)
  .replace("import LineChart from './LineChart';", 'const LineChart = () => null;')
  .replace("'../../../shared/observationQuality.js'", JSON.stringify(new URL('../../../shared/observationQuality.js', import.meta.url).href))
  .replace("'@/lib/format'", JSON.stringify(new URL('../../lib/format.js', import.meta.url).href));
const { code } = await transformWithOxc(source, 'SeriesChart.jsx', { jsx: { runtime: 'classic' } });
const { default: SeriesChart } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

const forecast = { id: 'ameco', meta: { name: 'AMECO output', unit: 'index' }, points: [
  { date: '2024-01-01', value: 100 },
  { date: '2025-01-01', value: 102, value_status: 'projected;status_unverified' },
] };
const broken = { id: 'ilo', meta: { name: 'Employment', unit: 'people' }, points: [
  { date: '2024-01-01', value: 10 },
  { date: '2025-01-01', value: 12, value_status: 'OBS_STATUS=B' },
] };

for (const indexBlocked of [false, true]) {
  test(`forecast and unverified-outturn disclosures render with indexBlocked=${indexBlocked}`, () => {
    const html = renderToStaticMarkup(React.createElement(SeriesChart, {
      payload: { series: [broken, forecast], indexed: false, indexBlocked, indexNote: 'Rebasing withheld' },
    }));
    assert.match(html, /Projections, not measurements/);
    assert.match(html, /AMECO output from 2025/);
    assert.match(html, /no confirmed outturn classification/);
    assert.equal((html.match(/no confirmed outturn classification/g) ?? []).length, 1);
    if (indexBlocked) assert.match(html, /Rebasing withheld/);
  });
}
test('split measured series do not gain a forecast warning', () => {
  const html = renderToStaticMarkup(React.createElement(SeriesChart, {
    payload: { series: [broken], indexed: false, indexBlocked: true },
  }));
  assert.doesNotMatch(html, /Projections, not measurements|no confirmed outturn classification/);
});
