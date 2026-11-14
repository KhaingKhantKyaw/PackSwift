import '../../public/js/itinerary-plan-model.js';
import '../../public/js/activity-choices-model.js';
import { PlaceSearchService, destinationBase } from './place-search-service.js';
import { activityTopics, activityStyles, rankActivities } from './activity-discovery-plan.js';
import { ItineraryRoutingService, estimateTransfer, straightLineKm } from './itinerary-routing.js';

const model = globalThis.PackSwiftItineraryPlanModel;
const choicesModel = globalThis.PackSwiftActivityChoicesModel;
const DAY = 86400000, MAX_DETAILS = 24;
const providerId = value => /^[A-Za-z0-9_-]{10,255}$/.test(value || '');
const failure = message => Object.assign(new RangeError(message), { status: 422 });
const clean = (value, length = 180) => typeof value === 'string' ? value.trim().slice(0, length) : '';
const priority = value => ({ must_visit: 3, would_like: 2, optional: 1 }[value] || 2);
const dateFor = (start, index) => new Date(Date.parse(start) + index * DAY).toISOString().slice(0, 10);

// Bounded fan-out. A deadline prevents a slow provider from multiplying waits.
async function concurrent(items, limit, task, deadline = Infinity) {
  const output = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      if (Date.now() >= deadline) { output[index] = null; continue; }
      try { output[index] = await task(items[index], index); } catch { output[index] = null; }
    }
  }));
  return output;
}

export function validateItineraryRequest(raw = {}) {
  if (!raw || typeof raw !== 'object' || !raw.input || typeof raw.input !== 'object' || Array.isArray(raw.input)) throw failure('Enter your trip details before generating an itinerary.');
  const input = raw.input;
  if (!clean(input.destination, 150) || typeof input.destination !== 'string' || input.destination.length > 150) throw failure('Choose a destination of 150 characters or fewer.');
  if (!model.date(input.startDate) || !model.date(input.endDate)) throw failure('Choose valid trip dates.');
  const count = Math.round((Date.parse(input.endDate) - Date.parse(input.startDate)) / DAY) + 1;
  if (count < 1 || count > 91) throw failure('Choose a trip of 1–91 calendar days.');
  const prefs = model.preferences(input);
  if (model.minutes(prefs.preferredDayStart) === null || model.minutes(prefs.preferredDayEnd) === null || prefs.preferredDayEnd <= prefs.preferredDayStart) throw failure('Choose a day finish later than the day start.');
  for (const field of ['arrivalTime', 'departureTime']) if (input[field] && model.minutes(input[field]) === null) throw failure('Arrival and departure times must use HH:mm in destination local time.');
  for (const field of ['arrivalLocation', 'arrivalHotel', 'departureLocation']) if (input[field] && (typeof input[field] !== 'string' || input[field].length > 200)) throw failure('Arrival, stay and departure locations must be 200 characters or fewer.');
  for (const field of ['arrivalBufferMinutes', 'departureBufferMinutes']) if (input[field] !== undefined && (!Number.isInteger(input[field]) || input[field] < 0 || input[field] > 360)) throw failure('Travel-day buffers must be between 0 and 360 minutes.');
  const purposes = model.purposes(input);
  if (purposes.some(p => !Object.hasOwn(activityTopics, p))) throw failure('Choose supported travel purposes.');
  if (input.travelStyle && !Object.hasOwn(activityStyles, input.travelStyle)) throw failure('Choose a supported travel style.');
  if (input.itineraryTransport && !['TRANSIT', 'WALK', 'DRIVE'].includes(input.itineraryTransport)) throw failure('Choose transit, walking or driving for route estimates.');
  const currency = input.currency || input.currencyCode || 'USD';
  if (!/^[A-Z]{3}$/.test(currency)) throw failure('Choose a three-letter currency.');
  if (!Array.isArray(raw.selected || []) || (raw.selected || []).length > 60 || (raw.selected || []).some(p => !p || typeof p !== 'object' || !model.identity(p))) throw failure('Choose no more than 60 saved activities with valid IDs.');
  for (const p of prefs.activityPreferences) {
    if (p.preferredDay !== null && (!Number.isInteger(p.preferredDay) || p.preferredDay < 1 || p.preferredDay > count)) throw failure('A preferred activity day is outside this trip. Update it before generating.');
    if (p.preferredTimePeriod === 'specific' && model.minutes(p.specificTime) === null) throw failure('A fixed activity time is invalid. Choose HH:mm or Any Time.');
  }
  const previousPlan = raw.previousPlan === null || raw.previousPlan === undefined ? null : model.normalize(raw.previousPlan);
  if (raw.previousPlan && !previousPlan) throw failure('The previous itinerary is invalid; keep a copy and generate a fresh plan.');
  const rebuildDay = raw.rebuildDay === null || raw.rebuildDay === undefined ? null : Number(raw.rebuildDay);
  if (rebuildDay !== null && (!Number.isInteger(rebuildDay) || rebuildDay < 1 || rebuildDay > count || !previousPlan)) throw failure('Choose an existing day to rebuild.');
  if (rebuildDay !== null && previousPlan.contextKey !== model.context(input)) throw failure('Trip settings have changed. Generate a full itinerary before rebuilding one day.');
  if (previousPlan && (previousPlan.startDate !== input.startDate || previousPlan.endDate !== input.endDate || previousPlan.destination.toLowerCase() !== input.destination.trim().toLowerCase()) && previousPlan.days.some(d => d.stops.some(s => (s.locked || s.custom || s.userEdited) && (!s.fixedTravel || s.userEdited)))) throw failure('Dates or destination changed. Review the saved fixed or edited stops before generating a replacement plan.');
  return { input, selected: raw.selected || [], previousPlan, rebuildDay, count, prefs, purposes: purposes.length ? purposes : ['Culture, History & Heritage'], style: input.travelStyle || 'Balanced', currency };
}

