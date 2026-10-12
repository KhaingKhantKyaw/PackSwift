import { calculateTripEstimate } from './costEngine.js';
import '../../public/js/canonical-itinerary.js';
import './destination-currency.js';
import '../../public/js/trip-context.js';
import '../../public/js/place-search-model.js';

// Planning benchmarks, never flight quotes or immigration determinations.
export function buildLiveReview(input) {
  input={...input,...globalThis.PackSwiftTripContext.routeContext(input)};
  const adults = Number(input.adults ?? 1), children = Number(input.children ?? 0);
  if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0 || adults + children > 20) throw new RangeError('Choose 1–20 travellers, including at least one adult.');
  if (typeof input.destination !== 'string' || input.destination.length > 150) throw new RangeError('Choose a destination.');
  const style = /luxury/.test(input.planningGoal || '') ? 'luxury' : /possible|budget|lowest/.test(input.planningGoal || input.budgetLevel || '') ? 'budget' : 'comfort';
  const estimate = calculateTripEstimate(input.destination, input.startDate, input.endDate, adults + children, style);
  // Comfort adds headroom to this internal benchmark, not a claim about a live quote.
  const comfortHeadroom = input.planningGoal === 'comfort-first' ? 1.2 : 1;
  estimate.totalEstimate *= comfortHeadroom;
  const days = estimate.totalNights + 1;
  const local=input.tripType==='local';
  const domestic=input.routeType==='domestic';
  const places = Array.isArray(input.selectedPlaces) ? input.selectedPlaces : [];
  const plan=globalThis.PackSwiftCanonical.reconcile(places,input.itinerary,days,{tripPace:input.pace,...input.itineraryPreferences},input.startDate);
  const rows=globalThis.PackSwiftCanonical.rows(plan);
  const range = amount => ({minimum:Math.round(amount * .85), maximum:Math.round(amount * 1.2)});
  const stayFactor = {hostel:.6,budget:.8,comfortable:1,luxury:1.8}[input.accommodationStyle] || 1;
  const categories = [['Accommodation', .45], ['Food', .25], ['Local transport', .15], ['Activities allowance', .10], ['Daily essentials', .05]].map(([label, share]) => ({label, ...range(estimate.totalEstimate * share * (label === 'Accommodation' ? stayFactor : days / estimate.totalNights))}));
  const total = categories.reduce((sum, row) => ({minimum:sum.minimum+row.minimum, maximum:sum.maximum+row.maximum}), {minimum:0,maximum:0});
  const dateAt = offset => new Date(Date.parse(input.startDate+'T00:00:00Z') + offset*86400000).toISOString().slice(0,10);
  const itinerary = Array.from({length:days}, (_, index) => {
    const arrival=index===0, departure=index===days-1;
    const activities = rows.filter(p=>p.day===index+1);
    return {day:index+1,date:dateAt(index),title:arrival?(local?'Start your local trip':'Arrival & settle in'):departure?(local?'Wrap up your local trip':'Departure & return transfer'):activities.length?'Your selected places':'Flexible local day',activities,
      guidance:arrival?(local?'Explore near your stay and leave time to settle in.':(domestic?'Allow time for transport and check-in.':'Verify entry requirements; allow time for border checks and transfer.')):departure?(local?'Keep time to pack and check out if staying overnight.':'Keep sightseeing optional. Confirm check-out and your return transport requirements.'):activities.length?'Check venue hours and actual transit before setting departure times.':'No verified activities assigned. Add places or use this day for rest, laundry and nearby exploration.',
      transport:style==='budget'?'Compare public transit and walking routes':'Compare public transit and ride-hailing',
      estimatedDailyGroundCost:range((estimate.totalEstimate / estimate.totalNights)*.55)};
  });
  const alerts = [{title:'Check entry requirements',severity:'warning',message:input.passportCountry?`Check official entry rules for ${String(input.passportCountry).slice(0,80)} passport holders visiting ${input.destination} for ${days} calendar days. Nationality, transit and visa validity must be verified.`:'Add your passport nationality to personalize entry-check reminders. Origin city does not establish nationality.'}];
  if(domestic)alerts.splice(0,1,{title:'Domestic trip',severity:'information',message:'No international border crossing is planned. Check carrier identification requirements.'});
  if(estimate.demandLevel==='Peak Season')alerts.push({title:'Higher seasonal demand',severity:'warning',message:'Your dates include higher benchmark demand. Confirm accommodation and transport quotes before booking.'});
  if(estimate.isFallback)alerts.push({title:'Limited destination cost data',severity:'warning',message:'No city-specific benchmark is available. Treat these generic estimates as provisional.'});
  const response={tripSummary:{origin:input.origin,destination:input.destination,routeType:input.routeType,originCountryCode:input.originCountryCode,destinationCountryCode:input.destinationCountryCode,days,nights:estimate.totalNights,adults,children,style},alerts,
    budget:{currency:estimate.currency,categories,total,status:'Benchmark allowances only — not selected-place costs or an affordability assessment',excluded:local?['Travel insurance','Intercity day-trip transfers','Shopping']:[domestic?'Intercity transport':'International transport',...(domestic?[]:['Visa fees']),'Travel insurance','Intercity day-trip transfers','Shopping'],source:estimate.source},
    itinerary,unscheduled:rows.filter(p=>p.day===null).map(p=>({...p,reason:'Assign a day after checking available time and transport.'})),unpricedTransfers:places.filter(p=>['nearby','day_trip','overnight_option','long_distance','unknown'].includes(p.tripType)).length,
    packingRecommendations:[domestic?'Personal identification':'Passport and entry documents','Booking confirmations','Comfortable footwear','Regular medication','Charging cable and suitable adapter',...(style==='budget'?['Reusable water bottle','Lightweight day bag']:[]),...(children?['Child travel documents','Child-specific care supplies']:[]),...(/beach|island/i.test(input.notes||'')?['Swimwear','Sun protection']:[])],
    generatedAt:new Date().toISOString(),dataStatus:'Planning estimates — not live fares, weather forecasts or verified visa advice'};
  response.costs=globalThis.PackSwiftTripContext.budgetSummary(input,response);
  return response;
}
