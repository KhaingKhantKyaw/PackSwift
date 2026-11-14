import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/itinerary-plan-model.js';
import { generateItineraryPlan, hydrateItineraryPlan, validateItineraryRequest } from '../src/services/itinerary-plan.js';
import { ItineraryRoutingService, estimateTransfer } from '../src/services/itinerary-routing.js';

const model = globalThis.PackSwiftItineraryPlanModel;
const input = { destination: 'Bangkok', startDate: '2027-02-01', endDate: '2027-02-03', currency: 'THB', travelStyle: 'Balanced', travelPurposes: JSON.stringify(['Culture, History & Heritage']),
  itineraryTransport: 'TRANSIT', itineraryPreferences: { tripPace: 'balanced', preferredDayStart: '09:00', preferredDayEnd: '21:00', activityPreferences: [] } };
const id = n => 'ChIJTestPlace' + String(n).padStart(4, '0');
const selected = n => Array.from({ length: n }, (_, index) => ({ id: id(index), placeId: id(index), provider: 'google', name: 'Choice ' + index }));
const always = [{ open: { day: 0, hour: 0, minute: 0 } }];
function provider(overrides = {}, discover = false) {
  const calls = { search: [], details: [] };
  return { calls,
    async popularActivities(request) { calls.search.push(request); return { items: discover ? Array.from({ length: 5 }, (_, i) => ({ id: id(calls.search.length * 10 + i), name: request.purpose + ' ' + i, purpose: request.purpose })) : [] }; },
    async request(path) { const placeId = path.split('/').at(-1); calls.details.push(placeId); return { id: placeId, displayName: { text: 'Live ' + placeId }, location: { latitude: 13.7563, longitude: 100.5018 + Number(placeId.slice(-2)) / 10000 }, types: ['tourist_attraction'], regularOpeningHours: { periods: always }, businessStatus: 'OPERATIONAL', ...overrides }; }
  };
}
const noRoutes = () => new ItineraryRoutingService({ apiKey: '' });
const generate = (request = {}, service = provider()) => generateItineraryPlan({ input, selected: selected(4), ...request }, { placesService: service, routingService: noRoutes(), now: Date.parse('2026-11-06T00:00:00Z') });
const allStops = plan => plan.days.flatMap(d => d.stops);

test('generates useful real-reference plan with explicitly unknown costs and route estimates', async () => {
  const { plan } = await generate();
  assert.equal(plan.version, 1); assert.equal(plan.days.length, 3); assert.equal(plan.contextKey, model.context(input));
  assert.equal(allStops(plan).filter(s => s.placeId).length, 4);
  assert.ok(allStops(plan).every(s => s.costAmount === null));
  assert.ok(allStops(plan).filter(s => s.placeId).every(s => s.provider === 'google' && s.openingPeriods));
  const route = allStops(plan).find(s => s.routeFromPrevious);
  assert.equal(route.routeFromPrevious.source, 'estimate');
  assert.ok(route.warnings.some(w => /conservative estimate/.test(w)));
  assert.ok(JSON.stringify(plan).length < 80000);
});

test('discovery searches every selected purpose with selected style and excludes dislikes', async () => {
  const service = provider({}, true);
  const purposes = ['Nature & Outdoor', 'Food, Drink & Culinary', 'Culture, History & Heritage'];
  const prefs = { ...input, travelStyle: 'Pocket Friendly', travelPurposes: purposes, activityChoices: { version: 1, destinations: [{ destination: 'Bangkok', choices: [{ id: id(10), title: 'No', vote: 'down' }] }] } };
  const { plan } = await generate({ input: prefs, selected: [] }, service);
  assert.deepEqual(service.calls.search.map(c => c.purpose).sort(), purposes.sort());
  assert.ok(service.calls.search.every(c => c.style === 'Pocket Friendly'));
  assert.ok(!allStops(plan).some(s => s.placeId === id(10)) && !plan.unscheduled.some(s => s.placeId === id(10)));
  assert.ok(service.calls.details.length <= 24);
});