function selectedAndVotes(input, selected, prefs) {
  const entry = choicesModel.parse(input.activityChoices).destinations.find(e => choicesModel.destinationKey(e.destination) === choicesModel.destinationKey(input.destination));
  const excluded = new Set((entry?.choices || []).filter(c => c.vote === 'down').map(c => c.id));
  for (const id of Array.isArray(input.dislikedIds) ? input.dislikedIds.slice(0, 100) : []) if (typeof id === 'string') excluded.add(id);
  const liked = (entry?.choices || []).filter(c => c.vote === 'up').map(c => ({ id: c.id, placeId: c.id, provider: 'google', name: c.title }));
  const byId = new Map();
  for (const p of [...liked, ...selected]) {
    const id = model.identity(p); if (excluded.has(id)) continue;
    const pref = prefs.activityPreferences.find(f => f.activityId === id);
    byId.set(id, { ...p, id, priority: pref?.priority || p.priority || 'would_like', preference: pref || {} });
  }
  return { selected: [...byId.values()].slice(0, 100).sort((a, b) => priority(b.priority) - priority(a.priority)), excluded };
}

async function placeDetails(reference, service, destination) {
  const id = model.identity(reference);
  if (!providerId(id)) return { ...reference, id, name: clean(reference.name || reference.title) || 'Saved activity', coordinates: model.coordinate(reference.coordinates), openingPeriods: null, detailUnavailable: true };
  const raw = await service.request('/places/' + encodeURIComponent(id), { mask: 'id,displayName,formattedAddress,location,types,regularOpeningHours,businessStatus,priceLevel' });
  const types = Array.isArray(raw.types) ? raw.types : [];
  if (types.some(t => ['lodging', 'hotel', 'motel', 'resort_hotel'].includes(t))) return { ...reference, id, unsupported: true, detailUnavailable: false };
  return { ...reference, id: raw.id || id, placeId: raw.id || id, provider: 'google', name: clean(raw.displayName?.text) || clean(reference.name || reference.title) || 'Saved place',
    coordinates: model.coordinate(raw.location), openingPeriods: model.periods(raw.regularOpeningHours?.periods), businessStatus: clean(raw.businessStatus, 40),
    activityType: types.some(t => ['restaurant', 'cafe', 'bakery', 'meal_takeaway', 'food_court'].includes(t)) ? 'dining' : 'attraction', priceLevel: raw.priceLevel || null,
    detailUnavailable: false, destination };
}

