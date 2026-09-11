import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {resolve,join,relative,dirname} from 'node:path';
import {planAssetRevisions,revisionLandingAssets,replaceAssetNames} from '../../scripts/revision-landing-assets.js';
const main='assets/js/script_main.DLW9xvZo.mjs';
const search='assets/data/searchIndex-TrnkpBDtcFPn.json';
const fixture={
 [main]:'import "./child.mjs"; const search="/assets/data/searchIndex-TrnkpBDtcFPn.json";',
 'assets/js/child.mjs':'export const copy="corrected economic claim";',
 [search]:'{"description":"revised search description"}',
 'index.html':'<script type="module" src="/assets/js/script_main.DLW9xvZo.mjs"></script>'
};
test('changed immutable entry and search URLs update HTML and module references',()=>{
 const p=planAssetRevisions(fixture);const entry=p.manifest.assets[main].path;const data=p.manifest.assets[search].path;
 assert.notEqual(entry,main);assert.notEqual(data,search);assert.ok(p.files[entry]);assert.ok(p.files[data]);
 assert.ok(p.files['index.html'].includes('/'+entry));assert.ok(p.files[entry].includes('/'+data));
 assert.equal(p.files['index.html'].includes('/'+main),false);
});
test('asset revision is idempotent',()=>{const a=planAssetRevisions(fixture);const b=planAssetRevisions(a.files,a.manifest);assert.deepEqual(b.files,a.files);assert.deepEqual(b.manifest,a.manifest);assert.deepEqual(b.moves,[]);assert.deepEqual(b.changed,[]);});
test('dependency edits invalidate the child and transitive immutable importer',()=>{const a=planAssetRevisions(fixture);const files={...a.files,'assets/js/child.mjs':'export const copy="later correction";'};const b=planAssetRevisions(files,a.manifest);assert.notEqual(b.manifest.assets[main].path,a.manifest.assets[main].path);assert.notEqual(b.manifest.assets['assets/js/child.mjs'].path,'assets/js/child.mjs');assert.equal(b.manifest.assets[search].path,a.manifest.assets[search].path);assert.deepEqual(planAssetRevisions(b.files,b.manifest).changed,[]);});
test('cyclic dependencies have deterministic URLs rather than iterative hash churn',()=>{const f={...fixture,'assets/js/child.mjs':'import "./script_main.DLW9xvZo.mjs";export const x=1;'};const a=planAssetRevisions(f);assert.deepEqual(planAssetRevisions(a.files,a.manifest).changed,[]);});
test('new importer and HTML can reference canonical names after an earlier revision',()=>{
 const a=planAssetRevisions(fixture);
 const added={...a.files,'assets/js/new.mjs':'import "./script_main.DLW9xvZo.mjs";',
  'new.html':'<script type="module" src="/assets/js/script_main.DLW9xvZo.mjs"></script><link href="/assets/data/searchIndex-TrnkpBDtcFPn.json">'};
 const b=planAssetRevisions(added,a.manifest);
 const entry=b.manifest.assets[main].path;
 const importer=b.manifest.assets['assets/js/new.mjs'].path;
 assert.ok(b.files[importer].includes('./'+entry.split('/').at(-1)));
 assert.ok(b.files['new.html'].includes('/'+entry));
 assert.ok(b.files['new.html'].includes('/'+b.manifest.assets[search].path));
 assert.equal(b.files[importer].includes('./script_main.DLW9xvZo.mjs'),false);
 assert.deepEqual(planAssetRevisions(b.files,b.manifest).changed,[]);
});
test('mixed canonical and physical references target the same next URL without cascading',()=>{
 const a=planAssetRevisions(fixture);
 const physical=a.manifest.assets[main].path;
 const added={...a.files,[physical]:a.files[physical]+'\nexport const correction=1;',
  'mixed.html':'<script src="/'+main+'"></script><script src="/'+physical+'"></script>'};
 const b=planAssetRevisions(added,a.manifest);
 const next=b.manifest.assets[main].path;
 assert.notEqual(next,physical);
 assert.equal(b.files['mixed.html'],'<script src="/'+next+'"></script><script src="/'+next+'"></script>');
 assert.equal(replaceAssetNames('a.mjs b.mjs',[['a.mjs','b.mjs'],['b.mjs','c.mjs']]),'b.mjs c.mjs');
 assert.equal(replaceAssetNames('long-a.mjs',[['a.mjs','short.mjs'],['long-a.mjs','whole.mjs']]),'whole.mjs');
});
test('real landing entry URLs and module imports resolve after revision',()=>{
 const root=resolve('landing');const manifest=JSON.parse(readFileSync(join(root,'docs/asset-revisions.json'),'utf8'));
 const html=readFileSync(join(root,'index.html'),'utf8');const revised=Object.entries(manifest.assets).filter(([old,a])=>old!==a.path);
 assert.ok(revised.length>=4);assert.ok(html.includes(manifest.assets[main].path));assert.equal(html.includes('/'+main),false);
 for(const [old,a]of revised){assert.ok(existsSync(join(root,a.path)),a.path);assert.equal(existsSync(join(root,old)),false,old);}
 for(const a of Object.values(manifest.assets).filter(a=>a.path.endsWith('.mjs'))){const body=readFileSync(join(root,a.path),'utf8');for(const m of body.matchAll(/["'`]([^"'`]+)["'`]/g)){if(!m[1].endsWith('.mjs')||!['./','../','/assets/'].some(prefix=>m[1].startsWith(prefix)))continue;const target=m[1].startsWith('/')?join(root,m[1]):resolve(root,dirname(a.path),m[1]);assert.ok(existsSync(target),a.path+' -> '+m[1]);}}
 assert.equal(revisionLandingAssets(root).ok,true);
});
