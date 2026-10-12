/* Shared, pure trip computations. ISO dates stay in storage and API payloads. */
globalThis.PackSwiftTripContext=(()=>{
 function routeContext(input){
  const local=input.tripType==='local'||input.tripScope==='local';
  const origin=local?(input.origin||input.localTripCity||input.destination):input.origin;
  const destination=local?origin:input.destination;
  const from=globalThis.PackSwiftCurrency.resolve(origin),to=globalThis.PackSwiftCurrency.resolve(destination);
  const routeType=from.countryCode&&to.countryCode?(from.countryCode===to.countryCode?'domestic':'international'):'unknown';
  return {origin,destination,tripType:local?'local':'anywhere',tripScope:local?'local':'anywhere',routeType,isInternational:routeType==='unknown'?null:routeType==='international',originCountryCode:from.countryCode,destinationCountryCode:to.countryCode};
 }
 const displayDate=value=>{const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(value||''));return match?`${match[3]}/${match[2]}/${match[1].slice(2)}`:'Choose dates';};
 function entryStatus(context,rule){
  if(context.routeType==='domestic')return {status:'DOMESTIC',message:'Domestic route — check carrier identification requirements. No international border crossing is planned.'};
  const unknown={status:'VERIFICATION_REQUIRED',message:'Entry requirements can change. Verify with the official immigration authority or embassy before traveling.'};
  if(!rule||rule.verificationStatus!=='verified'||!/^https:\/\//.test(rule.sourceUrl||'')||!Number.isFinite(Date.parse(rule.lastUpdated))||!Number.isFinite(Date.parse(rule.validUntil))||Date.parse(rule.validUntil)<Date.now()||rule.passport_country!==context.passportCountry||rule.destination_country!==context.destinationCountry||rule.conditions?.entry_mode!==context.entryMode||!Number.isInteger(context.days)||context.days<1)return unknown;
  if(rule.visa_type==='visa_free'&&(!Number.isInteger(rule.max_stay_days)||rule.max_stay_days<1))return unknown;
  if(rule.visa_type==='visa_free')return {status:context.days>rule.max_stay_days?'OVERSTAY_RISK':'VISA_FREE',message:context.days>rule.max_stay_days?`Planned stay exceeds the ${rule.max_stay_days}-day allowance in this rule.`:`Visa-free rule allows up to ${rule.max_stay_days} days, subject to all listed conditions.`,rule};
  if(!['evisa','voa','visa_required'].includes(rule.visa_type))return unknown;
  return {status:rule.visa_type.toUpperCase(),message:'Review the official entry conditions before travel.',rule};
 }
 function budgetSummary(input,review){
  const currency=input.currency||'USD',total=Math.max(0,Number(input.budget)||0),usable=review?.budget?.currency===currency;
  const benchmark=label=>usable?review.budget.categories.find(c=>c.label===label):null;
  const specifications=[['Transport','Intercity transport',null],['Stay','Accommodation',null],['Food','Food','Food'],['Activities','Activities',null],['LocalTransport','Local transportation','Local transport'],['Shopping','Shopping',null]];
  const categories=specifications.map(([key,label,estimateLabel])=>{
   const raw=input['cost'+key],manual=raw!==undefined&&raw!==null&&String(raw).trim()!==''&&Number.isFinite(Number(raw))&&Number(raw)>=0&&input.costCurrency===currency;
   const estimate=estimateLabel&&benchmark(estimateLabel);
   if(manual)return {key,label,currency,amount:Number(raw),minimum:Number(raw),maximum:Number(raw),status:'USER_ENTERED',source:'Your entered cost — not a provider quote'};
   if(estimate)return {key,label,currency,amount:null,minimum:estimate.minimum,maximum:estimate.maximum,status:'ESTIMATED',source:review.budget.source||'Internal destination benchmark'};
   return {key,label,currency,amount:null,minimum:null,maximum:null,status:'UNKNOWN',source:key==='Transport'?'Quote required':key==='Stay'?'Not estimated':'Price not supplied'};
  });
  const known=categories.filter(c=>c.minimum!==null),minimum=known.length?known.reduce((n,c)=>n+c.minimum,0):null,maximum=known.length?known.reduce((n,c)=>n+c.maximum,0):null;
  const reserve=Math.round(total*(input.planningGoal==='make-possible'?.12:.08));
  const allocation={key:'Emergency',label:'Emergency buffer',currency,amount:reserve,status:'ALLOCATED',source:'Suggested reserve, not an expense'};
  const unknown=categories.filter(c=>c.status==='UNKNOWN');
  return {currency,total,budgetStatus:'USER_ENTERED',categories,allocation,minimum,maximum,complete:unknown.length===0,unknown,remaining:minimum===null?null:total-minimum-reserve,shortfall:minimum===null?null:Math.max(0,minimum+reserve-total),source:'Partial costs exclude unknown prices. An allowance is not an actual expense.'};
 }
 return {displayDate,entryStatus,budgetSummary,routeContext};
})();