function asStop(place, currency) {
  const pref = place.preference || {};
  const duration = Number.isInteger(place.durationMinutes) && place.durationMinutes >= 15 && place.durationMinutes <= 480 ? place.durationMinutes : place.activityType === 'dining' ? 60 : 90;
  return { id: 'place-' + place.id, placeId: place.placeId || place.id, provider: providerId(place.placeId || place.id) ? 'google' : 'reference', name: clean(place.name || place.title) || 'Saved activity',
    kind: place.activityType === 'dining' ? 'meal' : 'activity', startTime: '09:00', durationMinutes: duration, locked: Boolean(pref.isUserLocked || pref.preferredDay || pref.preferredTimePeriod && pref.preferredTimePeriod !== 'any'), custom: false,
    currency, costAmount: null, coordinates: place.coordinates || undefined, openingPeriods: place.openingPeriods ?? undefined, businessStatus: place.businessStatus || undefined,
    priority: place.priority || 'would_like', preferredDay: pref.preferredDay || undefined, preferredTimePeriod: pref.preferredTimePeriod || undefined, specificTime: pref.specificTime || undefined,
    purpose: clean(place.purpose, 120), dataWarnings: place.detailUnavailable ? ['Venue details unavailable; identity, hours and location need checking.'] : [] };
}

function unscheduled(place, reason) {
  return { id: model.identity(place), placeId: place.placeId || model.identity(place), provider: providerId(place.placeId || model.identity(place)) ? 'google' : 'reference', name: clean(place.name || place.title) || 'Saved place', priority: place.priority || 'would_like', reason };
}

function periodBounds(s, bounds) {
  const limits = { morning: [360, 720], afternoon: [720, 1080], evening: [1080, 1440] }[s.preferredTimePeriod];
  return limits ? { start: Math.max(bounds.start, limits[0]), end: Math.min(bounds.end, limits[1]) } : bounds;
}

function availableTime(day, stop, input, dayCount, mode) {
  const b = periodBounds(stop, model.bounds(input, day.day, dayCount)), exact = model.minutes(stop.specificTime);
  if (b.end <= b.start) return null;
  for (let t = exact ?? Math.ceil(b.start / 15) * 15; t + stop.durationMinutes <= b.end; t += 15) {
    if (t < b.start || model.isOpen(stop, day.date, t, stop.durationMinutes) === false) { if (exact !== null) return null; continue; }
    const sorted = [...day.stops].sort((a, b) => model.minutes(a.startTime) - model.minutes(b.startTime));
    if (sorted.some(s => t < model.minutes(s.startTime) + s.durationMinutes && t + stop.durationMinutes > model.minutes(s.startTime))) { if (exact !== null) return null; continue; }
    const before = [...sorted].reverse().find(s => s.placeId && model.minutes(s.startTime) <= t), after = sorted.find(s => s.placeId && model.minutes(s.startTime) >= t);
    const transfer = before ? estimateTransfer(before, stop, mode) : null, following = after ? estimateTransfer(stop, after, mode) : null;
    const gapBefore = before ? t - (model.minutes(before.startTime) + before.durationMinutes) : Infinity;
    const gapAfter = after ? model.minutes(after.startTime) - (t + stop.durationMinutes) : Infinity;
    const intervening = before ? sorted.filter(s => !s.placeId && model.minutes(s.startTime) >= model.minutes(before.startTime) + before.durationMinutes && model.minutes(s.startTime) < t).reduce((n, s) => n + s.durationMinutes, 0) : 0;
    if (transfer && gapBefore - intervening < transfer.durationMinutes || following && gapAfter < following.durationMinutes) { if (exact !== null) return null; continue; }
    return { startTime: model.clock(t), ...(transfer ? { routeFromPrevious: transfer } : {}) };
  }
  return null;
}

