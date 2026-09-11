import { createHash } from 'node:crypto';
import { WORKING_PAPER_SOURCES } from './sources/openalex.js';

export const DISCOVERY_VERSION='question-discovery-v2-20260911';
export const DISCOVERY_FIELDS='id,doi,display_name,publication_date,type,authorships,locations,referenced_works,is_retracted';
const topics={
  adoption:'artificial intelligence firm adoption diffusion', money:'artificial intelligence investment intangible capital',
  building:'artificial intelligence data centers infrastructure investment',productivity:'artificial intelligence productivity',
  jobs:'artificial intelligence automation employment', 'entry-level':'generative artificial intelligence young workers employment',
  vacancies:'artificial intelligence job vacancies skills',power:'artificial intelligence data centers electricity demand',
  materials:'artificial intelligence semiconductor supply chain',markets:'artificial intelligence compute prices competition',
  policy:'artificial intelligence regulation economic effects','dot-com':'information technology investment productivity bubble',
  'sector-output':'artificial intelligence sector output productivity','exposed-productivity':'artificial intelligence exposure productivity',
  clerical:'automation clerical employment','total-factor-productivity':'artificial intelligence total factor productivity',
  'computer-dividend':'information technology capital services productivity','china-mirror':'China artificial intelligence adoption productivity',
  'orders-and-output':'semiconductor orders production investment','frontier-compute':'artificial intelligence scaling compute cost',
  'chip-prices':'semiconductor hedonic price index','bulk-discount':'electricity industrial prices volume discount',
  'aggregate-unemployment':'artificial intelligence unemployment aggregate employment','executive-action':'artificial intelligence executive order regulation',
  'rule-conversion':'regulation proposed final rules policy process','policy-lag':'regulation implementation lag artificial intelligence',
  'who-funds-it':'artificial intelligence investment financing venture capital','expectations':'artificial intelligence expectations investment uncertainty',
  'diffusion-speed':'artificial intelligence diffusion technology adoption','the-buildings':'data center construction investment',
  'software-not-steel':'software intangible capital investment','is-europe-in-this':'Europe artificial intelligence investment adoption',
  'sector-jobs':'artificial intelligence industry employment','skills-shortage':'artificial intelligence skills shortage vacancies',
  'ai-wages':'artificial intelligence wages productivity','compute-price-abroad':'cloud computing international prices',
  'labour-vs-compute':'artificial intelligence labor substitution cost','when-noticed':'artificial intelligence news economic expectations',
  'rules-vs-adoption':'artificial intelligence regulation firm adoption','cost-of-compliance':'artificial intelligence regulatory compliance costs',
};
export function questionDiscoveryPlan(question) {
  if(!topics[question.id]) throw new Error(`No reviewed search profile for question ${question.id}`);
  const search=topics[question.id].replace('artificial intelligence','("artificial intelligence" OR "generative AI")');
  const mechanism=/productivity|capital|investment/.test(search)?'technology intangible capital productivity'
    :/employment|workers|wages|vacancies|skills/.test(search)?'automation labor tasks employment'
    :/adoption|diffusion/.test(search)?'technology adoption diffusion firms'
    :topics[question.id].replace('artificial intelligence','technology');
  return {version:DISCOVERY_VERSION,question_id:question.id,queries:[
    {id:'question',search,filter:'is_retracted:false'},
    {id:'institutional-working-papers',search:mechanism,filter:`is_retracted:false,locations.source.id:${WORKING_PAPER_SOURCES.map(s=>s.id).join('|')}`},
  ],citation_depth:1,reference_cap:20,citing_cap:20,
  note:'Candidate discovery, not evidence approval. No field, title-veto, abstract-access or year exclusion.'};
}
export const httpsUrl = value => {try { const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null; } catch{return null;}};
const hash = value=>createHash('sha256').update(value).digest('hex');
export function studyVersions(work) {
  if(!/^https:\/\/openalex.org\/W\d+$/.test(work?.id??'') || !work.display_name || work.is_retracted) return [];
  const familyId=work.id.replace('https://openalex.org/','openalex:');
  // Multiple repository/publisher copies and versions in ONE OpenAlex work
  // share a family. Different work IDs never merge on fuzzy titles alone.
  const affiliations=[...new Set((work.authorships??[]).flatMap(a=>(a.institutions??[]).map(i=>i.country_code)).filter(c=>/^[A-Z]{2}$/.test(c??'')))].sort();
  const locations=work.locations?.length?work.locations:[{landing_page_url:work.doi??work.id,version:'unknown'}];
  const seen=new Set();
  return locations.flatMap(location=>{
    const url=httpsUrl(location.landing_page_url)||httpsUrl(location.pdf_url);
    if(!url)return [];
    const version=location.version??'unknown';
    const id=`${familyId}:${hash(`${url}|${version}`).slice(0,24)}`;
    if(seen.has(id))return [];seen.add(id);
    return [{id,family_id:familyId,provider_work_id:work.id,title:work.display_name,
      doi:work.doi?.toLowerCase()??null,source_url:url,version_label:version,
      publication_date:work.publication_date??null,affiliation_countries:affiliations,
      metadata:{type:work.type,source_name:location.source?.display_name??null,
        source_id:location.source?.id??null,referenced_works:(work.referenced_works??[]).filter(id=>/^https:\/\/openalex.org\/W\d+$/.test(id)),
        geography_studied:null,geography_note:'Author affiliation is not study population geography.'}}];
  });
}
export function discoveryUrl(params) {
  return `https://api.openalex.org/works?${new URLSearchParams({select:DISCOVERY_FIELDS,per_page:'20',...params})}`;
}

