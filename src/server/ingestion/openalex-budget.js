import { fetchJson, HttpError } from '../lib/http.js';
import { config } from '../config.js';

const numeric = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

/** Count physical attempts (including retries), not just successful pages.
 * Provider credits and USD are separate units. Missing telemetry is unknown,
 * never zero. USD is an observed-cost stop, not a guaranteed prepay ceiling.
 */
export function openAlexBudget({ maxRequests=12, maxCostUsd=0.05, apiKey=config.keys.openalex,
  transport=fetch, onUsage=async()=>{}, json=fetchJson }={}) {
  if (!Number.isInteger(maxRequests) || maxRequests<1 || maxRequests>500) throw new Error('OpenAlex request cap must be 1–500');
  if (!Number.isFinite(maxCostUsd) || maxCostUsd<=0 || maxCostUsd>1) throw new Error('OpenAlex observed USD cap must be >0 and <=1');
  const usage={ attempts:0,responses:0,credits_used:0,credits_unreported:0,cost_usd:0,cost_unreported:0,
    remaining:null,limit:null,reset_seconds:null,max_requests:maxRequests,max_cost_usd:maxCostUsd };
  let usageSink=null;
  const persist=async()=>{await onUsage({...usage});if(usageSink)await usageSink({...usage});};
  const request = async(url,options={}) => {
    const parsed=new URL(url);
    if(parsed.origin!=='https://api.openalex.org' || parsed.searchParams.has('api_key')) throw new Error('Only header-authenticated OpenAlex requests allowed');
    return json(url,{...options,headers:{...options.headers,...(apiKey?{Authorization:`Bearer ${apiKey}`}:{})},
      request:async(target,init)=>{
        if(usage.attempts>=maxRequests || usage.cost_usd>=maxCostUsd || usage.remaining===0) {
          throw new HttpError('OpenAlex observed provider budget/request cap reached',{url});
        }
        usage.attempts++;
        // Persist the attempt before sending; a crash must not erase it.
        await persist();
        let response;
        try { response=await transport(target,init); }
        catch(error) { usage.cost_unreported++;usage.credits_unreported++;await persist();throw error; }
        usage.responses++;
        const credits=numeric(response.headers.get('x-ratelimit-credits-used'));
        if(credits===null) usage.credits_unreported++; else usage.credits_used+=credits;
        for(const [field,header] of [['remaining','remaining'],['limit','limit'],['reset_seconds','reset']]) {
          usage[field]=numeric(response.headers.get(`x-ratelimit-${header}`));
        }
        const meta=await response.clone().json().catch(()=>null);
        if(!response.ok)usage.last_error={status:response.status,retry_after:response.headers.get('retry-after'),message:[meta?.error,meta?.message].filter(Boolean).map(String).join(': ').slice(0,500)||'Provider did not supply a JSON reason'};
        const cost=numeric(meta?.meta?.cost_usd);
        if(cost===null) usage.cost_unreported++; else usage.cost_usd+=cost;
        await persist();
        return response;
      }});
  };
  return {request,usage,setUsageSink:sink=>{usageSink=sink;}};
}
