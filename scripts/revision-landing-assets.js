/** Revise copied Framer assets after local edits; immutable URLs must change.
 * Canonical names are retained in a build-only manifest. A module URL hashes
 * its canonical contents and dependency closure, so importer URLs also change
 * and cyclic imports are deterministic. Running twice makes no further edits.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { basename, extname, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const MANIFEST='docs/asset-revisions.json';
const INITIAL_EDITS=new Set([
  'assets/js/script_main.DLW9xvZo.mjs',
  'assets/js/VuFJ2JeM7NTvopS9yPPBl8nqw8qqR1DA-c7cIYKw9tI.Bw_fTdDN.mjs',
  'assets/data/searchIndex-TrnkpBDtcFPn.json',
  'assets/data/searchIndex-VCfFl6xuL2k5.json',
]);
const hash=s=>createHash('sha256').update(s).digest('hex');
// Scan only the original input: a replacement must never become another key.
export function replaceAssetNames(text,pairs) {
  const lookup=new Map();
  for(const [from,to]of pairs){
    if(!from)throw new Error('Empty landing asset reference');
    if(lookup.has(from)&&lookup.get(from)!==to)throw new Error('Ambiguous landing asset reference: '+from);
    lookup.set(from,to);
  }
  const keys=[...lookup.keys()].sort((a,b)=>b.length-a.length);
  let cursor=0,result='';
  while(cursor<text.length){
    let index=-1,key;
    for(const candidate of keys){
      const found=text.indexOf(candidate,cursor);
      if(found!==-1&&(index===-1||found<index)){index=found;key=candidate;}
    }
    if(index===-1){result+=text.slice(cursor);break;}
    result+=text.slice(cursor,index)+lookup.get(key);
    cursor=index+key.length;
  }
  return result;
}
const assetFile=p=>p.startsWith('assets/')&&(/\.m?js$/.test(p)||/searchIndex-.*\.json$/.test(p));

export function planAssetRevisions(files,previous={assets:{}}) {
  const inverse=new Map(Object.entries(previous.assets??{}).map(([logical,a])=>[a.path,logical]));
  const normalise=Object.entries(previous.assets??{}).filter(([logical,a])=>logical!==a.path)
    .map(([logical,a])=>[basename(a.path),basename(logical)]).sort((a,b)=>b[0].length-a[0].length);
  const assets=new Map();
  for(const [path,text] of Object.entries(files))if(assetFile(path)) {
    const logical=inverse.get(path)??path;
    if(assets.has(logical))throw new Error(`Duplicate landing asset identity: ${logical}`);
    const canonical=replaceAssetNames(text,normalise);
    assets.set(logical,{path,canonical,hash:hash(canonical)});
  }
  const dependencies=new Map([...assets].map(([logical,a])=>[logical,[...assets.keys()].filter(k=>a.canonical.includes(basename(k)))]));
  if(new Set([...assets.keys()].map(p=>basename(p))).size!==assets.size)throw new Error('Ambiguous landing asset basenames; reference rewrite requires explicit paths.');
  const revised=new Set([...assets].filter(([logical,a])=>{
    const old=previous.assets?.[logical];
    return old ? old.path!==logical||old.canonical_sha256!==a.hash : INITIAL_EDITS.has(logical)||Object.keys(previous.assets??{}).length>0;
  }).map(([logical])=>logical));
  // A changed child requires a new immutable importer URL too.
  let grew=true;
  while(grew){grew=false;for(const [logical,deps]of dependencies)if(!revised.has(logical)&&deps.some(d=>revised.has(d))){revised.add(logical);grew=true;}}
  const next={version:1,assets:{}};
  for(const logical of [...assets.keys()].sort()) {
    const a=assets.get(logical);let path=logical;
    if(revised.has(logical)) {
      const closure=new Set();
      const visit=k=>{if(closure.has(k))return;closure.add(k);for(const d of dependencies.get(k)??[])visit(d);};
      visit(logical);
      const digest=hash(JSON.stringify([...closure].sort().map(k=>[k,assets.get(k).hash]))).slice(0,16);
      const extension=extname(logical);
      path=logical.slice(0,-extension.length)+'.diffusion-'+digest+extension;
    }
    next.assets[logical]={path,canonical_sha256:a.hash};
  }
  // Newly added authoring HTML/modules may still use a canonical Framer name.
  // Accept both that identity and the currently served physical filename.
  const replacements=[...assets].flatMap(([logical,a])=>[
    [basename(logical),basename(next.assets[logical].path)],
    [basename(a.path),basename(next.assets[logical].path)],
  ])
    .filter(([a,b])=>a!==b).sort((a,b)=>b[0].length-a[0].length);
  const output={},moves=[];
  for(const [path,text] of Object.entries(files)) {
    const logical=inverse.get(path)??path;
    const target=assets.has(logical)?next.assets[logical].path:path;
    if(target!==path)moves.push({from:path,to:target});
    output[target]=replaceAssetNames(text,replacements);
  }
  return {files:output,manifest:next,moves,changed:Object.entries(output).filter(([p,t])=>files[p]!==t).map(([p])=>p)};
}

export function revisionLandingAssets(root,{write=false}={}) {
  const files={};
  function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){if(e.name.startsWith('.'))continue;const p=join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(?:html|mjs|js|json|py|xml|txt)$/.test(e.name)){const key=relative(root,p).split('\\').join('/');if(key!==MANIFEST)files[key]=readFileSync(p,'utf8');}}}
  walk(root);
  const manifestPath=join(root,MANIFEST);
  const previous=existsSync(manifestPath)?JSON.parse(readFileSync(manifestPath,'utf8')):{assets:{}};
  const plan=planAssetRevisions(files,previous);
  const manifestText=JSON.stringify(plan.manifest,null,2)+'\n';
  const manifestChanged=!existsSync(manifestPath)||readFileSync(manifestPath,'utf8')!==manifestText;
  if(write){
    // Exact source/target paths come from the inventory, never a broad delete.
    for(const move of plan.moves){if(existsSync(join(root,move.to)))throw new Error(`Refusing to overwrite ${move.to}`);renameSync(join(root,move.from),join(root,move.to));}
    for(const path of plan.changed)writeFileSync(join(root,path),plan.files[path]);
    if(manifestChanged)writeFileSync(manifestPath,manifestText);
  }
  return {ok:plan.changed.length===0&&!manifestChanged,changed:plan.changed,moves:plan.moves,manifestChanged};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const result=revisionLandingAssets(resolve('landing'),{write:process.argv.includes('--write')});
  console.log(JSON.stringify(result,null,2));
  if(!process.argv.includes('--write')&&!result.ok)process.exitCode=1;
}