test('liked references count as selected and explicit dislikes win without silent fixed-stop deletion', async () => {
  const service = provider();
  const i = { ...input, activityChoices: { version: 1, destinations: [{ destination: 'Bangkok', choices: [{ id: id(0), title: 'Liked', vote: 'up' }, { id: id(1), title: 'Disliked', vote: 'down' }] }] } };
  const { plan } = await generate({ input: i, selected: selected(2) }, service);
  assert.equal(service.calls.search.length, 1);
  assert.equal(allStops(plan).filter(s => s.placeId).length, 1);
  assert.equal(allStops(plan).find(s => s.placeId).placeId, id(0));
});

test('fixed day/time and must-visit priority are preserved; impossible must-visits remain visible', async () => {
  const i = { ...input, itineraryPreferences: { ...input.itineraryPreferences, activityPreferences: [
    { activityId: id(0), preferredDay: 2, preferredTimePeriod: 'specific', specificTime: '10:00', priority: 'must_visit' },
    { activityId: id(1), preferredDay: 2, preferredTimePeriod: 'specific', specificTime: '10:00', priority: 'must_visit' }
  ] } };
  const { plan } = await generate({ input: i, selected: selected(2) });
  const fixed = plan.days[1].stops.find(s => s.placeId === id(0));
  assert.equal(fixed.startTime, '10:00'); assert.equal(fixed.locked, true);
  assert.equal(plan.unscheduled.length, 1); assert.equal(plan.unscheduled[0].priority, 'must_visit');
  assert.ok(plan.warnings.some(w => /Must-visit not scheduled/.test(w)));
});

test('late arrival and early departure prevent sightseeing outside available hours', async () => {
  const { plan } = await generate({ input: { ...input, arrivalTime: '20:00', departureTime: '09:00' } });
  assert.equal(plan.days[0].stops.filter(s => s.placeId).length, 0);
  assert.equal(plan.days[2].stops.filter(s => s.placeId).length, 0);
  assert.equal(plan.days[0].stops.find(s => s.fixedTravel).startTime, '20:00');
  assert.equal(plan.days[2].stops.find(s => s.fixedTravel).startTime, '06:00');
  assert.equal(allStops(plan).filter(s => s.placeId).length + plan.unscheduled.length, 4);
});

test('uses published opening periods and rejects nonoperational venues', async () => {
  const hours = [{ open: { day: 1, hour: 14, minute: 0 }, close: { day: 1, hour: 18, minute: 0 } }];
  const { plan } = await generate({ selected: selected(1) }, provider({ regularOpeningHours: { periods: hours } }));
  const s = allStops(plan).find(s => s.placeId);
  assert.equal(plan.days[0].stops.includes(s), true); assert.ok(s.startTime >= '14:00');
  const closed = await generate({ selected: selected(1) }, provider({ businessStatus: 'CLOSED_PERMANENTLY' }));
  assert.equal(allStops(closed.plan).filter(s => s.placeId).length, 0);
  assert.match(closed.plan.unscheduled[0].reason, /not operational/);
});

test('regular hours correctly support overnight and week-wrap periods', () => {
  const s = { startTime: '01:00', durationMinutes: 60, openingPeriods: [{ open: { day: 6, hour: 22, minute: 0 }, close: { day: 0, hour: 3, minute: 0 } }] };
  assert.equal(model.isOpen(s, '2027-02-07'), true);
  assert.equal(model.isOpen({ ...s, startTime: '04:00' }, '2027-02-07'), false);
  assert.equal(model.isOpen({ ...s, openingPeriods: [] }, '2027-02-07'), false);
});

test('provider failure is conservative, bounded and never fabricates venue details', async () => {
  const unavailable = { async request() { throw Error('secret fake-provider-key'); }, async popularActivities() { throw Error('unavailable'); } };
  const { plan } = await generate({ selected: selected(2) }, unavailable);
  assert.equal(allStops(plan).filter(s => s.placeId).length, 0);
  assert.equal(plan.unscheduled.length, 2);
  assert.ok(!JSON.stringify(plan).includes('secret'));
  const empty = await generate({ selected: [] }, unavailable);
  assert.ok(empty.plan.warnings.some(w => /No live activity/.test(w)));
});

