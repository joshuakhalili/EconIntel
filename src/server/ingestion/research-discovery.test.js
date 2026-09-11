import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openAlexBudget } from './openalex-budget.js';
import { questionDiscoveryPlan,studyVersions,discoverQuestion } from './research-discovery.js';
import { benchmarkRecall,BENCHMARK } from '../lib/research-benchmark.js';
import { allowedResearchSource,fetchSourceHash,sourceRefreshStatus } from '../lib/research-source-refresh.js';

const work={id:'https://openalex.org/W123',display_name:'AI effects',doi:'https://doi.org/10.1/test',
  authorships:[{institutions:[{country_code:'US'}]}],locations:[
    {landing_page_url:'https://www.nber.org/papers/example',version:'submittedVersion'},
    {landing_page_url:'https://publisher.example/paper',version:'publishedVersion'},
    {landing_page_url:'https://publisher.example/paper',version:'publishedVersion'},
  ],referenced_works:['https://openalex.org/W456']};
test('question-specific discovery does not inherit journal/abstract/title-veto exclusions',()=>{
  const plan=questionDiscoveryPlan({id:'power'});
  assert.match(plan.queries[0].search,/electricity/);
  assert.doesNotMatch(plan.queries[0].filter,/has_abstract|field|from_publication/);
  assert.match(plan.queries[1].filter,/locations.source.id/);
  assert.throws(()=>questionDiscoveryPlan({id:'unknown'}),/profile/);
});
test('versions deduplicate within provider family; affiliations never become study geography',()=>{
  const versions=studyVersions(work);
  assert.equal(versions.length,2);assert.equal(versions[0].family_id,versions[1].family_id);
  assert.deepEqual(versions[0].affiliation_countries,['US']);assert.equal(versions[0].metadata.geography_studied,null);
  assert.notEqual(studyVersions({...work,id:'https://openalex.org/W789'})[0].family_id,versions[0].family_id);
  assert.deepEqual(studyVersions({...work,is_retracted:true}),[]);
});
test('query, institutional, references and citing discovery persist resumable pages',async()=>{
  const routes=[],urls=[];let saved;
  const result=await discoverQuestion({plan:questionDiscoveryPlan({id:'productivity'}),
    request:async url=>{urls.push(url);return {results:[work],meta:{next_cursor:'next'}};},
    savePage:async(versions,route,state)=>{routes.push(route);saved=state;assert.equal(versions.length,2);}});
  assert.deepEqual(routes,['question','institutional-working-papers','references','cited-by']);
  assert.equal(result.complete,false);assert.equal(saved.cursors.question,'next');
  assert.match(decodeURIComponent(urls[2]),/openalex:W456/);assert.match(decodeURIComponent(urls[3]),/cites:W123/);
  await assert.rejects(discoverQuestion({plan:questionDiscoveryPlan({id:'jobs'}),request:async()=>({results:[work]}),savePage:async()=>{throw new Error('commit failed');}}),/commit failed/);
});
test('actual request attempts and reported provider costs are counted, unknowns not zero',async()=>{
  let calls=0;
  const budget=openAlexBudget({maxRequests:2,apiKey:'not-a-real-key',transport:async(url,init)=>{
    calls++;assert.equal(init.headers.Authorization,'Bearer not-a-real-key');assert.ok(!url.includes('not-a-real-key'));
    return new Response(JSON.stringify({meta:{cost_usd:0.001},results:[]}),{headers:{'x-ratelimit-credits-used':'10','x-ratelimit-remaining':'90'}});
  }});
  await budget.request('https://api.openalex.org/works');await budget.request('https://api.openalex.org/works');
  await assert.rejects(budget.request('https://api.openalex.org/works'),/cap reached/);
  assert.equal(calls,2);assert.equal(budget.usage.attempts,2);assert.equal(budget.usage.credits_used,20);assert.equal(budget.usage.cost_usd,0.002);
  const missing=openAlexBudget({maxRequests:1,transport:async()=>new Response('{"results":[]}')});
  await missing.request('https://api.openalex.org/works');assert.equal(missing.usage.cost_unreported,1);assert.equal(missing.usage.remaining,null);
});
test('failed HTTP attempts count before retry succeeds',async()=>{
  let calls=0;
  const budget=openAlexBudget({maxRequests:2,transport:async()=>new Response(JSON.stringify({meta:{cost_usd:0.001},results:[]}),{status:++calls===1?429:200,headers:{'retry-after':'0'}})});
  await budget.request('https://api.openalex.org/works',{wait:async()=>{}});
  assert.equal(budget.usage.attempts,2);assert.equal(budget.usage.cost_usd,0.002);
});
test('shared batch usage sink persists physical attempts before transport and preserves throttle reason',async()=>{
  const snapshots=[];
  const budget=openAlexBudget({maxRequests:1,transport:async()=>{
    assert.equal(snapshots.at(-1).attempts,1);assert.equal(snapshots.at(-1).responses,0);
    return new Response(JSON.stringify({error:'Rate limit exceeded',message:'Anonymous search is temporarily rate-limited'}),{status:429,headers:{'retry-after':'12'}});
  }});
  budget.setUsageSink(async usage=>snapshots.push(usage));
  await assert.rejects(budget.request('https://api.openalex.org/works',{retries:0}));
  assert.equal(snapshots.at(-1).last_error.retry_after,'12');
  assert.match(snapshots.at(-1).last_error.message,/Anonymous search/);
  budget.setUsageSink(null);
});
test('recall denominator is frozen; duplicate versions never inflate hits',()=>{
  const study=BENCHMARK.studies[0];
  const result=benchmarkRecall([{id:'one',title:study.title},{id:'two',doi:`https://doi.org/${study.doi}`}]);
  assert.equal(result.denominator,6);assert.equal(result.found,1);assert.equal(result.results.filter(r=>!r.found).length,5);
  assert.throws(()=>benchmarkRecall([],{...BENCHMARK,denominator:5}),/denominator/);
});
test('source refresh checks redirects, byte ceilings, hashes and absent baselines',async()=>{
  assert.throws(()=>allowedResearchSource('http://www.nber.org/x'),/approved/);
  assert.throws(()=>allowedResearchSource('https://127.0.0.1/x'),/approved/);
  await assert.rejects(fetchSourceHash('https://www.nber.org/x',{request:async()=>new Response(null,{status:302,headers:{location:'http://169.254.169.254/secret'}})}),/approved/);
  const options={request:async()=>new Response('public content',{headers:{'content-type':'text/plain'}})};
  const result=await fetchSourceHash('https://www.nber.org/x',options);
  assert.equal(result.hash.length,64);assert.equal(sourceRefreshStatus(null,result.hash),'baseline');
  assert.equal(sourceRefreshStatus(result.hash,result.hash),'unchanged');assert.equal(sourceRefreshStatus('old',result.hash),'changed');
  assert.equal(sourceRefreshStatus(result.hash,null),'inaccessible');
  await assert.rejects(fetchSourceHash('https://www.nber.org/x',{...options,maxBytes:2}),/byte limit/);
});
