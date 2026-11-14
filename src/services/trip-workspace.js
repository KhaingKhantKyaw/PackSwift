import {destinationCurrency} from './destination-currency.js';
export const requirementKeys = ['passport','entry','arrival','onward','accommodation','insurance'];

export function tripCostBreakdown(trip) {
  const fields=Object.fromEntries((trip.preferences?.detailPlanning?.fields||[]).map(f=>[f.name,f.value]));
  let support;try{support=JSON.parse(fields.planningSupport||'{}');}catch{return null;}
  const context=['origin','destination','startDate','endDate','adults','children','childAges'].map(n=>fields[n]||'').join('|');
  if(support.costCurrency!==fields.currency||support.costContext!==context)return null;
  const costs={};
  for(const key of ['flights','stay','daily']){
    const value=support.costs?.[key];
    costs[key]=value==null||value===''||!Number.isFinite(Number(value))||Number(value)<0?null:Number(value);
  }
  return costs;
}

// The captured form is the user's exact input; older trips fall back to stored columns.
export function tripDetails(trip) {
  const fields = {};
  for (const f of trip.preferences?.detailPlanning?.fields || []) {
    if (f.type !== 'checkbox' && f.type !== 'radio') fields[f.name] = f.value;
    else if (f.checked) fields[f.name] = f.value;
  }
  const start = String(fields.startDate || trip.dates.start || '').slice(0,10);
  const end = String(fields.endDate || trip.dates.end || '').slice(0,10);
  return {tripType:fields.tripType||trip.preferences?.tripType||'worldwide',origin:(fields.tripType||trip.preferences?.tripType)==='local'?(fields.destination||trip.destination.name):fields.origin || trip.route.origin.name, destination:fields.destination || trip.destination.name,
    country:fields.destination ? destinationCurrency(fields.destination).country || '' : trip.destination.countryName, nationality:fields.passportCountry || '', start,end,
    nights:Math.max(0,Math.round((Date.parse(end)-Date.parse(start))/86400000)||0),
    adults:Number(fields.adults ?? trip.travelerBreakdown.adults), children:Number(fields.children ?? trip.travelerBreakdown.children),
    budget:trip.preferences?.budgetStatus==='unfinished'||(fields.budget??trip.budget.amount)==null||(fields.budget??trip.budget.amount)===''?null:Number(fields.budget??trip.budget.amount), currency:fields.currency || trip.budget.currency,
    budgetBreakdown:tripCostBreakdown(trip),
    style:fields.accommodationStyle || trip.preferences.accommodationStyle || 'comfortable',
    purpose:fields.tripPurpose || trip.tripPurpose, notes:fields.notes || ''};
}

export function workspaceProgress(trip, workspace, packing) {
  const d=tripDetails(trip);
  const requirements= d.tripType==='local'||requirementKeys.every(key=>workspace.requirements?.[key]);
  const packed=packing.filter(p=>p.completed).length;
  const sections=[
    {key:'overview',label:'Trip details',done:Boolean(d.origin&&d.destination&&d.start&&d.end&&d.nights>0),status:'Saved'},
    {key:'requirements',label:'Requirements',done:requirements,status:requirements?'Reviewed':'Needs review'},
    {key:'itinerary',label:'Itinerary',done:Boolean(workspace.itineraryReviewedAt),status:workspace.itineraryReviewedAt?'Reviewed':'Generated · review needed'},
    {key:'packing',label:'Packing',done:packing.length>0&&packed===packing.length,status:`${packed} / ${packing.length} prepared`}
  ];
  const score=sections.slice(0,3).filter(s=>s.done).length+(packing.length?packed/packing.length:0);
  const percent=Math.round(score/4*100);
  return {percent,sections,next:sections.find(s=>!s.done)||null,complete:sections.every(s=>s.done)};
}

export function validateWorkspaceChange(body) {
  if(!Number.isInteger(body.revision)||body.revision<0)throw new RangeError('Reload this trip before saving.');
  if(body.action==='requirement') {
    if(!requirementKeys.includes(body.key)||typeof body.reviewed!=='boolean')throw new RangeError('Invalid requirement update.');
  } else if(body.action==='costs') {
    if(!body.costs||typeof body.costs!=='object'||Array.isArray(body.costs))throw new RangeError('Enter your planned costs.');
    for(const k of ['flights','stay','daily'])if(body.costs[k]!==null&&(typeof body.costs[k]!=='number'||!Number.isFinite(body.costs[k])||body.costs[k]<0||body.costs[k]>1e9))throw new RangeError('Use valid costs or leave them blank.');
  } else if(body.action==='edit-stop') {
    if(!body.change||typeof body.change!=='object'||!['add','update','remove','reorder','move','lock'].includes(body.change.type)||JSON.stringify(body.change).length>10000)throw new RangeError('Invalid itinerary change.');
  } else if(body.action==='activity-choice') {
    if(typeof body.id!=='string'||!body.id||body.id.length>160)throw new RangeError('Choose a saved activity.');
  } else if(['packing-add','packing-edit','packing-remove'].includes(body.action)) {
    if(body.action!=='packing-add'&&(!Number.isInteger(body.itemId)||body.itemId<1))throw new RangeError('Choose a packing item.');
    if(body.action!=='packing-remove'&&(typeof body.name!=='string'||!body.name.trim()||body.name.length>100||typeof body.category!=='string'||!body.category.trim()||body.category.length>80||!Number.isInteger(body.quantity)||body.quantity<1||body.quantity>99))throw new RangeError('Check the packing item and quantity.');
  } else if(body.action==='packing') {
    if(!Number.isInteger(body.itemId)||body.itemId<1||!['have','need','unchecked'].includes(body.state))throw new RangeError('Invalid packing update.');
  } else if(body.action==='itinerary') {
    if(!Array.isArray(body.items)||body.items.length>500)throw new RangeError('Choose up to 500 itinerary items.');
    for(const item of body.items)if(!Number.isInteger(item.day)||item.day<1||item.day>91||typeof item.title!=='string'||!item.title.trim()||item.title.length>180||!/^$|^(?:[01]\d|2[0-3]):[0-5]\d$/.test(item.startTime||''))throw new RangeError('Check itinerary titles, days and times.');
  } else if(body.action==='regenerate') {
    if(body.day!==undefined&&(!Number.isInteger(body.day)||body.day<1||body.day>91))throw new RangeError('Invalid day.');
  } else if(body.action!=='review-itinerary')throw new RangeError('Unsupported workspace action.');
  return body;
}