test('day rebuild preserves all other days, locked stops and custom additions', async () => {
  const original = (await generate({ selected: selected(6) })).plan;
  const first = original.days[0].stops.find(s => s.placeId);
  let plan = model.edit(original, { type: 'lock', id: first.id, locked: true });
  plan = model.edit(plan, { type: 'add', day: 1, stop: { id: 'my-meeting', name: 'Meet a friend', kind: 'custom', startTime: '19:00', durationMinutes: 60, custom: true, costAmount: null } });
  const beforeOthers = JSON.stringify(plan.days.slice(1)), beforeFixed = JSON.stringify(plan.days[0].stops.find(s => s.id === first.id));
  const rebuilt = (await generate({ selected: selected(6), previousPlan: plan, rebuildDay: 1 })).plan;
  assert.equal(JSON.stringify(rebuilt.days.slice(1)), beforeOthers);
  assert.equal(rebuilt.days[0].stops.find(s => s.id === first.id).startTime, JSON.parse(beforeFixed).startTime);
  assert.equal(rebuilt.days[0].stops.find(s => s.id === 'my-meeting').name, 'Meet a friend');
  assert.equal(rebuilt.days[0].stops.find(s => s.id === 'my-meeting').startTime, '19:00');
});

test('editing is immutable, validates fields, protects locks and reports conflicts', async () => {
  const original = (await generate()).plan, initial = JSON.stringify(original), s = original.days[0].stops.find(s => s.placeId);
  const locked = model.edit(original, { type: 'lock', id: s.id, locked: true });
  assert.throws(() => model.edit(locked, { type: 'remove', id: s.id }), /Unlock/);
  assert.throws(() => model.edit(original, { type: 'update', id: s.id, values: { durationMinutes: -1 } }), /valid/);
  const changed = model.edit(original, { type: 'update', id: s.id, values: { startTime: '23:30', durationMinutes: 90, name: 'My own label', costAmount: 500 } });
  assert.equal(JSON.stringify(original), initial); assert.equal(changed.days[0].stops.find(p => p.id === s.id).userEditedName, true);
  assert.ok(model.validate(changed, input).some(w => /Outside|midnight/.test(w)));
  const moved = model.edit(original, { type: 'move', id: s.id, day: 3 });
  assert.ok(moved.days[2].stops.some(p => p.id === s.id));
  assert.equal(JSON.stringify(original), initial);
});

test('persist drops provider content but keeps scheduling and deliberate edits; hydrate does not reschedule', async () => {
  let plan = (await generate()).plan;
  const s = plan.days[0].stops.find(s => s.placeId);
  plan = model.edit(plan, { type: 'update', id: s.id, values: { name: 'My label', notes: 'Meet at the gate', costAmount: 500 } });
  const saved = model.persist(plan), copy = allStops(saved).find(p => p.id === s.id);
  assert.equal(copy.name, 'My label'); assert.equal(copy.notes, 'Meet at the gate'); assert.equal(copy.costAmount, 500);
  assert.equal(copy.coordinates, undefined); assert.equal(copy.openingPeriods, undefined); assert.equal(copy.routeFromPrevious, undefined);
  assert.ok(allStops(saved).filter(p => p.placeId && p.id !== s.id).every(p => p.name === 'Saved place — details unavailable'));
  const hydrated = (await hydrateItineraryPlan(saved, input, { placesService: provider() })).plan;
  assert.equal(allStops(hydrated).find(p => p.id === s.id).name, 'My label');
  assert.deepEqual(allStops(hydrated).map(s => [s.id, s.startTime, s.durationMinutes, s.locked]), allStops(saved).map(s => [s.id, s.startTime, s.durationMinutes, s.locked]));
});

test('failed hydration preserves decisions with readable unavailable labels', async () => {
  const saved = model.persist((await generate()).plan);
  const { plan } = await hydrateItineraryPlan(saved, input, { placesService: { async request() { throw Error('no access'); } } });
  assert.deepEqual(allStops(plan).map(s => [s.id, s.startTime]), allStops(saved).map(s => [s.id, s.startTime]));
  assert.ok(allStops(plan).filter(s => s.placeId).every(s => s.needsRefresh && s.name.includes('unavailable')));
});

