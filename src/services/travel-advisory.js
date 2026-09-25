import {readFile} from 'node:fs/promises';
const catalog=JSON.parse(await readFile(new URL('../../public/data/destinations.json',import.meta.url),'utf8'));
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const cache=new Map(),pending=new Map();
async function official(path){
  const cached=cache.get(path);if(cached&&Date.now()-cached.time<3600000)return cached;
  if(pending.has(path))return pending.get(path);
  const task=(async()=>{const response=await fetch(`https://www.gov.uk/api/content${path}`,{signal:AbortSignal.timeout(7000)});if(!response.ok)throw Error('Advisory unavailable');const result={data:await response.json(),time:Date.now()};cache.set(path,result);return result;})();
  pending.set(path,task);try{return await task;}finally{pending.delete(path);}
}
export function classifyAdvisory(status){
  if(!Array.isArray(status))return {severity:'unknown',title:'Advisory status unavailable'};
  if(status.includes('avoid_all_travel'))return {severity:'critical',title:'Do not travel',message:'FCDO advises against all travel to this destination.'};
  if(status.includes('avoid_all_travel_to_parts'))return {severity:'high',title:'Do not travel to affected regions',message:'FCDO advises against all travel to parts of this country. This is a regional warning, not a determination for your exact city or route.'};
  if(status.includes('avoid_all_but_essential_travel'))return {severity:'high',title:'Avoid non-essential travel',message:'FCDO advises against all but essential travel to this destination.'};
  if(status.includes('avoid_all_but_essential_travel_to_parts'))return {severity:'caution',title:'Regional essential-travel restrictions',message:'FCDO advises against all but essential travel to parts of this country. Check your entire route against the affected regions.'};
  if(status.length)return {severity:'unknown',title:'Read the current advisory',message:'The source includes an advisory status PackSwift cannot classify. Review the official guidance.'};
  return {severity:'information',title:'Review local travel risks',message:'No avoid-travel flag was supplied by this source. This does not mean the destination is safe; check crime, health, weather and regional guidance.'};
}
export async function getTravelAdvisory(destination){
  const fallback={severity:'unknown',title:'Travel safety not verified',message:'PackSwift could not verify this destination’s current advisory. Check official guidance before booking.',source:'UK FCDO',url:'https://www.gov.uk/foreign-travel-advice',checkedAt:null};
  try{
    const query=normalize(destination);const city=catalog.find(c=>[c.name,c.slug,c.code,`${c.name}, ${c.country}`].some(value=>normalize(value)===query));
    const aliases={burma:'myanmar',ygn:'myanmar',rgn:'myanmar',mandalay:'myanmar',naypyitaw:'myanmar',taipei:'taiwan',usa:'usa',uae:'united-arab-emirates'};
    const country=normalize(city?.country||aliases[query]||query.split(',').at(-1));
    const {data:index}=await official('/foreign-travel-advice');
    const entry=index.links?.children?.find(item=>{const c=item.details?.country;return c&&[c.name,c.slug,...(c.synonyms||[])].some(value=>normalize(value)===country);});
    if(!entry||!/^\/foreign-travel-advice\/[a-z-]+$/.test(entry.base_path))return fallback;
    const result=await official(entry.base_path);const data=result.data;
    return {...classifyAdvisory(data.details?.alert_status),country:entry.details.country.name,source:'UK FCDO',url:`https://www.gov.uk${entry.base_path}`,checkedAt:new Date(result.time).toISOString(),sourceUpdatedAt:data.public_updated_at||null,
      regionalNotice:(data.details?.alert_status||[]).some(s=>s.endsWith('_to_parts'))?'Country-level alert: consult the official regional map before deciding about this city.':null,
      disclaimer:'FCDO advice is written for British nationals. Also consult your own government. Conditions can change; this is not a safety guarantee.'};
  }catch{return fallback;}
}
