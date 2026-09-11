import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';
import {typedNarration} from '../../server/lib/narration-facts.js';

const reactUrl = pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const original = await readFile(new URL('./NarrationBlock.jsx',import.meta.url),'utf8');
async function component(expanded=false) {
  let source = `import React from '${reactUrl}';\n` + original
    .replace("import { useState } from 'react';", `const useState = () => [${expanded}, () => {}];`)
    .replace("import { RiSparkling2Line, RiArrowDownSLine } from '@remixicon/react';", 'const RiSparkling2Line = () => null; const RiArrowDownSLine = () => null;')
    .replace("'@/lib/format'", JSON.stringify(new URL('../lib/format.js',import.meta.url).href));
  const {code} = await transformWithOxc(source,'NarrationBlock.jsx',{jsx:{runtime:'classic'}});
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
}
const collapsed = await component(), expanded = await component(true);
const narration = typedNarration({series:[{name:'Output',country:'GBR',unit:'GBP bn',latest:12,previous:10,
  period:'2026-06-01',previous_period:'2026-03-01',value_status:'provisional',source_url:'https://example.org/source'}]});
test('real narration component labels deterministic rendering without claiming human authorship',()=>{
  const html=renderToStaticMarkup(React.createElement(collapsed,{narration}));
  assert.match(html,/Automatically rendered from source-bound facts/);
  assert.match(html,/GBR/); assert.match(html,/higher than/);
  assert.doesNotMatch(html,/every claim is written by a person|Written by a machine/);
});
test('expanded disclosure renders bound geography, statuses, source and selected IDs',()=>{
  const html=renderToStaticMarkup(React.createElement(expanded,{narration}));
  for(const text of ['fixed templates','provisional','2026-03-01','https://example.org/source',narration.grounding.facts[0].id])assert.ok(html.includes(text),text);
  assert.match(html,/does not establish causality/);
});
test('no narration renders nothing; legacy prose is not labelled fact-bound',()=>{
  assert.equal(renderToStaticMarkup(React.createElement(collapsed,{})),'');
  const html=renderToStaticMarkup(React.createElement(collapsed,{narration:{body:'Legacy summary'}}));
  assert.match(html,/Legacy machine-written summary/);
  assert.doesNotMatch(html,/Automatically rendered/);
});
