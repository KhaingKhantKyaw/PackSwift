/* Pure planning calculations: unknown costs are never assumed to be free. */
globalThis.PackSwiftPlanningModel=(()=>{
 const costKeys=['flights','stay','transfers','food','localTransport','activities','other'];
 function budget(raw={}){
  const missing=[],rows=[];let low=0,high=0;
  for(const key of costKeys){const value=raw[key];if(value==null||value===''||!Number.isFinite(Number(value))||Number(value)<0){missing.push(key);continue;}const amount=Number(value);rows.push({key,amount});low+=amount;}
  const reserve=Number(raw.reserve)||0;high=low+Math.max(0,reserve);
  return {low,high,rows,missing,complete:!missing.length,overLimit:Number(raw.maximum)>0&&high>Number(raw.maximum)};
 }
 function personality(p={}){
  return [p.dailyPace&&p.dailyPace+' pace',p.walking&&p.walking+' walks',p.transportation,...(p.interests||[]).slice(0,3)].filter(Boolean);
 }
 return {budget,personality,costKeys};
})();
