/* Shared, serializable itinerary decisions. No provider credentials or HTML live here. */
globalThis.PackSwiftItineraryPlanModel = (() => {
  'use strict';
  const kinds = ['activity', 'meal', 'rest', 'transfer', 'custom'];
  const text = (value, max = 240) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const strings = (value, max = 20) => Array.isArray(value) ? [...new Set(value.filter(v => typeof v === 'string').map(v => text(v, 260)))].slice(0, max) : [];
  const minutes = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || '') ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3)) : null;
  const clock = value => `${String(Math.floor(Math.max(0, Math.min(1439, value)) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, Math.min(1439, value))) % 60).padStart(2, '0')}`;
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const clone = value => JSON.parse(JSON.stringify(value));
  const identity = value => text(value?.providerPlaceId || value?.placeId || value?.id, 255);
  function purposes(input = {}) {
    let values = input.travelPurposes;
    if (typeof values === 'string') { try { values = JSON.parse(values); } catch { values = []; } }
    return strings(Array.isArray(values) && values.length ? values : input.travelPurposeCategory ? [input.travelPurposeCategory] : [], 10).sort();
  }
  function preferences(input = {}) {
    const p = input.itineraryPreferences && typeof input.itineraryPreferences === 'object' ? input.itineraryPreferences : input;
    return {
      tripPace: ['relaxed', 'balanced', 'packed'].includes(p.tripPace || input.pace) ? p.tripPace || input.pace : 'balanced',
      preferredDayStart: p.preferredDayStart || input.dayStart || '09:00',
      preferredDayEnd: p.preferredDayEnd || input.dayEnd || '21:00',
      arrivalTime: text(input.arrivalTime || p.arrivalTime, 5), departureTime: text(input.departureTime || p.departureTime, 5),
      walking: text(input.comfortWalking || input.walking || p.walking, 40), restBreaks: text(input.restBreaks || p.restBreaks, 40),
      arrivalBufferMinutes: Number.isInteger(input.arrivalBufferMinutes) ? Math.max(0, Math.min(360, input.arrivalBufferMinutes)) : 210,
      departureBufferMinutes: Number.isInteger(input.departureBufferMinutes) ? Math.max(0, Math.min(360, input.departureBufferMinutes)) : 180,
      activityPreferences: (Array.isArray(p.activityPreferences) ? p.activityPreferences : []).filter(a => a && typeof a === 'object').slice(0, 100).map(a => ({
        activityId: text(String(a.activityId || ''), 255), preferredDay: a.preferredDay === null || a.preferredDay === '' || a.preferredDay === undefined ? null : Number(a.preferredDay),
        preferredTimePeriod: ['any', 'morning', 'afternoon', 'evening', 'specific'].includes(a.preferredTimePeriod) ? a.preferredTimePeriod : 'any',
        specificTime: text(a.specificTime, 5) || null, priority: ['must_visit', 'would_like', 'optional'].includes(a.priority) ? a.priority : 'would_like',
        isUserLocked: a.isUserLocked === true
      })).sort((a, b) => a.activityId.localeCompare(b.activityId))
    };
  }
  function context(input = {}) {
    const normalized = { destination: text(input.destination, 150).toLowerCase(), origin: text(input.origin, 150).toLowerCase(), startDate: text(input.startDate, 10), endDate: text(input.endDate, 10),
      currency: text(input.currency || input.currencyCode || 'USD', 3).toUpperCase(), purposes: purposes(input), travelStyle: text(input.travelStyle, 50),
      preferences: preferences(input), arrivalLocation: text(input.arrivalLocation, 200), arrivalHotel: text(input.arrivalHotel || input.stay, 200), stayNear: stayNear(input), departureLocation: text(input.departureLocation, 200),
      transportation: text(input.itineraryTransport || input.transportation || input.transportStyle, 50), adults: Number(input.adults) || 1, children: Number(input.children) || 0,
      activityChoices: typeof input.activityChoices === 'string' ? input.activityChoices.slice(0, 20000) : input.activityChoices || null };
    let hash = 2166136261;
    for (const ch of JSON.stringify(normalized)) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    return 'itinerary-v1-' + (hash >>> 0).toString(16);
  }
  function stayNear(input = {}) {
    let raw = input.stayNearPreferences;
    if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { raw = {}; } }
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? text(raw[text(input.destination, 150).toLowerCase()], 250) : '';
  }
  function coordinate(raw) {
    const latitude = raw?.latitude, longitude = raw?.longitude;
    return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
  }
  function point(raw) {
    if (!raw || !Number.isInteger(raw.day) || raw.day < 0 || raw.day > 6) return null;
    const hour = raw.hour ?? 0, minute = raw.minute ?? 0;
    return Number.isInteger(hour) && hour >= 0 && hour < 24 && Number.isInteger(minute) && minute >= 0 && minute < 60 ? { day: raw.day, hour, minute } : null;
  }
  function periods(raw) {
    if (!Array.isArray(raw)) return null;
    return raw.slice(0, 28).map(p => ({ open: point(p?.open), close: point(p?.close) })).filter(p => p.open);
  }
  function stop(raw, currency = 'USD') {
    if (!raw || typeof raw !== 'object' || !text(raw.id, 255) || minutes(raw.startTime) === null || !Number.isInteger(raw.durationMinutes) || raw.durationMinutes < (raw.fixedTravel === true ? 1 : 5) || raw.durationMinutes > 1440) return null;
    const value = { id: text(raw.id, 255), name: text(raw.name || raw.title, 180) || 'Saved place — details unavailable', kind: kinds.includes(raw.kind) ? raw.kind : 'activity', startTime: raw.startTime, durationMinutes: raw.durationMinutes,
      locked: raw.locked === true, custom: raw.custom === true, costAmount: Number.isFinite(raw.costAmount) && raw.costAmount >= 0 && raw.costAmount <= 100000000 ? raw.costAmount : null,
      currency: /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : currency };
    if (text(raw.placeId, 255)) { value.placeId = text(raw.placeId, 255); value.provider = raw.provider === 'google' ? 'google' : 'reference'; }
    for (const key of ['notes', 'purpose', 'businessStatus']) if (text(raw[key], key === 'notes' ? 600 : 120)) value[key] = text(raw[key], key === 'notes' ? 600 : 120);
    for (const key of ['userEdited', 'userEditedName', 'userEditedNotes', 'placeholder', 'fixedTravel', 'needsRefresh']) if (raw[key] === true) value[key] = true;
    if (coordinate(raw.coordinates)) value.coordinates = coordinate(raw.coordinates);
    if (periods(raw.openingPeriods) !== null) value.openingPeriods = periods(raw.openingPeriods);
    if (['must_visit', 'would_like', 'optional'].includes(raw.priority)) value.priority = raw.priority;
    if (Number.isInteger(raw.preferredDay) && raw.preferredDay >= 1 && raw.preferredDay <= 91) value.preferredDay = raw.preferredDay;
    if (['morning', 'afternoon', 'evening', 'specific'].includes(raw.preferredTimePeriod)) value.preferredTimePeriod = raw.preferredTimePeriod;
    if (minutes(raw.specificTime) !== null) value.specificTime = raw.specificTime;
    const r = raw.routeFromPrevious;
    if (r && ['routes', 'estimate', 'unknown'].includes(r.source) && (r.durationMinutes === null || Number.isFinite(r.durationMinutes) && r.durationMinutes >= 0 && r.durationMinutes <= 1440)) {
      value.routeFromPrevious = { durationMinutes: r.durationMinutes === null ? null : Math.ceil(r.durationMinutes), mode: text(r.mode, 25) || 'UNCONFIRMED', source: r.source };
      if (Number.isFinite(r.distanceMeters) && r.distanceMeters >= 0) value.routeFromPrevious.distanceMeters = Math.round(r.distanceMeters);
      if (text(r.previousStopId, 255)) value.routeFromPrevious.previousStopId = text(r.previousStopId, 255);
    }
    value.dataWarnings = strings(raw.dataWarnings, 8); value.warnings = strings(raw.warnings, 16);
    return value;
  }
  function normalize(raw) {
    if (typeof raw === 'string') { if (raw.length > 180000) return null; try { raw = JSON.parse(raw); } catch { return null; } }
    if (!raw || raw.version !== 1 || !date(raw.startDate) || !date(raw.endDate) || !Array.isArray(raw.days) || raw.days.length < 1 || raw.days.length > 91) return null;
    const count = Math.round((Date.parse(raw.endDate) - Date.parse(raw.startDate)) / 86400000) + 1;
    if (count !== raw.days.length || count < 1 || count > 91) return null;
    const currency = /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : 'USD';
    const seen = new Set(); let total = 0;
    const days = raw.days.map((d, i) => {
      const expectedDate = new Date(Date.parse(raw.startDate) + i * 86400000).toISOString().slice(0, 10);
      if (!d || d.day !== i + 1 || d.date !== expectedDate || !Array.isArray(d.stops) || d.stops.length > 30) return null;
      const stops = d.stops.map(s => stop(s, currency));
      if (stops.some(s => !s || seen.has(s.id) || (seen.add(s.id), false))) return null;
      total += stops.length;
      return { day: i + 1, date: expectedDate, title: text(d.title, 180) || 'Day ' + (i + 1), stops, warnings: strings(d.warnings) };
    });
    if (days.some(d => !d) || total > 300) return null;
    const generatedAt = typeof raw.generatedAt === 'string' && Number.isFinite(Date.parse(raw.generatedAt)) ? new Date(raw.generatedAt).toISOString() : null;
    if (!generatedAt) return null;
    const plan = { version: 1, contextKey: text(raw.contextKey, 100), destination: text(raw.destination, 150), startDate: raw.startDate, endDate: raw.endDate, currency, generatedAt, days,
      unscheduled: (Array.isArray(raw.unscheduled) ? raw.unscheduled : []).filter(s => s && typeof s === 'object').slice(0, 100).map(s => ({ id: identity(s), ...(text(s.placeId, 255) ? { placeId: text(s.placeId, 255), provider: s.provider === 'google' ? 'google' : 'reference' } : {}), name: text(s.name || s.title, 180) || 'Saved place', priority: ['must_visit', 'would_like', 'optional'].includes(s.priority) ? s.priority : 'would_like', reason: text(s.reason, 300) || 'Choose a suitable time before adding this stop.' })),
      assumptions: strings(raw.assumptions, 16), warnings: strings(raw.warnings, 40), dataWarnings: strings(raw.dataWarnings, 24), removedPlaceIds: strings(raw.removedPlaceIds, 100), constraints: preferences(raw.constraints || {}) };
    return plan;
  }
  function bounds(input, day, total) {
    const p = preferences(input), baseStart = minutes(p.preferredDayStart) ?? 540, baseEnd = minutes(p.preferredDayEnd) ?? 1260;
    return { start: Math.max(baseStart, day === 1 && minutes(p.arrivalTime) !== null ? minutes(p.arrivalTime) + p.arrivalBufferMinutes : 0),
      end: Math.min(baseEnd, day === total && minutes(p.departureTime) !== null ? minutes(p.departureTime) - p.departureBufferMinutes : 1440) };
  }
  function isOpen(stop, dayDate, start = minutes(stop.startTime), duration = stop.durationMinutes) {
    if (!Array.isArray(stop.openingPeriods)) return null;
    if (!stop.openingPeriods.length) return false;
    const week = 10080, day = new Date(dayDate + 'T12:00:00Z').getUTCDay(), from = day * 1440 + start, to = from + duration;
    return stop.openingPeriods.some(p => {
      if (p.open.day === 0 && p.open.hour === 0 && p.open.minute === 0 && !p.close) return true;
      if (!p.close) return false;
      const a = p.open.day * 1440 + p.open.hour * 60 + p.open.minute;
      let b = p.close.day * 1440 + p.close.hour * 60 + p.close.minute;
      if (b <= a) b += week;
      return [0, -week, week].some(offset => from >= a + offset && to <= b + offset);
    });
  }
  function refreshWarnings(plan, input = plan.constraints) {
    const globalWarnings = [...plan.dataWarnings], counts = new Map();
    for (const day of plan.days) {
      const b = bounds(input, day.day, plan.days.length), dayWarnings = [];
      let previous = null, previousLocated = null;
      for (const s of day.stops) {
        const warnings = [...s.dataWarnings], start = minutes(s.startTime), end = start + s.durationMinutes;
        if (!s.fixedTravel && (start < b.start || end > b.end)) warnings.push('Outside available day hours or arrival/departure buffers.');
        if (end > 1440) warnings.push('This stop extends past midnight.');
        if (previous && start < minutes(previous.startTime) + previous.durationMinutes) warnings.push('Overlaps the preceding stop or is out of time order.');
        if (s.preferredDay && s.preferredDay !== day.day) warnings.push('Does not match your preferred day.');
        if (s.specificTime && start !== minutes(s.specificTime)) warnings.push('Does not match your fixed preferred time.');
        if (s.preferredTimePeriod === 'morning' && (start < 360 || end > 720) || s.preferredTimePeriod === 'afternoon' && (start < 720 || end > 1080) || s.preferredTimePeriod === 'evening' && start < 1080) warnings.push('Does not fit your preferred time of day.');
        if (s.businessStatus && s.businessStatus !== 'OPERATIONAL') warnings.push('Provider reports this venue is not operational; verify before visiting.');
        if (isOpen(s, day.date) === false) warnings.push('Outside the published regular opening hours; confirm holiday exceptions.');
        if (s.placeId && !s.openingPeriods) warnings.push('Opening hours unverified.');
        if (s.needsRefresh) warnings.push('Saved place details need refreshing.');
        if (s.costAmount === null && !['rest', 'transfer'].includes(s.kind)) warnings.push('Cost unknown; not counted as free.');
        if (s.costAmount !== null && s.currency !== plan.currency) warnings.push('Cost is in ' + s.currency + '; no currency conversion applied.');
        const route = s.routeFromPrevious;
        if (route && previousLocated) {
          if (route.previousStopId && route.previousStopId !== previousLocated.id) warnings.push('Route changed after editing; refresh directions.');
          else if (route.durationMinutes !== null && start - (minutes(previousLocated.startTime) + previousLocated.durationMinutes) < route.durationMinutes) warnings.push('Not enough transfer time from the previous place.');
          if (route.source !== 'routes') warnings.push(route.source === 'estimate' ? 'Transfer is a conservative estimate, not live directions.' : 'Transfer duration is unverified.');
        }
        if (s.placeId) { counts.set(s.placeId, (counts.get(s.placeId) || 0) + 1); previousLocated = s; }
        s.warnings = [...new Set(warnings)];
        if (warnings.some(w => /Outside|Overlaps|Does not|Not enough|not operational|past midnight/.test(w))) dayWarnings.push(s.name + ': ' + warnings.filter(w => /Outside|Overlaps|Does not|Not enough|not operational|past midnight/.test(w)).join(' '));
        previous = s;
      }
      day.warnings = dayWarnings.slice(0, 20);
      globalWarnings.push(...day.warnings.map(w => `Day ${day.day}: ${w}`));
    }
    for (const [id, n] of counts) if (n > 1) globalWarnings.push('A place appears more than once in the plan (' + id + ').');
    for (const s of plan.unscheduled) if (s.priority === 'must_visit') globalWarnings.push('Must-visit not scheduled: ' + s.name + '. ' + s.reason);
    plan.warnings = [...new Set(globalWarnings)].slice(0, 40);
    return plan;
  }
  function validate(raw, input) {
    const plan = normalize(raw);
    if (!plan) return ['This itinerary is not valid. Generate a new plan.'];
    const p = preferences(input || plan.constraints), errors = [];
    if (minutes(p.preferredDayStart) === null || minutes(p.preferredDayEnd) === null || p.preferredDayEnd <= p.preferredDayStart) errors.push('Day finish must be after a valid day start.');
    if (input && context(input) !== plan.contextKey) errors.push('Trip settings have changed since this itinerary was generated.');
    return [...new Set([...errors, ...refreshWarnings(plan, input || plan.constraints).warnings])];
  }
  function invalidateRoutes(plan, days) {
    for (const day of plan.days.filter(d => days.has(d.day))) {
      let previous = null;
      for (const s of day.stops) {
        delete s.routeFromPrevious;
        if (s.placeId && previous) s.routeFromPrevious = { durationMinutes: null, mode: 'UNCONFIRMED', source: 'unknown', previousStopId: previous.id };
        if (s.placeId) previous = s;
      }
    }
  }
  function edit(raw, change) {
    const plan = normalize(raw);
    if (!plan || !change || typeof change !== 'object') throw new RangeError('This itinerary cannot be edited.');
    const action = change.action || change.type, days = new Set(), target = plan.days.find(d => d.stops.some(s => s.id === change.id));
    const index = target?.stops.findIndex(s => s.id === change.id), current = target?.stops[index];
    if (action !== 'add' && !current) throw new RangeError('This stop is no longer in your itinerary.');
    if (current?.locked && !['lock'].includes(action)) throw new RangeError('Unlock this stop before changing it.');
    if (target) days.add(target.day);
    if (action === 'lock') current.locked = change.locked === true;
    else if (action === 'remove') { if (current.placeId) plan.removedPlaceIds = [...new Set([...plan.removedPlaceIds, current.placeId])].slice(-100); target.stops.splice(index, 1); }
    else if (action === 'update') {
      const values = change.values || {}, allowed = ['startTime', 'durationMinutes', 'name', 'notes', 'costAmount'];
      for (const key of allowed) if (Object.hasOwn(values, key)) {
        if (key === 'startTime' && minutes(values[key]) === null || key === 'durationMinutes' && (!Number.isInteger(values[key]) || values[key] < 5 || values[key] > 1440) || key === 'name' && !text(values[key], 180) || key === 'costAmount' && values[key] !== null && (!Number.isFinite(values[key]) || values[key] < 0 || values[key] > 100000000)) throw new RangeError('Enter a valid stop time, duration, name and non-negative cost.');
        current[key] = ['name', 'notes'].includes(key) ? text(values[key], key === 'notes' ? 600 : 180) : values[key];
        if (key === 'name') current.userEditedName = true;
        if (key === 'notes') current.userEditedNotes = true;
      }
      current.userEdited = true;
    } else if (action === 'reorder') {
      if (![1, -1].includes(change.direction)) throw new RangeError('Choose an adjacent position.');
      const next = index + change.direction;
      if (next >= 0 && next < target.stops.length) {
        if (target.stops[next].locked) throw new RangeError('Unlock the adjacent stop before reordering.');
        const adjacent = target.stops[next];
        [current.startTime, adjacent.startTime] = [adjacent.startTime, current.startTime];
        current.userEdited = true; adjacent.userEdited = true;
        [target.stops[index], target.stops[next]] = [target.stops[next], target.stops[index]];
      }
    } else if (action === 'move') {
      const destination = plan.days.find(d => d.day === Number(change.day));
      if (!destination) throw new RangeError('Choose a day within the trip.');
      target.stops.splice(index, 1); const at = Number.isInteger(change.index) ? Math.max(0, Math.min(destination.stops.length, change.index)) : destination.stops.length;
      destination.stops.splice(at, 0, current); current.userEdited = true; days.add(destination.day);
    } else if (action === 'add' || action === 'replace') {
      const destination = action === 'replace' ? target : plan.days.find(d => d.day === Number(change.day));
      if (!destination) throw new RangeError('Choose a day within the trip.');
      const addition = stop({ custom: true, kind: 'custom', locked: false, costAmount: null, currency: plan.currency, ...change.stop, userEdited: true, ...(action === 'replace' ? { id: current.id } : {}) }, plan.currency);
      if (!addition || action === 'add' && plan.days.some(d => d.stops.some(s => s.id === addition.id))) throw new RangeError('Add a stop with a unique ID, name, valid time and duration.');
      if (action === 'replace') { if (current.placeId && current.placeId !== addition.placeId) plan.removedPlaceIds = [...new Set([...plan.removedPlaceIds, current.placeId])].slice(-100); destination.stops[index] = addition; } else destination.stops.push(addition);
      days.add(destination.day);
    } else throw new RangeError('Unsupported itinerary change.');
    if (action !== 'lock' && action !== 'update') invalidateRoutes(plan, days);
    const normalized = normalize(plan);
    if (!normalized) throw new RangeError('This itinerary is at its stop limit. Remove a stop first.');
    return refreshWarnings(normalized);
  }
  function persist(raw) {
    const plan = normalize(raw);
    if (!plan) return null;
    for (const day of plan.days) {
      day.warnings = [];
      for (const s of day.stops) {
        s.warnings = []; s.dataWarnings = [];
        delete s.routeFromPrevious;
        if (s.provider === 'google' && s.placeId) {
          if (!s.userEditedName) s.name = 'Saved place — details unavailable';
          if (!s.userEditedNotes) delete s.notes;
          delete s.coordinates; delete s.openingPeriods; delete s.businessStatus;
          s.needsRefresh = true;
        }
      }
    }
    plan.unscheduled = plan.unscheduled.map(s => s.provider === 'google' ? { ...s, name: 'Saved place', reason: 'Saved selection needs refreshed details and a suitable time.' } : s);
    plan.warnings = []; plan.dataWarnings = [];
    return plan;
  }
  return { context, normalize, validate, edit, persist, preferences, purposes, stayNear, bounds, minutes, clock, date, identity, coordinate, periods, isOpen, refreshWarnings };
})();