function addTravelBlocks(day, input, count, currency) {
  const prefs = model.preferences(input);
  const create = (id, name, start, duration) => ({ id, name, kind: 'transfer', startTime: model.clock(start), durationMinutes: duration, locked: true, custom: false, fixedTravel: true, costAmount: null, currency,
    notes: 'Planning buffer, not a booked journey or verified travel duration. Confirm route, check-in and carrier requirements.', dataWarnings: ['Transport fare unknown; budget separately.'] });
  if (day.day === 1 && model.minutes(prefs.arrivalTime) !== null && prefs.arrivalBufferMinutes > 0 && !day.stops.some(s => s.id === 'arrival-buffer')) {
    const start = model.minutes(prefs.arrivalTime);
    day.stops.push(create('arrival-buffer', 'Arrival, transfer and settling in' + (input.arrivalHotel ? ' · ' + clean(input.arrivalHotel, 80) : ''), start, Math.min(prefs.arrivalBufferMinutes, 1440 - start)));
  }
  if (day.day === count && model.minutes(prefs.departureTime) !== null && prefs.departureBufferMinutes > 0 && !day.stops.some(s => s.id === 'departure-buffer')) {
    const end = model.minutes(prefs.departureTime), start = Math.max(0, end - prefs.departureBufferMinutes);
    if (end > start) day.stops.push(create('departure-buffer', 'Departure transfer and check-in buffer', start, end - start));
  }
}

function addComfortBreaks(day, input, count, currency) {
  const b = model.bounds(input, day.day, count), prefs = model.preferences(input);
  if (b.end - b.start < 240 || day.stops.length >= 26) return;
  const add = (kind, at, duration, name) => {
    if (day.stops.some(s => s.id === `${kind}-${day.day}` || kind === 'meal' && s.kind === 'meal')) return;
    const time = Math.max(b.start, at);
    if (time + duration > b.end || day.stops.some(s => time < model.minutes(s.startTime) + s.durationMinutes && time + duration > model.minutes(s.startTime))) return;
    day.stops.push({ id: `${kind}-${day.day}`, name, kind, startTime: model.clock(time), durationMinutes: duration, locked: false, custom: false, placeholder: true, costAmount: null, currency,
      notes: kind === 'meal' ? 'Flexible meal break; choose a nearby restaurant and confirm menu prices.' : 'Flexible recovery time; adjust around weather and your energy.', dataWarnings: [] });
  };
  add('meal', 750, 60, 'Lunch / local food break');
  if (prefs.tripPace === 'relaxed' || prefs.walking === 'short' || prefs.restBreaks === 'Frequent') add('rest', 930, 30, 'Rest and refresh');
}

async function refreshRoutes(plan, targetDays, input, service) {
  const mode = input.itineraryTransport || (model.preferences(input).walking === 'short' ? 'TRANSIT' : 'TRANSIT');
  const jobs = [];
  for (const day of targetDays) {
    let previous;
    for (const s of day.stops) {
      if (!s.placeId) continue;
      delete s.routeFromPrevious;
      if (previous) jobs.push({ day, from: previous, to: s });
      previous = s;
    }
  }
  const estimates = await concurrent(jobs, 4, j => service.route(j.from, j.to, mode), Date.now() + 22000);
  jobs.forEach((j, index) => { j.to.routeFromPrevious = estimates[index] || estimateTransfer(j.from, j.to, mode); });
  for (const day of targetDays) {
    // Real route overruns are visible conflicts, never a reason to move a fixed booking.
    for (const s of [...day.stops]) {
      const r = s.routeFromPrevious, previous = day.stops.find(p => p.id === r?.previousStopId);
      if (!previous || r.durationMinutes === null) continue;
      const earliest = model.minutes(previous.startTime) + previous.durationMinutes + r.durationMinutes;
      if (model.minutes(s.startTime) >= earliest || s.locked || s.custom || s.userEdited) continue;
      const original = s.startTime;
      day.stops = day.stops.filter(p => p.id !== s.id);
      s.specificTime = undefined;
      let found = false;
      const b = periodBounds(s, model.bounds(input, day.day, plan.days.length));
      for (let time = Math.ceil(earliest / 15) * 15; time + s.durationMinutes <= b.end; time += 15) {
        if (model.isOpen(s, day.date, time) === false || day.stops.some(p => time < model.minutes(p.startTime) + p.durationMinutes && time + s.durationMinutes > model.minutes(p.startTime))) continue;
        s.startTime = model.clock(time); day.stops.push(s); found = true; break;
      }
      if (!found) { s.startTime = original; plan.unscheduled.push(unscheduled(s, 'The available route estimate leaves insufficient time on this day. Choose another time or day.')); }
      day.stops.sort((a, b) => model.minutes(a.startTime) - model.minutes(b.startTime));
    }
    // If reflow changed the actual predecessor, the old route must not masquerade as live directions.
    let previous;
    for (const s of day.stops) if (s.placeId) { if (previous && s.routeFromPrevious?.previousStopId !== previous.id) s.routeFromPrevious = estimateTransfer(previous, s, mode); if (!previous) delete s.routeFromPrevious; previous = s; }
  }
}

