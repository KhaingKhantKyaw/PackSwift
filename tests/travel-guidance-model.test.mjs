import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/travel-guidance-model.js';

const model = globalThis.PackSwiftTravelGuidanceModel;
const empty = { version: 1, experience: '', detailLevel: 'auto', preparation: {} };
const input = { origin: 'Yangon', destination: 'Bangkok', startDate: '2027-02-01', endDate: '2027-02-05', adults: '2', children: '1', entryMode: 'air', arrivalTime: '10:30', arrivalLocation: 'Airport', arrivalHotel: 'My stay' };
const checkedInput = (value = input) => ({ ...value, travelGuidance: { ...empty, preparation: Object.fromEntries(model.tasks(value).map(task => [task.id, task.context])) } });

test('normalizes missing, malformed and unsupported state without selecting experience', () => {
  for (const value of [undefined, null, false, 3, [], 'not JSON', '{}', '{', 'null', JSON.stringify({ version: 2, experience: 'first' }), 'x'.repeat(8001)]) assert.deepEqual(model.normalize(value), empty);
});

test('parses valid object and JSON state and removes unrecognized fields', () => {
  const value = { version: 1, experience: 'first', detailLevel: 'quick', preparation: { weather: 'context' }, pace: 'packed', budget: 9000, itinerary: 'changed' };
  const expected = { version: 1, experience: 'first', detailLevel: 'quick', preparation: { weather: 'context' } };
  assert.deepEqual(model.normalize(value), expected);
  assert.deepEqual(model.normalize(JSON.stringify(value)), expected);
});

test('invalid enums reset safely and preparation allows only known string confirmations', () => {
  const value = { experience: 'expert', detailLevel: 'full', preparation: { bookings: true, documents: { checked: true }, arrival: 'a'.repeat(1201), offline: 'with\u0000control', weather: 'valid context', arbitrary: 'yes', constructor: 'pollution' } };
  assert.deepEqual(model.normalize(value), { ...empty, preparation: { weather: 'valid context' } });
  assert.deepEqual(model.normalize({ preparation: ['bookings'] }), empty);
  assert.deepEqual(model.normalize(Object.create({ experience: 'first', detailLevel: 'detailed' })), empty);
});

test('guidance mode follows explicit override before travel experience', () => {
  assert.equal(model.mode({}), 'quick');
  assert.equal(model.mode({ experience: 'first' }), 'detailed');
  assert.equal(model.mode({ experience: 'experienced' }), 'quick');
  assert.equal(model.mode({ experience: 'first', detailLevel: 'quick' }), 'quick');
  assert.equal(model.mode({ experience: 'experienced', detailLevel: 'detailed' }), 'detailed');
  assert.equal(model.mode({ experience: '', detailLevel: 'detailed' }), 'detailed');
});

test('tasks expose a fixed safe checklist and start unconfirmed', () => {
  const tasks = model.tasks(input);
  assert.deepEqual(tasks.map(task => task.id), ['bookings', 'documents', 'arrival', 'offline', 'weather']);
  assert.ok(tasks.every(task => task.title && task.detail && task.context && task.checked === false));
  assert.ok(tasks.every(task => task.context.length <= 1200));
});

test('preparation is checked only for an exact current task context', () => {
  assert.ok(model.tasks(checkedInput()).every(task => task.checked));
  const mismatched = { ...input, travelGuidance: { preparation: { bookings: true, documents: 'done', arrival: '/booking-click', offline: model.tasks(input)[0].context } } };
  assert.ok(model.tasks(mismatched).every(task => !task.checked));
  const serialized = checkedInput();
  serialized.travelGuidance = JSON.stringify(serialized.travelGuidance);
  assert.ok(model.tasks(serialized).every(task => task.checked));
});

test('changing destination or start date resets all current preparation checks', () => {
  for (const change of [{ destination: 'Chiang Mai' }, { startDate: '2027-02-02' }]) assert.ok(model.tasks({ ...checkedInput(), ...change }).every(task => !task.checked));
});

test('task-specific context invalidates group, arrival and stay checks only where relevant', () => {
  const group = model.tasks({ ...checkedInput(), adults: 3 });
  assert.deepEqual(group.filter(task => !task.checked).map(task => task.id), ['bookings', 'documents', 'arrival']);
  const arrival = model.tasks({ ...checkedInput(), arrivalTime: '17:00' });
  assert.deepEqual(arrival.filter(task => !task.checked).map(task => task.id), ['arrival']);
  const stay = model.tasks({ ...checkedInput(), arrivalHotel: 'Different stay' });
  assert.deepEqual(stay.filter(task => !task.checked).map(task => task.id), ['bookings', 'arrival']);
});

test('unrelated trip preferences and guidance density never reset preparation', () => {
  const current = checkedInput();
  current.travelGuidance.experience = 'first';
  current.travelGuidance.detailLevel = 'detailed';
  const changed = { ...current, budget: 100, pace: 'packed', comfortWalking: 'long', packingChecklist: 'changed', readiness_0: true };
  assert.ok(model.tasks(changed).every(task => task.checked));
});

test('editing an itinerary reopens the offline-copy check only',()=>{
  const changed=model.tasks({...checkedInput(),itineraryPlan:'updated day-by-day plan'});
  assert.deepEqual(changed.filter(task=>!task.checked).map(task=>task.id),['offline']);
});

test('context sanitizes whitespace, controls, invalid dates, counts and excessive strings', () => {
  const normalized = model.tasks({ ...input, destination: '  BANGKOK  ', adults: 2, children: 1 });
  assert.deepEqual(normalized.map(task => task.context), model.tasks(input).map(task => task.context));
  const hostile = model.tasks({ origin: '<script>\n'.repeat(1000), destination: 'x'.repeat(20000), startDate: '2027-02-31', endDate: 'bad', adults: Infinity, children: -4, arrivalLocation: 'x'.repeat(20000), arrivalHotel: 'x'.repeat(20000) });
  assert.ok(hostile.every(task => task.context.length <= 1200 && !task.context.includes('<') && !task.context.includes('2027-02-31')));
  assert.doesNotThrow(() => model.tasks(null));
});

test('normalization and task creation do not mutate their inputs or share preparation state', () => {
  const value = checkedInput();
  const before = JSON.stringify(value);
  const result = model.normalize(value.travelGuidance);
  result.preparation.bookings = 'changed';
  model.tasks(value);
  assert.equal(JSON.stringify(value), before);
  assert.notEqual(model.normalize().preparation, model.normalize().preparation);
});
