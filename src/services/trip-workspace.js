export const requirementKeys = ['passport','entry','arrival','onward','accommodation','insurance'];

// The captured form is the user's exact input; older trips fall back to stored columns.
export function tripDetails(trip) {
  const fields = {};
  for (const f of trip.preferences?.detailPlanning?.fields || []) {
    if (f.type !== 'checkbox' && f.type !== 'radio') fields[f.name] = f.value;
    else if (f.checked) fields[f.name] = f.value;
  }
  const start = String(fields.startDate || trip.dates.start || '').slice(0,10);
  const end = String(fields.endDate || trip.dates.end || '').slice(0,10);
  return {origin:fields.origin || trip.route.origin.name, destination:fields.destination || trip.destination.name,
    country:trip.destination.countryName, nationality:fields.passportCountry || '', start,end,
    nights:Math.max(0,Math.round((Date.parse(end)-Date.parse(start))/86400000)||0),
    adults:Number(fields.adults ?? trip.travelerBreakdown.adults), children:Number(fields.children ?? trip.travelerBreakdown.children),
    budget:Number(fields.budget ?? trip.budget.amount), currency:fields.currency || trip.budget.currency,
    style:fields.accommodationStyle || trip.preferences.accommodationStyle || 'comfortable',
    purpose:fields.tripPurpose || trip.tripPurpose, notes:fields.notes || ''};
}

export function workspaceProgress(trip, workspace, packing) {
  const d=tripDetails(trip);
  const requirements= requirementKeys.every(key=>workspace.requirements?.[key]);
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