/** Every saved cursor follows committed candidates. One-hop citation chaining
 * is separate from query retrieval and never receives a relevance endorsement.
 */
export async function discoverQuestion({plan,checkpoint={},request,savePage,maxPages=1,maxStages=4}) {
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>5)throw new Error('Discovery maxPages must be 1–5');
  const state=structuredClone(checkpoint);
  state.cursors??={};state.references??=[];state.seeds??=[];
  if(!Number.isInteger(maxStages)||maxStages<1||maxStages>4)throw new Error('Discovery maxStages must be 1–4');
  let kept=0;state.next_task??=0;state.reference_offset??=0;state.citing_count??=0;
  // Round-robin phases persist before moving on. A failed citation lookup is
  // resumed first, not starved by another page of the broad search.
  const tasks=[...plan.queries,{id:'references'},{id:'cited-by'}];
  for(let step=0;step<maxStages;step++) {
    const task=tasks[state.next_task];let params=null;
    if(task.search && state.cursors[task.id]!==null)params={search:task.search,filter:task.filter,cursor:state.cursors[task.id]??'*'};
    if(task.id==='references') {
      const id=state.references[state.reference_offset];
      if(id)params={filter:`openalex:${id.split('/').at(-1)},is_retracted:false`,per_page:'1'};
    }
    if(task.id==='cited-by' && state.seeds.length && state.citing_count<plan.citing_cap && state.cursors[task.id]!==null) {
      params={filter:`cites:${state.seeds[0].split('/').at(-1)},is_retracted:false`,per_page:'1',cursor:state.cursors[task.id]??'*'};
    }
    let versions=[];
    if(params) {
      const data=await request(discoveryUrl(params),{retries:0,timeoutMs:15000,totalBudgetMs:20000});
      if(!Array.isArray(data?.results))throw new Error('Invalid OpenAlex results envelope');
      versions=data.results.flatMap(studyVersions);kept+=versions.length;
      if(task.search) {
        state.references=[...new Set([...state.references,...versions.flatMap(v=>v.metadata.referenced_works)])].slice(0,plan.reference_cap);
        state.seeds=[...new Set([...state.seeds,...data.results.map(w=>w.id).filter(id=>/^https:\/\/openalex.org\/W\d+$/.test(id??''))])].slice(0,2);
        state.cursors[task.id]=data.results.length?data.meta?.next_cursor??null:null;
      }else if(task.id==='references')state.reference_offset++;
      else {state.citing_count+=data.results.length;state.cursors[task.id]=data.results.length?data.meta?.next_cursor??null:null;}
    }
    state.next_task=(state.next_task+1)%tasks.length;
    await savePage(versions,task.id,structuredClone(state));
  }
  return {kept,checkpoint:state,complete:plan.queries.every(q=>state.cursors[q.id]===null) && state.reference_offset>=state.references.length && (!state.seeds.length||state.citing_count>=plan.citing_cap||state.cursors['cited-by']===null),
    chain_limit:'One hop, one reference and one citing work per rotation, up to 20 each; not exhaustive'};
}
