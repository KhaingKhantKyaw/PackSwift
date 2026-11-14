import '../../public/js/itinerary-plan-model.js';
const read=value=>{try{return JSON.parse(value||'{}');}catch{return {};}};
function setField(preferences,name,value){
 preferences.detailPlanning||={fields:[]};preferences.detailPlanning.fields||=[];
 let field=preferences.detailPlanning.fields.find(f=>f.name===name);if(!field){field={name,type:'hidden'};preferences.detailPlanning.fields.push(field);}field.value=value;
}
export function updateTripCosts(preferences,details,costs){
 for(const key of ['flights','stay','daily'])if(costs[key]!==null&&(typeof costs[key]!=='number'||!Number.isFinite(costs[key])||costs[key]<0||costs[key]>1e9))throw new RangeError('Use a valid cost or leave it blank.');
 const complete=['flights','stay','daily'].every(k=>costs[k]!==null),total=complete?Math.round((costs.flights+costs.stay+costs.daily*(details.nights+1))*100)/100:null;
 if(total!==null&&total>9999999999.99)throw new RangeError('Budget exceeds the supported amount.');
 const fields=preferences.detailPlanning?.fields||[],values=Object.fromEntries(fields.map(f=>[f.name,f.value]));
 for(const [name,value]of Object.entries({origin:details.origin,destination:details.destination,startDate:details.start,endDate:details.end,adults:String(details.adults),children:String(details.children||0),currency:details.currency}))if(values[name]===undefined){setField(preferences,name,value);values[name]=value;}
 const support=read(values.planningSupport);support.costs=Object.fromEntries(['flights','stay','daily'].map(k=>[k,costs[k]]));support.costCurrency=details.currency;support.costContext=['origin','destination','startDate','endDate','adults','children','childAges'].map(k=>values[k]||'').join('|');
 setField(preferences,'planningSupport',JSON.stringify(support));setField(preferences,'budget',total===null?'':String(total));preferences.budgetStatus=complete?'estimated':'unfinished';
 return total;
}
export function editTripStop(preferences,details,change){
 const field=preferences.detailPlanning?.fields?.find(f=>f.name==='itineraryPlan'),model=globalThis.PackSwiftItineraryPlanModel,plan=model.normalize(field?.value);
 if(!plan)throw new RangeError('No editable itinerary is saved.');
 if(plan.startDate!==details.start||plan.endDate!==details.end||plan.destination.toLowerCase()!==details.destination.toLowerCase())throw new RangeError('Trip details changed. Review the itinerary in advanced planning first.');
 let edited=model.edit(plan,change);
 if(change.type==='update'&&change.day!==undefined){const day=plan.days.find(d=>d.stops.some(s=>s.id===change.id));if(Number(change.day)!==day?.day)edited=model.edit(edited,{type:'move',id:change.id,day:Number(change.day)});}
 const serialized=JSON.stringify(edited);if(serialized.length>175000)throw new RangeError('This itinerary is too large. Remove older notes or stops before adding more.');field.value=serialized;return edited;
}
