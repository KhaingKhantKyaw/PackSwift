# Search Any Place

Uses the existing server-only `GOOGLE_PLACES_API_KEY` environment variable. Do not put a key in HTML, JavaScript bundles, screenshots, tests, or Git. Rotate any key shared in chat. The existing configured key is reused; no pasted key is embedded in this change.

Enable **Places API (New)** and billing in the key's Google Cloud project. Autocomplete, Text Search, Details and Photos all use the New API. Restrict the key to Places API (New), and restrict server requests by deployment egress IP where possible. Set quotas and billing alerts. Do not use HTTP-referrer restrictions for a backend key. Routes API is not required yet.

`/api/places/autocomplete` uses one UUID session token across typing and the selected Details call. The browser rotates the token after successful details. Enter performs Text Search without pretending it belongs to an autocomplete session. Destination location is a bias, never a restriction. Details and photos are fetched only after selection. All search responses are no-store and rate-limited. Errors never forward provider response bodies or keys.

Only provider IDs and PackSwift-owned choices are persisted for `source=user_search`. Titles, photos, ratings, addresses and coordinates are refreshed when reopening a saved selection. A refresh failure retains the ID and choices, but leaves the place unscheduled rather than inventing details. No raw provider payload is saved. Existing non-search recommendation persistence is unchanged.

Google Maps attribution is displayed with results and photo author names with the selected image. Public Terms and Privacy pages must reflect Google Maps usage before production launch. Review the applicable regional terms and attribution requirements:
- https://developers.google.com/maps/documentation/places/web-service/policies
- https://developers.google.com/maps/documentation/places/web-service/place-session-tokens

Location classifications use coordinates and straight-line distance, explicitly not road distance or travel time. Day trips reserve a whole day including outbound travel, a meal/rest break and return travel. Long-distance places require confirmation and remain in an explicit side-trip planning list until transport/dates are arranged. Unknown fares are not added as fabricated budget numbers. The preview flags additional transfers needing quotes.

`PlaceSearchService` is the provider adapter. `place-search-model.js` provides shared identity, reference-only persistence and scheduling. Replace the adapter to support another POI provider. A future Routes adapter can replace the distance-only context with actual journey durations; no stations or timetables are invented now.

Tests:
```
node --test tests/place-search.test.mjs tests/activity-recommendations.test.mjs
node tests/place-search.browser.mjs
```
Browser tests accept PLAYWRIGHT_MODULE, CHROME_PATH and PLANNER_TEST_URL.
# Troubleshooting search failures

Development server logs preserve the provider HTTP status, error code and sanitized
message. API keys, queries, session tokens and raw response bodies are not logged.
Production responses remain generic. Missing credentials and provider 401/403
responses show “Places API is not configured.” only in development.

If Google reports `PERMISSION_DENIED` with “Places API (New) … disabled”, enable
`places.googleapis.com` in the project associated with the key. Verify billing and
server-appropriate API/IP restrictions; do not disable restrictions. Allow a few
minutes for propagation, then restart the development server after `.env` changes.
An unexpected local 401 when the current `/places` router is public can indicate a
stale server process: restart the correct checkout rather than removing auth from
unrelated trip routes.
