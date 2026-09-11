import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
import { figureValueLabel, figureTableModel, describeFigureChart } from './chartModel.js';

const qualitative = { label: 'Learning task', series: '', value: null,
  value_note: 'Small speedup; not statistically significant. No exact zero effect established.' };
test('qualitative finding remains text in accessible description and data table', () => {
  assert.equal(figureValueLabel(qualitative), qualitative.value_note);
  assert.equal(figureTableModel([qualitative]).rows[0].cells[1], qualitative.value_note);
  assert.match(describeFigureChart([qualitative]), /0 numeric bars/);
  assert.doesNotMatch(describeFigureChart([qualitative]), /Learning task: 0/);
  assert.equal(figureValueLabel({ value: 0 }, { unitSymbol: '%' }), '0%');
  assert.equal(figureValueLabel({ value: null }), 'No numeric estimate reported');
});

const require = createRequire(import.meta.url);
const reactUrl = pathToFileURL(require.resolve('react')).href;
const tableSource=`import React from '${reactUrl}';\n`+await readFile(new URL('./ChartDataTable.jsx',import.meta.url),'utf8');
const tableCode=(await transformWithOxc(tableSource,'ChartDataTable.jsx',{jsx:{runtime:'classic'}})).code;
const tableUrl=`data:text/javascript;base64,${Buffer.from(tableCode).toString('base64')}`;
let source = await readFile(new URL('./FigureChart.jsx', import.meta.url), 'utf8');
source = `import React from '${reactUrl}';\n` + source
  .replace("import { RiExternalLinkLine } from '@remixicon/react';", 'const RiExternalLinkLine = () => null;')
  .replace("'@/lib/format'", JSON.stringify(new URL('../../lib/format.js', import.meta.url).href))
  .replace("'./chartModel'", JSON.stringify(new URL('./chartModel.js', import.meta.url).href))
  .replace("'@/lib/reviewLabel'", JSON.stringify(new URL('../../lib/reviewLabel.js', import.meta.url).href))
  .replace("'./ChartDataTable'", JSON.stringify(tableUrl));
const { code } = await transformWithOxc(source, 'FigureChart.jsx', { jsx: { runtime: 'classic' } });
const { default: FigureChart } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('real chart branch renders qualitative text without a zero-width numeric bar', () => {
  const html = renderToStaticMarkup(React.createElement(FigureChart, { figure: {
    title: 'Research results', publisher: 'Original researchers', unit: '%', unit_symbol: '%',
    points: [qualitative], source_url: 'https://example.org/paper',
  } }));
  assert.match(html, /data-qualitative-finding/);
  assert.match(html, /not statistically significant/);
  assert.doesNotMatch(html, /width:0%|>0%<|NaN/);
});
test('mixed numeric and qualitative points retain valid domains and forecast words', () => {
  const html = renderToStaticMarkup(React.createElement(FigureChart, { figure: {
    title: 'Mixed results', unit_symbol: '%', points: [qualitative,
      { label: 'Scenario', value: 20, basis: 'scenario' }, { label: 'Decline', value: -10 }],
  } }));
  assert.match(html, /scenario/);
  assert.match(html, /20/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
test('IMF source arithmetic mismatch is visible beside the figure, not hidden in the ledger', async () => {
  const snapshot=JSON.parse(await readFile(new URL('../../../../docs/research/editorial-review-snapshot.json',import.meta.url),'utf8'));
  const figure=snapshot.figures.find(f=>f.id==='imf-macro-inference-cost-decline');
  const html=renderToStaticMarkup(React.createElement(FigureChart,{figure}));
  assert.match(html, /annotations do not exactly reconcile/);
  assert.match(html, /must not be treated as precise calculated ratios/);
  assert.doesNotMatch(html, /<details/);
});
test('accessible table is clipped by a block wrapper, not an intrinsically wide hidden table',()=>{
  const html=renderToStaticMarkup(React.createElement(FigureChart,{figure:{title:'Long report labels',points:[{label:'A deliberately long original report category '.repeat(8),value:54.3,basis:'expectation'}]}}));
  assert.match(html,/<div class="sr-only"><table>/);
  assert.doesNotMatch(html,/<table class="sr-only"|<table[^>]*aria-hidden|<table[^>]* hidden/);
  assert.match(html,/<th[^>]*scope="row"/);
});
test('forecast value labels remain in wrapping normal flow on narrow charts',()=>{
  const html=renderToStaticMarkup(React.createElement(FigureChart,{figure:{title:'Expected headcount',decimals:1,unit_symbol:'%',points:[{label:'Expected increase',value:54.3,basis:'expectation'},{label:'Expected decrease',value:-12.5,basis:'expectation'}]}}));
  const labels=[...html.matchAll(/<span class="([^"]*)" data-figure-value-label="">([\s\S]*?)<\/span>/g)];
  assert.equal(labels.length,2);
  for(const label of labels){assert.doesNotMatch(label[1],/absolute|whitespace-nowrap/);assert.match(label[1],/break-words/);assert.match(label[2],/expected/);}
  assert.match(html,/54\.3%/);assert.match(html,/-12\.5%/);
  assert.match(html,/repeating-linear-gradient/);
});
