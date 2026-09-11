import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformWithOxc} from 'vite';
const reactUrl=pathToFileURL(createRequire(import.meta.url).resolve('react')).href;
const original=await readFile(new URL('./ResearchReview.jsx',import.meta.url),'utf8');
async function render(result){
  const source=`import React from '${reactUrl}';\n`+original
    .replace("import { useParams } from 'react-router-dom';","const useParams=()=>({slug:'jobs'});")
    .replace("import { useQuery } from '@tanstack/react-query';",`const useQuery=()=>(${JSON.stringify(result)});`);
  const {code}=await transformWithOxc(source,'ResearchReview.jsx',{jsx:{runtime:'classic'}});
  const component=(await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default;
  return renderToStaticMarkup(React.createElement(component,{claims:[{id:'x',statement:'Bound claim',evidence:[]}]}));
}
test('older API without granular review remains usable and never implies completed review',async()=>{
  const html=await render({data:{candidates:[],runs:[],review_queue:[],source_refreshes:[],corpus_benchmark:{found:2,denominator:6}}});
  assert.match(html,/Bound claim/);assert.match(html,/Granular review unavailable from this server version/);
  assert.doesNotMatch(html,/current agent disposition/);
});
test('pending and unavailable workflow preserve claim evidence',async()=>{
  assert.match(await render({isPending:true}),/Loading research workflow/);
  assert.match(await render({isError:true}),/absence is not a completed review/);
});
test('current API exposes stale granular status and source-change issues',async()=>{
  const html=await render({data:{granular_review:{status:'stale',gate:{meaning:'Exact binding only',issues:[{kind:'changed_field',id:'jobs.answer_plain'}]}}}});
  assert.match(html,/stale/);assert.match(html,/changed_field: jobs.answer_plain/);
});
