# Editable itinerary upgrade — 6 November 2026

## What changed

The existing Itinerary panel now starts with **Build my itinerary**. This is an explicit action, not a generation request on every keystroke. It creates a first draft from dates, all selected purposes, spending style, pace, walking/rest preferences, arrival/departure times, preferred stay area, liked/disliked activities and selected places. A selected place is prioritized without preventing discovery for the remaining purposes.

The editor provides day tabs, time/duration/name/notes/cost editing, moving between days, reordering, replacement from the shortlist, removal, fixed stops, personal/meal/rest stops and Undo. Rebuilding a day shows a preview before acceptance. Other days remain unchanged. Fixed, personal and manually edited stops are preserved; removed provider places are not reintroduced during rebuilding.

The existing places/arrival/preferences tools remain available below the editor. Booking, activities, packing, the final budget and account-gated Save planning remain connected. The panel keeps its existing scroll and Expand behavior rather than growing to the entire itinerary height.

Saved trips reopen this same editable plan. My Trips displays its day timeline and links back to the editor instead of exposing the legacy regeneration actions. Existing manually edited legacy timelines are imported as fixed personal stops; missing legacy times are explicitly marked provisional. Print/save summary includes every itinerary day.

## Accuracy and limits

- Places come from the existing Google Places integration; no attraction, rating or price is invented. Discovery is finite (up to 24 detailed venue references per request), so long trips can retain free time and unscheduled choices.
- Regular opening periods are used when available. Special dates, holidays, last entry, tickets and suitability still need confirmation. Unavailable details stay clearly labeled.
- Nearby grouping uses known place coordinates and a resolved stay/area preference. It is a heuristic, not a globally optimal route.
- Set server-only `GOOGLE_ROUTES_API_KEY` with Google Routes API enabled for route-duration estimates. Without it—or on provider failure—the UI labels conservative transfer allowances as approximate. Routes are not claimed to be a timetable for a distant travel date.
- First/last hotel transfers are not verified. Weather forecasts remain connected to packing; automatic weather-driven itinerary rescheduling is not implemented.
- Unknown tickets, meals and transport costs are not counted as free. Entered costs retain their own currency; no silent conversion is performed.
- A date/destination change does not silently move or erase fixed/custom/edited commitments. Review those commitments before rebuilding for different dates or another city.
- Guests can generate and edit. Account saving still requires login. Provider content is refreshed on reopening; durable records retain IDs and user decisions rather than copying Google names/hours/photos/coordinates.
- This implementation targets the local Node/MySQL app. Hosted-worker parity is still separate work. No new database migration is needed beyond the previously documented migration 022.

## Verification

- Build passes.
- 33 focused itinerary/connected-planning tests pass, including multi-purpose discovery, explicit selections, dislikes, opening-hour constraints, arrival boundaries, routes fallback, fixed/manual edits, ownership and persisted decisions.
- Six browser workflows pass: combined planner layout, in-place activity dismissal, activity discovery, booking preview, connected planning and editable itinerary.
- The editable browser workflow checks saved-trip reopening, day rebuild preview/cancel, Undo, fixed-stop guards, keyboard day navigation, 390px/1100px layouts and key dark-mode text contrast.
- The real local MySQL test creates temporary records inside a transaction and rolls everything back. It verifies itinerary time, lock, custom name, notes/cost storage and existing packing/ownership behavior.
- Provider responses are simulated in automated tests; these checks do not claim live venue accuracy or make reservations.
- Full suite: 273 tests, 239 passing, 34 failing legacy UI/source assertions. The same 34 failures existed before this upgrade; they were not hidden or weakened.

## Provider references

- [Google Routes computeRoutes](https://developers.google.com/maps/documentation/routes/reference/rest/v2/TopLevel/computeRoutes)
- [Compute route directions](https://developers.google.com/maps/documentation/routes/compute_route_directions)
- [Google Places fields and opening hours](https://developers.google.com/maps/documentation/places/web-service/reference/rest/v1/places)