export async function generateItineraryPlan(raw, { placesService = new PlaceSearchService(), routingService = new ItineraryRoutingService(), now = Date.now() } = {}) {
  const request = validateItineraryRequest(raw), { input, previousPlan, rebuildDay, count, prefs, purposes, style, currency } = request;
  const votes = selectedAndVotes(input, request.selected, prefs), warnings = [], deadline = Date.now() + 24000;
  for (const id of previousPlan?.removedPlaceIds || []) votes.excluded.add(id);
  votes.selected = votes.selected.filter(p => !votes.excluded.has(model.identity(p)));
  let candidates = votes.selected;
  if (candidates.length < MAX_DETAILS) {
    const results = await concurrent(purposes, 4, purpose => placesService.popularActivities({ destination: input.destination, purpose, style, variant: 0 }), deadline);
    const queues = results.map((r, index) => rankActivities(r?.items || [], style).map(p => ({ ...p, purpose: purposes[index], priority: 'would_like', preference: {} })));
    const seen = new Set(candidates.map(p => model.identity(p))); candidates = [...candidates];
    // Round-robin respects every chosen purpose instead of exhausting the first one.
    for (let i = 0; i < 12 && candidates.length < MAX_DETAILS; i++) for (const queue of queues) {
      const p = queue[i]; if (!p || seen.has(p.id) || votes.excluded.has(p.id) || candidates.length >= MAX_DETAILS) continue;
      seen.add(p.id); candidates.push(p);
    }
    if (results.some(r => !r)) warnings.push('Some discovery searches were unavailable. Matches may not cover every selected purpose.');
    if (!candidates.length) warnings.push('No live activity matches were available. Add saved places or personal stops; meal/rest blocks are planning placeholders.');
  }
  const nearText = clean(input.arrivalHotel, 200) || model.stayNear(input);
  let stayCoordinates = null;
  if (nearText && Date.now() < deadline) {
    try {
      const result = await placesService.request('/places:searchText', { body: { textQuery: nearText + ', ' + input.destination, pageSize: 1 }, mask: 'places.id,places.location' });
      stayCoordinates = model.coordinate(result.places?.[0]?.location);
    } catch { /* Keep the preference and state that it could not be resolved. */ }
    if (!stayCoordinates) warnings.push('Your stay or preferred area could not be located. Nearby grouping does not yet use it.');
  }
  const oldDays = previousPlan?.days || [];
  const plan = previousPlan ? model.normalize(previousPlan) : { version: 1, contextKey: '', destination: input.destination.trim(), startDate: input.startDate, endDate: input.endDate, currency, generatedAt: null,
    days: Array.from({ length: count }, (_, i) => ({ day: i + 1, date: dateFor(input.startDate, i), title: 'Day ' + (i + 1) + ' · ' + input.destination.trim(), stops: [], warnings: [] })), unscheduled: [], assumptions: [], warnings: [], dataWarnings: [], constraints: prefs };
  if (previousPlan && rebuildDay === null && (previousPlan.startDate !== input.startDate || previousPlan.endDate !== input.endDate || previousPlan.destination !== input.destination.trim())) plan.days = Array.from({ length: count }, (_, i) => ({ day: i + 1, date: dateFor(input.startDate, i), title: 'Day ' + (i + 1) + ' · ' + input.destination.trim(), stops: [], warnings: [] }));
  Object.assign(plan, { contextKey: model.context(input), destination: input.destination.trim(), startDate: input.startDate, endDate: input.endDate, currency, generatedAt: new Date(now).toISOString(), constraints: prefs });
  const targetDays = plan.days.filter(d => rebuildDay === null || d.day === rebuildDay);
  const preserved = new Set();
  for (const day of targetDays) {
    const old = oldDays.find(d => d.day === day.day);
    day.stops = (old?.stops || []).filter(s => (s.locked || s.custom || s.userEdited) && (!s.fixedTravel || s.userEdited)).map(s => ({ ...s }));
    for (const s of day.stops) { if (s.placeId) preserved.add(s.placeId); if (votes.excluded.has(s.placeId)) warnings.push('A disliked place is fixed in your plan. Unlock and remove it to exclude it: ' + s.name); }
    addTravelBlocks(day, input, count, currency); addComfortBreaks(day, input, count, currency);
  }
  const otherIds = new Set(plan.days.filter(d => !targetDays.includes(d)).flatMap(d => d.stops.map(s => s.placeId).filter(Boolean)));
  if (rebuildDay !== null) {
    // Rebuild can reschedule old flexible selections but may not erase them by omission.
    const retainedIds = new Set(candidates.map(p => model.identity(p)));
    for (const s of oldDays.find(d => d.day === rebuildDay)?.stops || []) if (s.placeId && !s.locked && !s.custom && !s.userEdited && !retainedIds.has(s.placeId) && !votes.excluded.has(s.placeId)) {
      candidates.push({ ...s, id: s.placeId, name: s.name, preference: { preferredDay: s.preferredDay, preferredTimePeriod: s.preferredTimePeriod, specificTime: s.specificTime }, priority: s.priority || 'would_like' }); retainedIds.add(s.placeId);
    }
  }
  candidates = candidates.filter(p => !preserved.has(model.identity(p)) && !otherIds.has(model.identity(p)));
  const details = await concurrent(candidates.slice(0, MAX_DETAILS), 6, p => placeDetails(p, placesService, input.destination), deadline);
  plan.unscheduled = rebuildDay === null ? [] : plan.unscheduled.filter(s => !candidates.some(p => model.identity(p) === model.identity(s)));
  const base = destinationBase(input.destination), mode = input.itineraryTransport || 'TRANSIT';
  const cap = Math.min({ relaxed: 2, balanced: 3, packed: 4 }[prefs.tripPace], prefs.walking === 'short' || prefs.restBreaks === 'Frequent' ? 2 : 4);
  const chosenIds = new Set(votes.selected.map(p => model.identity(p)));
  const active = candidates.map((p, index) => details[index] || { ...p, name: p.name || p.title, detailUnavailable: true }).sort((a, b) => priority(b.priority) - priority(a.priority) || Number(chosenIds.has(model.identity(b))) - Number(chosenIds.has(model.identity(a))) || Number(Boolean(b.preference?.preferredDay || b.preference?.specificTime)) - Number(Boolean(a.preference?.preferredDay || a.preference?.specificTime)) || (stayCoordinates ? (straightLineKm(stayCoordinates, a.coordinates) ?? Infinity) - (straightLineKm(stayCoordinates, b.coordinates) ?? Infinity) : 0));
  for (const p of active) {
    if (p.unsupported) { plan.unscheduled.push(unscheduled(p, 'Accommodation belongs in your stay details, not an activity stop.')); continue; }
    if (p.businessStatus && p.businessStatus !== 'OPERATIONAL') { plan.unscheduled.push(unscheduled(p, 'The provider reports this venue is not operational. Verify before scheduling.')); continue; }
    if (p.detailUnavailable && !p.coordinates) { plan.unscheduled.push(unscheduled(p, 'Venue location and opening details could not be refreshed. Add a verified personal stop or try again.')); continue; }
    const distance = straightLineKm(base, p.coordinates);
    if (distance !== null && distance > 60 && !p.sideTripConfirmed) { plan.unscheduled.push(unscheduled(p, 'This is outside the main city area. Confirm a side trip and its transport before scheduling.')); continue; }
    const stop = asStop(p, currency), possible = targetDays.filter(d => !stop.preferredDay || d.day === stop.preferredDay);
    possible.sort((a, b) => {
      const score = d => d.stops.filter(s => s.placeId).length * 25 + Math.min(stayCoordinates ? Math.min(25, straightLineKm(stayCoordinates, p.coordinates) ?? 25) : 25, ...d.stops.filter(s => s.coordinates).map(s => straightLineKm(s.coordinates, p.coordinates) ?? 25));
      return score(a) - score(b) || a.day - b.day;
    });
    let assigned = false;
    for (const day of possible) {
      if (day.stops.filter(s => s.placeId || s.kind === 'custom').length >= cap) continue;
      const slot = availableTime(day, stop, input, count, mode);
      if (!slot) continue;
      day.stops.push({ ...stop, ...slot }); day.stops.sort((a, b) => model.minutes(a.startTime) - model.minutes(b.startTime)); assigned = true; break;
    }
    if (!assigned) plan.unscheduled.push(unscheduled(p, 'No slot fits your day hours, opening hours, pace, transfer allowance and fixed preferences. Adjust a constraint or choose another day.'));
  }
  for (const day of targetDays) day.stops.sort((a, b) => model.minutes(a.startTime) - model.minutes(b.startTime));
  await refreshRoutes(plan, targetDays, input, routingService);
  plan.assumptions = [
    'All times use destination local time. Activity and meal durations are editable planning estimates, not reservations.',
    'Google Maps regular hours are checked when available; holiday exceptions, ticket availability and last entry still need confirmation.',
    'Routes are estimates fetched at generation time, not a confirmed timetable for the travel date. Unavailable routes use clearly labeled conservative allowances.',
    'Unquoted tickets, meals and transport have unknown cost; they are not counted as free.',
    nearText ? stayCoordinates ? 'Your stay or preferred area was located and used to favor nearby activities. First/last transfers still require separate confirmation.' : 'Your stay preference is recorded but could not be located. First/last transfers require separate planning.' : 'No stay location is set; first and last transfers require separate planning.',
    ...(!input.arrivalTime ? ['Arrival time is unknown; the first day may need shortening.'] : []), ...(!input.departureTime ? ['Departure time is unknown; leave a suitable final-day buffer.'] : []),
    ...(!model.purposes(input).length ? ['No travel purpose was selected; general culture and heritage matches were used.'] : [])
  ];
  plan.dataWarnings = [...new Set([...(rebuildDay !== null ? plan.dataWarnings : []), ...warnings])];
  const normalized = model.normalize(plan);
  if (!normalized) throw failure('This itinerary exceeds the safe size limit. Reduce the number of stops.');
  model.refreshWarnings(normalized, input);
  // Nothing outside the requested day is rescheduled or rewritten during a day rebuild.
  if (rebuildDay !== null) for (let i = 0; i < normalized.days.length; i++) if (i + 1 !== rebuildDay) normalized.days[i] = previousPlan.days[i];
  if (JSON.stringify(model.persist(normalized)).length > 80000) throw failure('This itinerary is too large to save safely. Reduce the number of personal notes or stops.');
  return { plan: normalized, warnings: normalized.warnings };
}

