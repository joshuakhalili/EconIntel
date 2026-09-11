import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildConfig} from '../../scripts/vercel-config.js';
import ignore from 'ignore';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
function runtimeJsonReferences(){
  const references=new Set();
  function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){
    const file=join(dir,e.name);
    if(e.isDirectory())walk(file);
    else if(e.name.endsWith('.js')&&!e.name.endsWith('.test.js')){
      const body=readFileSync(file,'utf8');
      // Static ESM imports and local readFile(new URL(..., import.meta.url)).
      for(const m of body.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*|new URL\(\s*)['"](\.\.?\/[^'"]+\.json)['"]/g))references.add(relative(root,resolve(dirname(file),m[1])).split('\\').join('/'));
    }
  }}
  walk(join(root,'src/server'));walk(join(root,'api'));
  return [...references].sort();
}
test('every local runtime JSON artifact is explicitly included in the Vercel function',()=>{
  const config=buildConfig();
  const include=config.functions['api/index.js'].includeFiles;
  assert.match(include,/^\{[^*{}]+\}$/,'Use an exact artifact allowlist, not all docs or fixtures');
  const included=new Set(include.slice(1,-1).split(','));
  const required=runtimeJsonReferences();
  assert.ok(required.includes('docs/research/country-measurement-dispositions.json'),'Scanner must detect attributed ESM JSON import');
  assert.ok(required.includes('docs/research/editorial-review-ledger.json'),'Scanner must detect lazy readFile URL');
  for(const artifact of ['public/index.html',...required]){
    assert.ok(included.has(artifact),`Missing serverless runtime artifact: ${artifact}`);
    // CI runs tests before Vite generates public/index.html. JSON evidence is
    // committed input and must exist even in a clean, unbuilt checkout.
    if(artifact.endsWith('.json'))assert.ok(existsSync(join(root,artifact)),`Artifact absent from checkout: ${artifact}`);
  }
  assert.deepEqual([...included].sort(),['public/index.html',...required].sort());
});
test('committed deployment manifest matches the generated runtime artifact allowlist',()=>{
  const committed=JSON.parse(readFileSync(join(root,'vercel.json'),'utf8'));
  assert.equal(committed.functions['api/index.js'].includeFiles,buildConfig().functions['api/index.js'].includeFiles);
});
test('Vercel upload ignore rules admit both runtime JSONs without publishing other research documents',()=>{
  const rules=ignore().add(readFileSync(join(root,'.vercelignore'),'utf8'));
  for(const artifact of ['public/index.html',...runtimeJsonReferences()])assert.equal(rules.ignores(artifact),false,`Vercel upload excludes required runtime input: ${artifact}`);
  for(const privateFile of ['docs/private.json','docs/research/editorial-review-snapshot.json','docs/research/release-current-status.md','docs/research/other.json','db/seeds/064_structured_workplace_evidence.sql'])assert.equal(rules.ignores(privateFile),true,`Private build material must remain excluded: ${privateFile}`);
});
test('actual Vercel function trace resolves upload-eligible runtime artifacts',{
  skip: !process.env.VERIFY_VERCEL_ARTIFACT ? 'Run VERIFY_VERCEL_ARTIFACT=1 after vercel build to inspect the actual function trace' : false,
},()=>{
  const functionDir=join(root,'.vercel/output/functions/api/index.func');
  const trace=JSON.parse(readFileSync(join(functionDir,'.vc-config.json'),'utf8'));
  const rules=ignore().add(readFileSync(join(root,'.vercelignore'),'utf8'));
  for(const artifact of ['public/index.html',...runtimeJsonReferences()]){
    // Vercel may deduplicate source files outside .func via filePathMap.
    // These references are filtered by .vercelignore again during upload.
    const mapped=trace.filePathMap?.[artifact];
    const bundled=mapped ? resolve(root,mapped) : join(functionDir,artifact);
    assert.ok(existsSync(bundled),`Actual function trace does not resolve ${artifact}`);
    if(mapped){
      assert.ok(!relative(root,bundled).startsWith('..'),'Mapped runtime input must stay within the deployment root');
      assert.equal(rules.ignores(relative(root,bundled)),false,`Traced artifact excluded at upload: ${artifact}`);
    }
    assert.deepEqual(readFileSync(bundled),readFileSync(join(root,artifact)),`Bundled ${artifact} differs from current source`);
  }
});
