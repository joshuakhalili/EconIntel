import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { transformWithOxc } from 'vite';
const reactUrl = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const original = await readFile(new URL('./LensSignature.jsx', import.meta.url), 'utf8');
const source = `import React from '${reactUrl}';\n` + original
  .replace("import { Link } from 'react-router-dom';", "const Link=({to,children,...props})=>React.createElement('a',{...props,href:to},children);")
  .replace("import { fmt, displayUnit } from '@/lib/format';", `import {fmt,displayUnit} from '${new URL('../../lib/format.js',import.meta.url).href}';`)
  .replace("import { useReveal, revealClass } from '@/hooks/useReveal';", "const useReveal=()=>[null,true],revealClass=()=>'';")
  .replace("import { adoptionSnapshots } from '@/lib/adoptionSnapshots';", `import {adoptionSnapshots} from '${new URL('../../lib/adoptionSnapshots.js',import.meta.url).href}';`);
const { code } = await transformWithOxc(source, 'LensSignature.jsx', { jsx: { runtime: 'classic' } });
const Component = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
const row = (id, extra={}) => ({ indicator_id:id,latest_value:9,previous_value:100,latest_period:'2026-08-01',latest_period_end:'2026-08-31',unit:'count',...extra });
const render = (id, rows, extra={}) => renderToStaticMarkup(React.createElement(Component,{lens:{id,...extra},tickers:rows,accent:{hex:'#fff',glow:'#fff'}}));

test('policy categories never imply legal durability or unmatched conversion percentages', () => {
  const html=render('regulation',[
    row('derived.ai_binding_rules'),row('derived.ai_presidential_documents'),
    row('derived.ai_proposed_rules',{latest_period:'2025-01-01',latest_period_end:'2025-01-31'}),
    row('derived.ai_regulation_volume',{latest_value:100,latest_period_end:'2099-12-31'}),
  ]);
  assert.match(html,/Documents published, not laws currently in force/);
  assert.match(html,/PRESIDENTIAL/);assert.match(html,/ALL TYPES/);
  assert.match(html,/2025-01-31/);assert.match(html,/Reference period not complete/);
  assert.doesNotMatch(html,/Mostly proposing|binds ·|does not bind yet|9%|how hard each|width:/);
});
test('missing policy values are unavailable, not zero or missing current-period claims',()=>{
  const html=render('regulation',[row('derived.ai_binding_rules'),row('derived.ai_proposed_rules',{latest_value:null})]);
  assert.match(html,/PROPOSED.*no usable stored observation/);
  assert.equal(render('regulation',[row('derived.ai_binding_rules',{latest_value:null})]),'');
});
test('price snapshots expose units and dates without invented rebase/direction/computation-cost claims',()=>{
  const html=render('prices',[row('fred.PCU334413334413',{unit:'Index 1998=100'}),row('fred.PCU518210518210',{unit:'Index 2000=100'})]);
  assert.match(html,/different baskets and base periods/);assert.match(html,/Index 1998 = 100/);
  assert.match(html,/2026-08-31/);assert.doesNotMatch(html,/Computation got cheaper|its base of 100|below|above/);
  assert.equal(render('prices',[row('fred.PCU334413334413',{latest_value:null}),row('fred.PCU518210518210')]),'');
});
test('investment shows old/qualified observations without unchecked change arithmetic',()=>{
  const html=render('investment',[row('fred.PCOPPUSDM',{unit:'USD',latest_status:'projected;status_unverified',latest_period:'2025-01-01'})]);
  assert.match(html,/older endpoint is not a current quote/);assert.match(html,/2025-01-01/);
  assert.match(html,/projected;status_unverified/);assert.doesNotMatch(html,/91\.0%|not a forecast|↑|↓/);
});
test('labour contested badge does not turn heterogeneous studies into opposite identified effects',()=>{
  const html=render('labour',[row('context')],{questions:[{strength:'contested'}]});
  assert.match(html,/editorial assessment/);assert.match(html,/Populations, AI-exposure measures/);
  assert.doesNotMatch(html,/opposite conclusions from the same period|employment growing fastest|which side its own data falls/);
});
