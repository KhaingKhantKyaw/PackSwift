import '../../public/js/itinerary-plan-model.js';
const model = globalThis.PackSwiftItineraryPlanModel;

export function straightLineKm(a, b) {
  if (!model.coordinate(a) || !model.coordinate(b)) return null;
  const rad = n => n * Math.PI / 180;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2)));
}

export function estimateTransfer(from, to, mode = 'TRANSIT') {
  const km = straightLineKm(from?.coordinates, to?.coordinates);
  // A generous planning allowance, not a predicted route, fare, or timetable.
  const allowance = km === null ? 45 : mode === 'WALK' ? km * 1.4 / 3 * 60 + 10 : km * 1.5 / 20 * 60 + 25;
  return { durationMinutes: Math.min(1440, Math.max(15, Math.ceil(allowance / 5) * 5)), mode, source: km === null ? 'unknown' : 'estimate', previousStopId: from.id };
}

export class ItineraryRoutingService {
  constructor({ apiKey = process.env.GOOGLE_ROUTES_API_KEY, fetchImpl = globalThis.fetch, maxCalls = 16, timeoutMs = 5000 } = {}) {
    this.apiKey = apiKey; this.fetch = fetchImpl; this.calls = 0; this.maxCalls = Math.max(0, Math.min(16, maxCalls)); this.timeoutMs = Math.max(100, Math.min(5000, timeoutMs));
  }
  async route(from, to, mode = 'TRANSIT') {
    const fallback = estimateTransfer(from, to, mode);
    if (!this.apiKey || this.calls >= this.maxCalls || !['TRANSIT', 'WALK', 'DRIVE'].includes(mode)) return fallback;
    const waypoint = s => s.provider === 'google' && /^[A-Za-z0-9_-]{10,255}$/.test(s.placeId || '') ? { placeId: s.placeId } : model.coordinate(s.coordinates) ? { location: { latLng: model.coordinate(s.coordinates) } } : null;
    const origin = waypoint(from), destination = waypoint(to);
    if (!origin || !destination) return fallback;
    this.calls++;
    try {
      const response = await this.fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.apiKey, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters' },
        body: JSON.stringify({ origin, destination, travelMode: mode, languageCode: 'en', units: 'METRIC' }), signal: AbortSignal.timeout(this.timeoutMs)
      });
      if (!response.ok) return fallback;
      const route = (await response.json()).routes?.[0];
      const seconds = typeof route?.duration === 'string' && /^\d+(?:\.\d+)?s$/.test(route.duration) ? Number.parseFloat(route.duration) : NaN;
      if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 86400) return fallback;
      return { durationMinutes: Math.ceil(seconds / 60), mode, source: 'routes', previousStopId: from.id,
        ...(Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0 ? { distanceMeters: Math.round(route.distanceMeters) } : {}) };
    } catch { return fallback; }
  }
}
