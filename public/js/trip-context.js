/* Shared, pure trip computations. ISO dates stay in storage and API payloads. */
globalThis.PackSwiftTripContext=(()=>{
 function routeContext(input){
  const local=input.tripType==='local'||input.tripScope==='local';
  const origin=local?(input.origin||input.localTripCity||input.destination):input.origin;
  const destination=local?origin:input.destination;
  const from=globalThis.PackSwiftCurrency.resolve(origin),to=globalThis.PackSwiftCurrency.resolve(destination);
  const routeType=local?'domestic':from.countryCode&&to.countryCode?(from.countryCode===to.countryCode?'domestic':'international'):'unknown';
  return {origin,destination,tripType:local?'local':'anywhere',tripScope:local?'local':'anywhere',routeType,isInternational:routeType==='unknown'?null:routeType==='international',originCountryCode:from.countryCode,destinationCountryCode:to.countryCode};
 }
 const displayDate=value=>{const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(value||''));return match?`${match[3]}/${match[2]}/${match[1].slice(2)}`:'Choose dates';};
 function entryStatus(context,rule){
  if(context.tripType==='local')return {status:'LOCAL',message:'International entry requirements are not required for this local trip.'};
  if(context.routeType==='domestic')return {status:'DOMESTIC',message:'Domestic route — check carrier identification requirements. No international border crossing is planned.'};
  const unknown={status:'VERIFICATION_REQUIRED',message:'Entry requirements can change. Verify with the official immigration authority or embassy before traveling.'};
  if(!rule||rule.verificationStatus!=='verified'||!/^https:\/\//.test(rule.sourceUrl||'')||!Number.isFinite(Date.parse(rule.lastUpdated))||!Number.isFinite(Date.parse(rule.validUntil))||Date.parse(rule.validUntil)<Date.now()||rule.passport_country!==context.passportCountry||rule.destination_country!==context.destinationCountry||rule.conditions?.entry_mode!==context.entryMode||!Number.isInteger(context.days)||context.days<1)return unknown;
  if(rule.visa_type==='visa_free'&&(!Number.isInteger(rule.max_stay_days)||rule.max_stay_days<1))return unknown;
  if(rule.visa_type==='visa_free')return {status:context.days>rule.max_stay_days?'OVERSTAY_RISK':'VISA_FREE',message:context.days>rule.max_stay_days?`Planned stay exceeds the ${rule.max_stay_days}-day allowance in this rule.`:`Visa-free rule allows up to ${rule.max_stay_days} days, subject to all listed conditions.`,rule};
  if(!['evisa','voa','visa_required'].includes(rule.visa_type))return unknown;
  return {status:rule.visa_type.toUpperCase(),message:'Review the official entry conditions before travel.',rule};
 }
 function budgetSummary(input,review){
  const local=input.tripType==='local',currency=input.currency,total=Math.max(0,Number(input.budget)||0);
  const usable=review?.budget?.currency===currency;
  const categories=usable?review.budget.categories:[];
  const stay=categories.find(c=>c.label==='Accommodation')||null;
  // No flight source currently exists. Unknown is not zero for worldwide trips.
  const flight=local?0:null,base=stay?stay.minimum+(flight||0):null;
  const remaining=base===null?null:Math.max(0,total-base);
  const essentials=categories.filter(c=>c.label!=='Accommodation');
  const minimum=usable?review.budget.total.minimum:null;
  let available=remaining||0;
  const emergency=Math.min(available,Math.round(total*(input.planningGoal==='make-possible'?.12:.08)));
  if(input.planningGoal==='make-possible')available-=emergency;
  const spending=essentials.map(c=>{const amount=Math.min(available,c.minimum);available-=amount;return {label:c.label,amount,benchmark:c.minimum};});
  const fundedEmergency=input.planningGoal==='make-possible'?emergency:Math.min(available,emergency);
  if(input.planningGoal!=='make-possible')available-=fundedEmergency;
  if(usable)spending.push({label:'Emergency buffer',amount:fundedEmergency},{label:'Optional shopping / unassigned',amount:Math.max(0,available)});
  return {currency,total,flight,stay,base,remaining,spending,minimum,recommended:usable?review.budget.total.maximum:null,shortfall:minimum===null?null:Math.max(0,minimum-total),complete:local&&Boolean(stay),source:usable?'Internal ground-cost benchmarks · estimated':'No comparable destination cost data'};
 }
 return {displayDate,entryStatus,budgetSummary,routeContext};
})();
