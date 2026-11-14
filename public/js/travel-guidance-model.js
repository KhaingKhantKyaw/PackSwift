/* Presentation preferences and user-confirmed preparation, independent of trip decisions. */
globalThis.PackSwiftTravelGuidanceModel = (() => {
  'use strict';
  const ids = ['bookings', 'documents', 'arrival', 'offline', 'weather'];
  const levels = ['auto', 'detailed', 'quick'];
  const defaults = () => ({ version: 1, experience: '', detailLevel: 'auto', preparation: {} });
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const own = (value, key) => object(value) && Object.hasOwn(value, key) ? value[key] : undefined;
  const clean = (value, max = 140) => typeof value === 'string' ? value.normalize('NFKC').replace(/[<>\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase().slice(0, max) : '';
  const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : '';
  const count = (value, minimum, maximum, fallback) => {
    if (typeof value !== 'number' && typeof value !== 'string' || value === '') return fallback;
    const number = Number(value);
    return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
  };
  const revision = value => {
    const raw=typeof value==='string'?value:JSON.stringify(value||'');
    let hash=2166136261;for(let index=0;index<raw.length;index++)hash=Math.imul(hash^raw.charCodeAt(index),16777619);
    return raw.length+':'+(hash>>>0).toString(16);
  };

  function normalize(raw) {
    if (typeof raw === 'string') {
      if (raw.length > 8000) return defaults();
      try { raw = JSON.parse(raw); } catch { return defaults(); }
    }
    if (!object(raw) || own(raw, 'version') !== undefined && raw.version !== 1) return defaults();
    const state = defaults();
    if (['first', 'experienced'].includes(own(raw, 'experience'))) state.experience = raw.experience;
    if (levels.includes(own(raw, 'detailLevel'))) state.detailLevel = raw.detailLevel;
    const preparation = own(raw, 'preparation');
    if (object(preparation)) {
      for (const id of ids) {
        const context = own(preparation, id);
        // Never coerce a boolean, URL click or arbitrary object into completion.
        if (typeof context === 'string' && context.length > 0 && context.length <= 1200 && !/[\u0000-\u001f\u007f]/.test(context)) state.preparation[id] = context;
      }
    }
    return state;
  }

  function mode(raw) {
    const state = normalize(raw);
    return state.detailLevel === 'detailed' || state.detailLevel === 'auto' && state.experience === 'first' ? 'detailed' : 'quick';
  }

  function tasks(input = {}) {
    input = object(input) ? input : {};
    const state = normalize(input.travelGuidance);
    const origin = clean(input.origin), destination = clean(input.destination);
    const start = date(input.startDate), end = date(input.endDate);
    const group = [count(input.adults, 1, 9, 1), count(input.children, 0, 8, 0)];
    const route = [origin, destination, start, end];
    const contexts = {
      bookings: [...route, ...group, clean(input.entryMode, 30), clean(input.arrivalHotel || input.stay)],
      documents: [...route, ...group, clean(input.passportCountry || input.nationality, 100)],
      arrival: [destination, start, ...group, clean(input.arrivalTime, 5), clean(input.arrivalLocation), clean(input.arrivalHotel || input.stay), clean(input.entryMode, 30)],
      offline: [...route, revision(input.itineraryPlan)],
      weather: [destination, start, end]
    };
    const definitions = [
      ['bookings', 'Check bookings and key times', 'Confirm the transport and accommodation you plan to use. Save reference numbers and note check-in, meeting and cancellation times. Mark this done only after you have checked them.'],
      ['documents', 'Organize your travel documents', 'Keep the identification, confirmations and emergency contacts you plan to carry in one easy-to-reach place. Review official information for your route separately.'],
      ['arrival', 'Plan your arrival', 'Write down where you are arriving, how you will reach your first stop or stay, and who to contact if plans change. Leave a flexible buffer for finding your way.'],
      ['offline', 'Save essentials offline', 'Keep your itinerary, accommodation address, important contacts and a useful map available without a connection. Check that saved files open before leaving.'],
      ['weather', 'Review the weather near departure', 'Check an up-to-date forecast close to departure and adjust layers, rain protection and outdoor plans. Recheck if the forecast changes.']
    ];
    return definitions.map(([id, title, detail]) => {
      const context = JSON.stringify([1, id, ...contexts[id]]);
      return { id, title, detail, context, checked: state.preparation[id] === context };
    });
  }
  return { normalize, mode, tasks };
})();
