// Frozen BEFORE testing the discovery output. Publisher-verified, purposefully
// selected sentinels, not a random sample and not the whole relevant literature.
export const BENCHMARK={version:'essential-sentinel-20260910-v1',denominator:6,
  selection:'Five foundational workplace/labour/macro papers and one OECD evidence review, selected from primary institutional pages independently of this app corpus. Not a population recall estimate.',
  studies:[
    {id:'robots-jobs',title:'Robots and Jobs: Evidence from US Labor Markets',doi:'10.3386/w23285',source:'https://www.nber.org/papers/w23285',reason:'Displacement design, pre-generative-AI foundation'},
    {id:'ai-at-work',title:'Generative AI at Work',doi:'10.3386/w31161',source:'https://www.nber.org/papers/w31161',reason:'Workplace rollout and heterogeneous productivity effects'},
    {id:'jcurve',title:'The Productivity J-Curve: How Intangibles Complement General Purpose Technologies',doi:'10.3386/w25148',source:'https://www.nber.org/papers/w25148',reason:'Intangible capital and measurement mechanism'},
    {id:'productivity-paradox',title:'Artificial Intelligence and the Modern Productivity Paradox: A Clash of Expectations and Statistics',doi:'10.3386/w24001',source:'https://www.nber.org/papers/w24001',reason:'Competing explanations for aggregate productivity'},
    {id:'simple-macro',title:'The Simple Macroeconomics of AI',doi:'10.3386/w32487',source:'https://www.nber.org/papers/w32487',reason:'Task-to-macro aggregation and bounded scenarios'},
    {id:'oecd-labour-review',title:'The impact of Artificial Intelligence on the labour market',doi:'10.1787/7c895724-en',source:'https://www.oecd.org/en/publications/the-impact-of-artificial-intelligence-on-the-labour-market_7c895724-en.html',reason:'Institutional working paper outside the strict economics-journal filter'},
  ]};
const normalize=value=>String(value??'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function benchmarkRecall(candidates,benchmark=BENCHMARK) {
  if(benchmark.denominator!==benchmark.studies.length)throw new Error('Benchmark denominator changed');
  const results=benchmark.studies.map(study=>{
    const matched=candidates.filter(c=>normalize(c.doi?.replace(/^https?:\/\/doi.org\//,''))===normalize(study.doi)||normalize(c.title)===normalize(study.title));
    return {...study,found:matched.length>0,matching_ids:[...new Set(matched.map(c=>c.id))]};
  });
  const found=results.filter(r=>r.found).length;
  return {version:benchmark.version,denominator:benchmark.denominator,found,recall:found/benchmark.denominator,
    selection:benchmark.selection,matching:'Exact DOI or exact normalized title only; versions count once per sentinel. Misses remain in the denominator.',results};
}