export async function hydrateItineraryPlan(rawPlan, input = {}, { placesService = new PlaceSearchService() } = {}) {
  const plan = model.normalize(rawPlan);
  if (!plan) throw failure('The saved itinerary is invalid.');
  const providerStops = [...plan.days.flatMap(d => d.stops),...plan.unscheduled].filter(s => s.provider === 'google' && providerId(s.placeId));
  const unique = [...new Map(providerStops.map(s => [s.placeId, s])).values()];
  const refreshed = await concurrent(unique.slice(0, MAX_DETAILS), 6, s => placeDetails({ id: s.placeId }, placesService, plan.destination), Date.now() + 24000);
  const byId = new Map(unique.slice(0, MAX_DETAILS).map((s, i) => [s.placeId, refreshed[i]]));
  for (const s of providerStops) {
    const details = byId.get(s.placeId);
    if (!details || details.detailUnavailable || details.unsupported) {
      if (!s.userEditedName) s.name = 'Saved place — details unavailable';
      s.needsRefresh = true; s.dataWarnings = ['Saved scheduling is preserved; place details are temporarily unavailable.'];
      delete s.coordinates; delete s.openingPeriods; delete s.businessStatus;
      continue;
    }
    if (!s.userEditedName) s.name = details.name;
    s.coordinates = details.coordinates || undefined; s.openingPeriods = details.openingPeriods ?? undefined; s.businessStatus = details.businessStatus || undefined;
    s.needsRefresh = false; s.dataWarnings = [];
  }
  model.refreshWarnings(plan, {...plan.constraints,...input,itineraryPreferences:input.itineraryPreferences||plan.constraints});
  return { plan, warnings: plan.warnings };
}