test('saved unscheduled references refresh without being silently scheduled',async()=>{
 const saved=model.persist((await generate()).plan);saved.unscheduled.push({id:id(99),placeId:id(99),provider:'google',name:'Saved place',priority:'would_like',reason:'Choose a day'});
 const before=allStops(saved).map(s=>s.id);const hydrated=(await hydrateItineraryPlan(saved,{}, {placesService:provider()})).plan;
 assert.deepEqual(allStops(hydrated).map(s=>s.id),before);assert.equal(hydrated.unscheduled[0].name,'Live '+id(99));
});

test('date changes may rebuild automatic travel buffers but not personal commitments',async()=>{
 const i={...input,arrivalTime:'20:00'};const previousPlan=(await generate({input:i,selected:[]})).plan;
 assert.doesNotThrow(()=>validateItineraryRequest({input:{...i,endDate:'2027-02-04'},previousPlan,selected:[]}));
 const personal=model.edit(previousPlan,{type:'add',day:2,stop:{id:'appointment',name:'Appointment',kind:'custom',custom:true,startTime:'11:00',durationMinutes:60}});
 assert.throws(()=>validateItineraryRequest({input:{...i,endDate:'2027-02-04'},previousPlan:personal,selected:[]}),/fixed or edited/);
});

test('routing reads actual Google route values; credentials remain server-only; failed or over-budget calls use labels', async () => {
  const calls = [];
  const routes = new ItineraryRoutingService({ apiKey: 'server-secret', maxCalls: 1, fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, async json() { return { routes: [{ duration: '900s', distanceMeters: 3400 }] }; } }; } });
  const a = { id: 'a', placeId: id(0), provider: 'google', coordinates: { latitude: 13.75, longitude: 100.5 } }, b = { ...a, id: 'b', placeId: id(1) };
  const route = await routes.route(a, b, 'TRANSIT');
  assert.equal(route.source, 'routes'); assert.equal(route.durationMinutes, 15); assert.equal(route.distanceMeters, 3400);
  assert.equal(calls[0].options.headers['X-Goog-Api-Key'], 'server-secret');
  assert.equal(JSON.parse(calls[0].options.body).travelMode, 'TRANSIT');
  assert.ok(!JSON.stringify(route).includes('server-secret'));
  assert.equal((await routes.route(a, b)).source, 'estimate'); assert.equal(calls.length, 1);
  assert.equal(estimateTransfer({ id: 'a' }, { id: 'b' }).source, 'unknown');
});

test('real route overrun cannot move a fixed-time stop and is reported', async () => {
  const i = { ...input, endDate: input.startDate, itineraryPreferences: { ...input.itineraryPreferences, activityPreferences: [
    { activityId: id(0), preferredDay: 1, preferredTimePeriod: 'specific', specificTime: '09:00', priority: 'must_visit' },
    { activityId: id(1), preferredDay: 1, preferredTimePeriod: 'specific', specificTime: '11:00', priority: 'must_visit' }
  ] } };
  const { plan } = await generateItineraryPlan({ input: i, selected: selected(2) }, { placesService: provider(), routingService: { async route(a) { return { durationMinutes: 120, source: 'routes', mode: 'TRANSIT', previousStopId: a.id }; } } });
  assert.equal(allStops(plan).find(s => s.placeId === id(1)).startTime, '11:00');
  assert.ok(plan.warnings.some(w => /Not enough transfer time/.test(w)));
});

test('context changes on interests, pace, arrival, stay, mode and date, not object field order', () => {
  const base = model.context(input);
  for (const update of [{ endDate: '2027-02-04' }, { travelPurposes: ['Nature & Outdoor'] }, { arrivalTime: '18:00' }, { departureTime: '12:00' }, { arrivalHotel: 'My hotel' }, { itineraryTransport: 'WALK' }, { itineraryPreferences: { ...input.itineraryPreferences, tripPace: 'relaxed' } }]) assert.notEqual(model.context({ ...input, ...update }), base);
  assert.equal(model.context(Object.fromEntries(Object.entries(input).reverse())), base);
});

