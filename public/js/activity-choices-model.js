/* Activity votes are trip data. Only their temporary browser-storage envelope expires. */
globalThis.PackSwiftActivityChoicesModel = (() => {
  const VERSION = 1;
  const TEMPORARY_TTL_MS = 20 * 60 * 1000;
  const MAX_DESTINATIONS = 10;
  const MAX_CHOICES = 100;
  const MAX_JSON_LENGTH = 1024 * 1024;
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const text = (value, length) => typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, length)
    : '';
  const destinationKey = value => text(value, 150).replace(/\s+/g, ' ').toLocaleLowerCase('en');
  const clock = value => Number.isFinite(value) && value >= 0 ? value : Date.now();
  const timestamp = (value, now) => Number.isFinite(value) && value >= 0 ? Math.min(value, now) : 0;
  const empty = () => ({ version: VERSION, destinations: [] });

  function decode(value) {
    if (typeof value !== 'string') return value;
    if (value.length > MAX_JSON_LENGTH) return null;
    try { return JSON.parse(value); } catch { return null; }
  }

  function normalize(raw, now = Date.now()) {
    now = clock(now);
    if (!record(raw) || !Array.isArray(raw.destinations)) return empty();
    const destinations = new Map();
    for (const entry of raw.destinations.slice(-100)) {
      if (!record(entry)) continue;
      const destination = text(entry.destination, 150).replace(/\s+/g, ' ');
      const key = destinationKey(destination);
      if (!key || !Array.isArray(entry.choices)) continue;
      const choices = new Map();
      for (const item of entry.choices.slice(-1000)) {
        if (!record(item) || !['up', 'down'].includes(item.vote)) continue;
        const id = text(item.id, 160);
        const title = text(item.title, 120);
        if (!id || !title) continue;
        // Delete before set so the latest duplicate retains the latest position.
        choices.delete(id);
        choices.set(id, { id, title, vote: item.vote });
      }
      if (!choices.size) continue;
      const normalized = {
        destination,
        updatedAt: timestamp(entry.updatedAt, now),
        choices: [...choices.values()].slice(-MAX_CHOICES)
      };
      const previous = destinations.get(key);
      if (!previous || normalized.updatedAt >= previous.updatedAt) destinations.set(key, normalized);
    }
    let remaining = MAX_CHOICES;
    return {
      version: VERSION,
      destinations: [...destinations.values()]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_DESTINATIONS)
        .map(entry => { const choices = remaining > 0 ? entry.choices.slice(-remaining) : []; remaining -= choices.length; return {...entry, choices}; })
        .filter(entry => entry.choices.length)
    };
  }

  function parse(value, now = Date.now()) {
    return normalize(decode(value), now);
  }

  function getVote(payload, destination, id) {
    const key = destinationKey(destination);
    const activityId = text(id, 160);
    if (!key || !activityId) return null;
    return normalize(payload).destinations
      .find(entry => destinationKey(entry.destination) === key)?.choices
      .find(choice => choice.id === activityId)?.vote || null;
  }

  function setVote(payload, destination, activity, vote, now = Date.now()) {
    now = clock(now);
    const next = normalize(payload, now);
    const label = text(destination, 150).replace(/\s+/g, ' ');
    const key = destinationKey(label);
    const id = record(activity) ? text(activity.id, 160) : '';
    const title = record(activity) ? text(activity.title, 120) : '';
    if (!key || !id || !title || !['up', 'down', null].includes(vote)) return next;
    let entry = next.destinations.find(item => destinationKey(item.destination) === key);
    const previous = entry?.choices.find(choice => choice.id === id)?.vote;
    if (!entry) {
      entry = { destination: label, updatedAt: now, choices: [] };
      next.destinations.unshift(entry);
    }
    entry.choices = entry.choices.filter(choice => choice.id !== id);
    if (vote !== null && vote !== previous) entry.choices.push({ id, title, vote });
    entry.updatedAt = now;
    return normalize(next, now);
  }

  function toTemporary(payload, now = Date.now()) {
    now = clock(now);
    return { version: VERSION, savedAt: now, payload: normalize(payload, now) };
  }

  function fromTemporary(value, now = Date.now()) {
    now = clock(now);
    const envelope = decode(value);
    if (!record(envelope) || envelope.version !== VERSION || !Number.isFinite(envelope.savedAt)
      || envelope.savedAt < 0 || envelope.savedAt > now
      || now - envelope.savedAt >= TEMPORARY_TTL_MS) return empty();
    const payload = normalize(envelope.payload, now);
    payload.destinations = payload.destinations.filter(entry => now - entry.updatedAt < TEMPORARY_TTL_MS);
    return payload;
  }

  return Object.freeze({
    VERSION, TEMPORARY_TTL_MS, MAX_DESTINATIONS, MAX_CHOICES,
    destinationKey, normalize, parse, getVote, setVote, toTemporary, fromTemporary
  });
})();
