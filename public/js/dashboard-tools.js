globalThis.PackSwiftDashboardTools=(()=>{
  const totals=entries=>{const out={};for(const e of entries)if(Number.isFinite(e.amount)&&e.amount>=0)out[e.currency]=(out[e.currency]||0)+e.amount;return out;};
  function summary({trip,workspace,expenses=[],contacts=[]}){
    const d=trip.details,lines=['PACKSWIFT · PRIVATE OFFLINE TRIP',d.destination,d.start+' – '+d.end,'From '+d.origin,
      'Budget: '+(d.budget==null?'Not added':d.currency+' '+d.budget),'','ITINERARY'];
    if(workspace.editablePlan?.days)for(const day of workspace.editablePlan.days){lines.push('Day '+day.day+' · '+day.date);for(const stop of day.stops)lines.push((stop.startTime||'Flexible')+' · '+stop.name+(stop.notes?' — '+stop.notes:''));if(!day.stops.length)lines.push('No stops planned.');}
    else if(workspace.timeline?.length)for(const stop of workspace.timeline)lines.push('Day '+stop.day+' · '+(stop.startTime||'Flexible')+' · '+stop.title);
    else lines.push('No saved itinerary stops.');
    lines.push('','PACKING');
    for(const p of workspace.packing||[])lines.push((p.completed?'[x] ':'[ ] ')+(p.itemName||p.name||'Item')+' × '+(p.quantity||1)+' · '+(p.category||'General'));
    if(!workspace.packing?.length)lines.push('No saved packing items.');
    lines.push('','EXPENSE RECORDS (original currencies)');
    for(const e of expenses)lines.push(e.date+' · '+e.category+' · '+e.currency+' '+e.amount+' · '+e.scope+(e.note?' · '+e.note:''));
    if(!expenses.length)lines.push('No expenses recorded.');
    lines.push('','SAVED ACTIVITIES',...(workspace.likedActivities||[]).map(a=>a.title),'','CONTACTS',...contacts.map(c=>c.name+': '+c.phone+(c.source?' · '+c.source:'')),
      '','Verify local numbers and travel requirements before departure. This file is not a booking confirmation or travel clearance. Passport details and experience drafts are intentionally excluded.');
    return lines.join('\n');
  }
  return {totals,summary};
})();
