/** Import order must reflect check time, not staging sequence allocation. */
export function orderSourceRefreshes(events){
  if(events.some(f=>!Number.isFinite(new Date(f.checked_at).getTime())||!/^\d+$/.test(String(f.id))))throw new Error('Invalid source-event ordering identity');
  return [...events].sort((a,b)=>new Date(a.checked_at)-new Date(b.checked_at)||(BigInt(a.id)<BigInt(b.id)?-1:BigInt(a.id)>BigInt(b.id)?1:0));
}
