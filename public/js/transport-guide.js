/* Sourced mode coverage, not live route, fare or operator availability data. */
(() => {
 const guides={
  bangkok:{country:'Thailand',mode:'BTS Skytrain',url:'https://www.bts.co.th/eng/'},
  singapore:{country:'Singapore',mode:'MRT and public buses',url:'https://www.lta.gov.sg/content/ltagov/en/getting_around.html'},
  tokyo:{country:'Japan',mode:'Tokyo Metro',url:'https://www.tokyometro.jp/en/'}
 };
 const providers={grab:{name:'Grab',url:'https://www.grab.com/sg/locations/'},bolt:{name:'Bolt',url:'https://bolt.eu/en-ao/cities/bangkok/'},uber:{name:'Uber',url:'https://www.uber.com/global/en/r/cities/'}};
 const appCities={bangkok:['Thailand','grab','bolt'],singapore:['Singapore','grab'],hanoi:['Vietnam','grab'],bali:['Indonesia','grab'],tokyo:['Japan','uber'],paris:['France','uber'],london:['United Kingdom','uber']};
 function recommend(input){
  const destination=String(input.destination||'').trim(),parts=destination.toLowerCase().split(',').map(s=>s.trim());
  let guide=guides[parts[0]];if(guide&&parts.length>1&&!parts.slice(1).join(' ').includes(guide.country.toLowerCase()))guide=null;
  const style=input.travelStyle||({'make-possible':'Pocket Friendly','comfort-first':'Comfort & Value',luxury:'Ultimate Luxury'}[input.planningGoal]||'Balanced');
  let title=guide?guide.mode:'Check local transport options',reason=guide?'Start with the published network and check whether it serves your stops.':'Detailed local transport coverage is not verified for this destination.';
  if(guide&&style==='Pocket Friendly')reason='Prioritize public transport where it serves your route; compare the total group fare.';
  if(guide&&style==='Balanced')reason='Use public transport for connected areas; compare a licensed taxi for gaps or luggage.';
  if(style==='Comfort & Value'){title=guide?`${guide.mode} + taxi options`:'Compare convenient local options';reason='Compare transfers, luggage needs and door-to-door convenience before choosing a licensed service.';}
  if(style==='Full Experience'){reason=guide?'Use the local network as a base and check other local modes for each outing.':'Check locally available modes before planning transport experiences.';}
  if(style==='Ultimate Luxury'){title='Private transfer options to check';reason='Look for a licensed chauffeur or private transfer; availability and prices are not verified.';}
  const cautions=[];
  if(Number(input.children)>0)cautions.push('Confirm child fares, ages and any required child seats.');
  if(Number(input.adults)+Number(input.children)>3)cautions.push('Compare your group’s total fare and vehicle capacity.');
  if(input.travelingWithPets)cautions.push('Confirm pet acceptance and carrier rules directly before travel; no service is assumed pet-friendly.');
  if(input.accessibility&&input.accessibility!=='standard')cautions.push('Verify step-free access and accessible vehicles for the exact route.');
  if(input.entryMode==='air')cautions.push('Airport transfer: confirm your arrival airport before choosing a connection.');
  const coverage=appCities[parts[0]],matches=coverage&&(parts.length===1||parts.slice(1).join(' ').includes(coverage[0].toLowerCase()));
  const apps=matches?coverage.slice(1).map(id=>({id,...providers[id]})):[];
  return {destination,guide,style,title,reason,cautions,apps};
 }
 window.PackSwiftTransportGuide={recommend};
})();
