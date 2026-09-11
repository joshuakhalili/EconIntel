import { createHash } from 'node:crypto';

// Only known primary publisher hosts. Redirects are checked one hop at a time;
// a DOI or arbitrary candidate URL is not permission to fetch an internal URL.
export const RESEARCH_SOURCE_HOSTS=new Set([
  'www.nber.org','economics.mit.edu','ide.mit.edu','arxiv.org','www.bls.gov','www.bea.gov','www.sec.gov',
  'www.iea.org','ec.europa.eu','www.federalregister.gov','www.archives.gov','epoch.ai',
  'www.oecd.org','www.imf.org','www.bis.org','hai.stanford.edu','digitaleconomy.stanford.edu',
  'www.microsoft.com','www.census.gov','www.pwc.com','www.weforum.org','www.mckinsey.com','metr.org',
]);
export function allowedResearchSource(value) {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port||!RESEARCH_SOURCE_HOSTS.has(url.hostname))throw new Error('Source host is not approved for automated refresh');
  return url.href;
}
export async function fetchSourceHash(sourceUrl,{request=fetch,maxBytes=8*1024*1024,timeoutMs=20000}={}) {
  let url=allowedResearchSource(sourceUrl);
  const signal=AbortSignal.timeout(timeoutMs);
  for(let redirects=0;redirects<=3;redirects++) {
    const response=await request(url,{redirect:'manual',signal,headers:{'User-Agent':'Diffusion source-verification (bounded public document hash check)'}});
    if(response.status>=300&&response.status<400) {
      await response.body?.cancel();
      url=allowedResearchSource(new URL(response.headers.get('location'),url).href);continue;
    }
    if(!response.ok){await response.body?.cancel();throw new Error(`Source returned HTTP ${response.status}`);}
    const contentType=response.headers.get('content-type')??'';
    if(!/^(application\/(pdf|json|xml)|text\/(html|plain|xml))/i.test(contentType)){await response.body?.cancel();throw new Error('Unsupported source content type');}
    if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel();throw new Error('Source exceeds byte limit');}
    const hash=createHash('sha256');let bytes=0;
    for await(const chunk of response.body) {
      bytes+=chunk.byteLength;if(bytes>maxBytes)throw new Error('Source exceeds byte limit');hash.update(chunk);
    }
    if(!bytes)throw new Error('Source is empty');
    return {hash:hash.digest('hex'),bytes,contentType,finalUrl:url};
  }
  throw new Error('Too many source redirects');
}
export function sourceRefreshStatus(baseline,observed) {
  if(!observed)return 'inaccessible';
  return !baseline?'baseline':baseline===observed?'unchanged':'changed';
}
