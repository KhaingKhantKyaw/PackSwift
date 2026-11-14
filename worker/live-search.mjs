// Public, on-demand planner reads. They do not require a hosted account or a database.
import { searchBooking } from '../src/services/booking-search.js';
import { bookingExchangeRate } from '../src/services/booking-exchange-rate.js';
import { activityTopics, activityStyles } from '../src/services/activity-discovery-plan.js';
import { PlaceSearchService, placeSearchFailure } from '../src/services/place-search-service.js';
import { fetchGooglePlacePhoto } from '../src/services/google-places-service.js';

const json = (body, status = 200, extra = {}) => Response.json(body, {
  status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra }
});
const failure = (message, status, extra) => json({ error: message, message }, status, extra);
const problem = (message, status) => Object.assign(new Error(message), { status });
const placeId = /^[a-zA-Z0-9_-]{10,255}$/;
const sessionId = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const placeMethods = new Map([['popular-activities','popularActivities'],['transport-autocomplete','transportAutocomplete'],['autocomplete','autocomplete'],['search','textSearch']]);
const counters = new Map();
const limits = { booking: 6, place: 45, photo: 90 };
let windowNumber = -1;

// Small per-isolate limit before a billable request (CF sets the address header).
function remainingTimeIfLimited(request, category) {
  const now = Date.now(), current = Math.floor(now / 60_000);
  if (windowNumber !== current) { counters.clear(); windowNumber = current; }
  const key = category + ':' + (request.headers.get('CF-Connecting-IP') || 'unknown');
  const n = counters.get(key) || 0;
  if (n >= limits[category] || (!n && counters.size >= 8192)) return 60 - Math.floor(now / 1000) % 60;
  counters.set(key, n + 1); return 0;
}

async function readSearch(request) {
  if ((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw problem('Send the trip details as JSON.', 415);
  }
  const limit = 16_384;
  if (Number(request.headers.get('content-length')) > limit) throw problem('Trip search is too large.', 413);
  let bytes = 0, text = '';
  const reader = request.body?.getReader(), decoder = new TextDecoder();
  if (!reader) throw problem('Trip details are missing.', 400);
  try {
    for (;;) {
      const {done, value} = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { void reader.cancel(); throw problem('Trip search is too large.', 413); }
      text += decoder.decode(value, {stream:true});
    }
    const body = JSON.parse(text + decoder.decode());
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
    return body;
  } catch (err) { if (err.status === 413) throw err; throw problem('Enter valid trip details.', 400); }
  finally { reader.releaseLock(); }
}

function placeInput(url, method, id) {
  const get = key => url.searchParams.get(key) ?? undefined;
  const input = {id, query:get('q')?.trim(), destination:get('destination')?.trim(), sessionToken:get('sessionToken'),
    purpose:get('purpose'), style:get('style'), variant:get('variant'), pageToken:get('pageToken')};
  if ((input.destination?.length || 0) > 150 || (input.sessionToken !== undefined && !sessionId.test(input.sessionToken)))
    throw problem('Choose a valid destination and try again.', 422);
  if (method === 'popularActivities') {
    if (!input.destination || input.destination.length < 2 || (input.purpose !== undefined && !Object.hasOwn(activityTopics,input.purpose)) ||
        (input.style !== undefined && !Object.hasOwn(activityStyles,input.style)) ||
        (input.variant !== undefined && !/^[0-2]$/.test(input.variant)) || (input.pageToken !== undefined && (!input.pageToken || input.pageToken.length > 8192)))
      throw problem('Choose a destination and valid activity preferences.', 422);
  } else if (method !== 'details' && (!input.query || input.query.length < 2 || input.query.length > 200)) {
    throw problem('Enter a place with 2–200 characters.', 422);
  }
  return input;
}

export async function handleLiveSearch(request, env, url) {
  const booking = /^\/api\/booking-search\/(flights|hotels)\/?$/.exec(url.pathname);
  const place = /^\/api\/places\/([^/]+)\/?$/.exec(url.pathname);
  const photo = /^\/api\/activities\/photo\/([^/]+)\/?$/.exec(url.pathname);
  if (!booking && !place && !photo) return null;
  const method = booking ? 'POST' : 'GET';
  if (request.method !== method) return failure('Method not allowed.',405,{ allow:method });
  const origin = request.headers.get('origin');
  if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return failure('Cross-origin search is not allowed.',403);
  const operation = place && (placeMethods.get(place[1]) || 'details');
  if ((photo && !placeId.test(photo[1])) || (operation === 'details' && !placeId.test(place[1]))) return failure('Invalid place identifier.',422);
  try {
    const input = booking ? await readSearch(request) : place ? placeInput(url, operation, place[1]) : null;
    const delay = remainingTimeIfLimited(request,booking?'booking':photo?'photo':'place');
    if (delay) return failure('Too many searches. Please try again in a minute.',429,{'retry-after':String(delay)});
    // Empty strings deliberately override Node defaults: secrets come only from worker bindings.
    if (booking) return json(await searchBooking(booking[1],input,{
      key:env.SERPAPI_API_KEY || '', rateProvider:target=>bookingExchangeRate(target,{key:env.EXCHANGERATE_API_KEY || ''})
    }));
    if (photo) {
      if (!env.GOOGLE_PLACES_API_KEY) return failure('Place photo unavailable.',404);
      const response = await fetchGooglePlacePhoto(photo[1],{apiKey:env.GOOGLE_PLACES_API_KEY});
      const type = response?.headers.get('content-type') || '';
      if (!response || !/^image\/(?:jpeg|png|gif|avif|webp)(?:;|$)/i.test(type)) return failure('Place photo unavailable.',404);
      return new Response(response.body,{headers:{'content-type':type,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
    }
    const service = new PlaceSearchService({apiKey:env.GOOGLE_PLACES_API_KEY || ''});
    try { return json(await service[operation](input)); }
    catch (error) { const {status,...body} = placeSearchFailure(error);return json(body,status); }
  } catch (error) {
    if (photo) return failure('Place photo unavailable.',error.status===429?429:502);
    return failure(error.status ? error.message : 'Travel search is temporarily unavailable.',error.status||503);
  }
}
