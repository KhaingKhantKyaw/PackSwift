import test from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/activity-choices-model.js';

const model = globalThis.PackSwiftActivityChoicesModel;
const now = 2_000_000;
const activity = { id: 'place-1', title: 'Explore the old town' };
const vote = (payload, destination = 'Bangkok', direction = 'up', time = now) =>
  model.setVote(payload, destination, activity, direction, time);

test('activity votes toggle off and switching thumbs replaces the previous vote', () => {
  const up = vote(null);
  assert.equal(model.getVote(up, 'Bangkok', activity.id), 'up');
  const off = vote(up);
  assert.equal(model.getVote(off, 'Bangkok', activity.id), null);
  assert.equal(off.destinations.length, 0);
  const down = vote(up, 'Bangkok', 'down');
  assert.equal(model.getVote(down, 'Bangkok', activity.id), 'down');
  assert.equal(down.destinations[0].choices.length, 1);
  assert.equal(model.getVote(up, 'Bangkok', activity.id), 'up', 'input remains immutable');
  assert.equal(model.getVote(vote(down, 'Bangkok', null), 'Bangkok', activity.id), null);
});

test('destination isolation and whitespace/case normalization', () => {
  const state = vote(vote(null), 'Hanoi', 'down', now + 1);
  assert.equal(model.getVote(state, ' BANGKOK ', activity.id), 'up');
  assert.equal(model.getVote(state, 'Hanoi', activity.id), 'down');
  assert.equal(model.getVote(state, 'Yangon', activity.id), null);
  const oldTown = vote(null, '  Ho   Chi Minh  ');
  assert.equal(model.getVote(oldTown, 'ho chi minh', activity.id), 'up');
});

test('temporary storage expires at twenty minutes without expiring saved trip data', () => {
  const state = vote(null);
  const encoded = JSON.stringify(model.toTemporary(state, now));
  assert.equal(model.fromTemporary(encoded, now + model.TEMPORARY_TTL_MS - 1).destinations.length, 1);
  assert.equal(model.fromTemporary(encoded, now + model.TEMPORARY_TTL_MS).destinations.length, 0);
  assert.equal(model.parse(JSON.stringify(state), now + 100 * model.TEMPORARY_TTL_MS).destinations.length, 1);
});

test('refreshing the envelope does not refresh old destinations', () => {
  const recent = now + model.TEMPORARY_TTL_MS;
  const state = vote(vote(null), 'Hanoi', 'down', recent);
  const restored = model.fromTemporary(model.toTemporary(state, recent), recent);
  assert.equal(model.getVote(restored, 'Bangkok', activity.id), null);
  assert.equal(model.getVote(restored, 'Hanoi', activity.id), 'down');
});

test('normalization rejects untrusted structures and limits retained strings', () => {
  for (const value of [null, [], 42, 'not JSON', '{', '{"destinations":{}}']) {
    assert.deepEqual(model.parse(value), { version: 1, destinations: [] });
  }
  const result = model.parse(JSON.stringify({
    version: 999,
    destinations: [{
      destination: ' Bangkok\u0000 ', updatedAt: now,
      choices: [
        null, { id: 'x', title: 'X', vote: 'other' },
        { id: {}, title: 'X', vote: 'up' },
        { id: 'x', title: {}, vote: 'up' },
        { id: 'a'.repeat(600), title: 'b'.repeat(300), vote: 'up', unsafe: 'ignored' }
      ], ignored: true
    }]
  }), now);
  assert.equal(result.destinations[0].destination, 'Bangkok');
  assert.equal(result.destinations[0].choices.length, 1);
  assert.equal(result.destinations[0].choices[0].id.length, 160);
  assert.equal(result.destinations[0].choices[0].title.length, 120);
  assert.deepEqual(Object.keys(result.destinations[0].choices[0]), ['id', 'title', 'vote']);
  assert.equal(model.parse(' '.repeat(1024 * 1024 + 1)).destinations.length, 0);
});

test('prototype-like identifiers are inert data and titles remain plain text', () => {
  const result = model.parse('{"__proto__":{"polluted":true},"destinations":[{"destination":"__proto__","updatedAt":2000000,"choices":[{"id":"constructor","title":"<img onerror=alert(1)>","vote":"up"}]}]}', now);
  assert.equal(model.getVote(result, '__proto__', 'constructor'), 'up');
  assert.equal(result.destinations[0].choices[0].title, '<img onerror=alert(1)>');
  assert.equal({}.polluted, undefined);
});

test('normalization retains at most one hundred total choices and ten recent destinations', () => {
  const destinations = Array.from({ length: 12 }, (_, d) => ({
    destination: `City ${d}`, updatedAt: now + d,
    choices: Array.from({ length: 105 }, (_, c) => ({ id: `p${c}`, title: `Place ${c}`, vote: 'up' }))
  }));
  const state = model.normalize({ destinations }, now + 20);
  assert.equal(state.destinations.length, 1);
  assert.equal(state.destinations[0].destination, 'City 11');
  assert.ok(state.destinations.every(entry => entry.choices.length === 100));
  assert.ok(state.destinations.reduce((sum,entry)=>sum+entry.choices.length,0)<=100);
  assert.equal(model.getVote(state, 'City 11', 'p0'), null);
  assert.equal(model.getVote(state, 'City 11', 'p104'), 'up');
  assert.equal(model.normalize({destinations:destinations.map(entry=>({...entry,choices:entry.choices.slice(0,1)}))},now+20).destinations.length,10);
});

test('duplicate destinations and choice ids use the most recent valid record', () => {
  const payload = model.normalize({ destinations: [
    { destination: 'Bangkok', updatedAt: now, choices: [{ ...activity, vote: 'up' }] },
    { destination: 'BANGKOK', updatedAt: now + 1, choices: [{ ...activity, vote: 'up' }, { ...activity, vote: 'down' }] }
  ] }, now + 2);
  assert.equal(payload.destinations.length, 1);
  assert.equal(payload.destinations[0].choices.length, 1);
  assert.equal(model.getVote(payload, 'Bangkok', activity.id), 'down');
});

test('invalid votes are no-ops and malformed or future envelopes do not restore', () => {
  const state = vote(null);
  assert.deepEqual(vote(state, 'Bangkok', 'yes'), state);
  assert.deepEqual(vote(state, ''), state);
  for (const envelope of [null, {}, { version: 1, savedAt: '2000000', payload: state },
    { version: 1, savedAt: now + 1, payload: state }, { version: 2, savedAt: now, payload: state }]) {
    assert.equal(model.fromTemporary(envelope, now).destinations.length, 0);
  }
});