test('rejects malformed input, impossible dates and stale day rebuilds before provider calls', async () => {
  for (const update of [{ startDate: '2027-02-30' }, { endDate: '2028-01-01' }, { arrivalTime: '25:00' }, { travelStyle: 'fake' }, { itineraryTransport: 'FLY' }, { currency: 'bad-currency' }]) assert.throws(() => validateItineraryRequest({ input: { ...input, ...update }, selected: [] }), RangeError);
  assert.equal(model.normalize({}), null); assert.equal(model.normalize('{'), null);
  const previousPlan = (await generate()).plan;
  assert.throws(() => validateItineraryRequest({ input: { ...input, arrivalTime: '12:00' }, selected: [], previousPlan, rebuildDay: 1 }), /settings have changed/);
});

test('91-day plan remains compact; all 60 selections retained scheduled or unscheduled', async () => {
  const longInput = { ...input, startDate: '2027-01-01', endDate: '2027-04-01', itineraryPreferences: { ...input.itineraryPreferences, tripPace: 'relaxed' } };
  const service = provider();
  const { plan } = await generate({ input: longInput, selected: selected(60) }, service);
  assert.equal(plan.days.length, 91); assert.equal(service.calls.details.length, 24);
  assert.equal(allStops(plan).filter(s => s.placeId).length + plan.unscheduled.length, 60);
  assert.ok(JSON.stringify(model.persist(plan)).length < 80000);
});

test('one selected place is prioritized while discovery fills remaining space for every purpose', async () => {
  const service = provider({}, true), purposes = ['Nature & Outdoor', 'Food, Drink & Culinary'];
  const { plan } = await generate({ input: { ...input, travelPurposes: purposes }, selected: selected(1) }, service);
  assert.deepEqual(service.calls.search.map(s => s.purpose).sort(), [...purposes].sort());
  assert.ok(allStops(plan).some(s => s.placeId === id(0)));
  assert.ok(allStops(plan).filter(s => s.placeId).length > 1);
  assert.ok(purposes.every(purpose => allStops(plan).some(s => s.purpose === purpose) || plan.unscheduled.length));
});

test('manual changes and explicit removals survive rebuild without a lock', async () => {
  const original = (await generate({ selected: selected(3) })).plan;
  const s = original.days[0].stops.find(s => s.placeId);
  let edited = model.edit(original, { type: 'update', id: s.id, values: { name: 'Personal title', startTime: '18:00', durationMinutes: 45 } });
  const other = allStops(edited).find(p => p.placeId && p.id !== s.id);
  edited = model.edit(edited, { type: 'remove', id: other.id });
  const result = (await generate({ selected: selected(3), previousPlan: edited, rebuildDay: 1 })).plan;
  const retained = allStops(result).find(p => p.id === s.id);
  assert.equal(retained.userEdited, true); assert.equal(retained.name, 'Personal title'); assert.equal(retained.startTime, '18:00'); assert.equal(retained.durationMinutes, 45);
  assert.ok(!allStops(result).some(p => p.placeId === other.placeId));
  assert.ok(!result.unscheduled.some(p => p.placeId === other.placeId));
});

test('arrival at 23:59 and departure at 00:01 preserve boundary buffers', async () => {
  const { plan } = await generate({ input: { ...input, arrivalTime: '23:59', departureTime: '00:01' }, selected: selected(1) });
  assert.equal(plan.days[0].stops.find(s => s.fixedTravel).durationMinutes, 1);
  assert.equal(plan.days[2].stops.find(s => s.fixedTravel).durationMinutes, 1);
  assert.ok(model.normalize(plan));
});

test('stay-near context is destination-specific and is resolved only once for grouping', async () => {
  const i = { ...input, stayNearPreferences: JSON.stringify({ bangkok: 'Siam Square', paris: 'Louvre' }) }, service = provider();
  const originalRequest = service.request;
  let areaCalls = 0;
  service.request = async (path, args) => {
    if (path === '/places:searchText') { areaCalls++; assert.match(args.body.textQuery, /Siam Square/); return { places: [{ location: { latitude: 13.74, longitude: 100.53 } }] }; }
    return originalRequest(path, args);
  };
  const { plan } = await generate({ input: i, selected: selected(1) }, service);
  assert.equal(areaCalls, 1); assert.notEqual(model.context(i), model.context(input));
  assert.equal(model.context(i), model.context({ ...i, stayNearPreferences: JSON.stringify({ paris: 'Other', bangkok: 'Siam Square' }) }));
  assert.ok(plan.assumptions.some(a => /used to favor nearby/.test(a)));
});
