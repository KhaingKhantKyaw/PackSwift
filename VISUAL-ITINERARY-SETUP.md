# Live visual itinerary setup

Run commands in your VS Code project root (the folder containing server.js).

1. Open your existing `.env`. If none exists, copy `.env.example` to `.env`; never overwrite an existing configuration.
2. Set `GOOGLE_PLACES_API_KEY` to a server key from a Google Cloud project with billing and **Places API (New)** enabled. Restrict the key to that API and, where practical, your server's outbound IP. Never expose it in public JavaScript. Rotate any key previously shared publicly.
3. Keep your existing `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `JWT_SECRET`. This feature requires no database migration.
4. `GEMINI_API_KEY` / `OPENAI_API_KEY` remain optional for the existing chat concierge. This itinerary endpoint uses deterministic travel-style ranking and geographic ordering; it does not call an LLM. Foursquare is not used.
5. Run `npm install`, then `npm start`. If a server is already running, stop it first and restart it to load environment changes.
6. Open http://127.0.0.1:3000/trip-planner and hard-refresh. Choose a destination and dates, then change travel group/purpose or the new Itinerary travel style selector. The route updates after a 500ms debounce. Old requests are cancelled and stale responses ignored.

## API test

```bash
curl -X POST http://127.0.0.1:3000/api/generate-itinerary \
  -H 'Content-Type: application/json' \
  -d '{"destination":"Bangkok","userType":"Family with Kids","duration":2,"budgetCategory":"mid","pace":"balanced"}'
```

Supported userType values: Family with Kids, Food & Culinary, Culture & Heritage, Solo / Aesthetic, Budget / Backpacker. Budget categories: budget, mid, luxury. Duration: 1–14 days.

Response contains `source`, `message`, `days`, first-day `stops`, and `partial`. With a working key expect `source: google_places`. Without a key, quota, or matching results, expect `source: sample` and visibly labelled generic sample stops. Invalid inputs return 422; excessive requests return 429.

Photos use the existing server-side photo proxy; no API keys reach the browser. Provider content is not persisted by this new service. Search is limited to 20 distinct places to bound API spend; longer routes may have unfilled days, explicitly indicated rather than duplicating stops.

Google current opening hours apply to the current week, not arbitrary future dates. Price levels are not admission quotes. Suggested stay lengths are estimates. Nearby ordering uses straight-line coordinates, not a road/transit routing API, and cannot guarantee travel times or suitability. Check each venue before departure. Google Maps links and photo credits accompany results.

Tests: `npm test`. Live Google requests incur account charges; the automated tests use injected provider fixtures and do not spend API quota.

Reference: https://developers.google.com/maps/documentation/places/web-service/data-fields
