# Phase D — practical itinerary intelligence

## Result: PASS for the implemented practical scheduling scope

Phase E has not started. Home, Explore, Help, My Trips, Profile, authentication and global navigation were not redesigned. No new routing service or paid API was enabled.

## Foundation inspection

The previous scheduler assigned places in selection order using a pace cap, tried only one day, used a generic 90-minute duration and 30-minute gap, and regenerated flexible items when preferences changed. Weekly hours handling did not account for previous-day overnight periods. Saved-workspace regeneration could replace manual assignments.

Before changes, the 21 A/B/C targeted tests passed. The actual Phase C browser journey passed custom, recommendation and search selection persistence, manual day/time restoration, optional origin/budget, the three stages, and Bangkok/Chiang Mai/Tokyo journeys. The same journeys passed after the scheduling changes.

## Scheduling algorithm

`canonical-itinerary.js` remains the only scheduler. It uses stable priority sorting, nearest-neighbor ordering and a constrained greedy day search. It tries later days when a visit cannot fit reported hours. Existing Phase D assignments do not regenerate on every render or preference change; additions receive suggestions and existing conflicts become visible. Full-day visits and day trips consume the daily pace target. Overflow remains selected and unassigned.

Explicit **Suggest a Better Schedule** opens a confirmation explaining what may move. Manually edited and locked items remain fixed. Session Undo restores the previous arrangement. The saved-workspace regeneration endpoint also protects manual edits. Its UI directs advanced scheduling to the existing Arrange editor, rather than introducing another suggestion editor.

## Geography and travel context

- Valid coordinates feed Haversine proximity grouping. Accommodation coordinates provide an initial geographic anchor, not a mandatory stop between activities.
- Optional stay name/address/coordinates/check-in/check-out and arrival/departure location, local date/time, timezone, transport and notes use existing captured form persistence.
- Hotel/arrival/departure **Find location** reuses the existing Places connection. Search happens only on explicit action; only the chosen location gets a detail request. Manual entry remains available after failure. Stale requests are ignored and changing a location clears obsolete coordinates.
- Arrival and departure buffers are adjustable planning assumptions (new UI defaults: 120 and 180 minutes). The between-stop buffer defaults to 30 minutes and is explicitly not a route estimate. Legacy missing buffer metadata retains its prior behavior.
- Optional light arrival/departure days apply when times are unknown. Travel mode is a preference, not verified routing.
- Calendar dates stay `YYYY-MM-DD`; times remain local wall time. IANA timezone identifiers are validated. Dates were tested in an America/Los_Angeles browser against a Bangkok itinerary.

## Hours, duration and conflicts

Weekly periods support split windows and overnight carryover. Explicit date exceptions are honored if supplied. Incomplete/absent hours remain unconfirmed; ordinary weekly hours are not a holiday guarantee.

Visit durations distinguish USER, PROVIDER and ESTIMATED. Category defaults are estimates; manual durations persist. Per-stop priority, lock, day, time, ordering, removal and custom/free-time entries remain editable.

Central conflict checks cover overlap (blocking for two locked overlapping visits), usable-day constraints, reported-hours mismatch, pace/time overload, unresolved transfers, missing coordinates, unassigned activities and day-trip/overnight logistics. Both conflicting activities are retained. Checks expose editing actions and “Leave unchanged”; accepted checks are invalidated when underlying planning constraints change. Derived warnings are recalculated for the saved workspace rather than stored as permanent facts.

## Persistence and API behavior

Existing canonical version 1 and owner-scoped revision protection are retained; optional schedulingVersion 2 selects explicit regeneration behavior. New item/context fields live in existing canonical/preferences/form records. No parallel itinerary, database migration, unrelated user mutation or duplicate trip collection was introduced.

Recommendation searches no longer request hours for every candidate. Additional place details are requested after selection with duplicate/stale response guards. Unknown prices remain unknown; Phase B budget calculations are unchanged.

## Verification

- **PASS:** 33 targeted unit tests (12 new Phase D cases).
- **PASS:** Phase D browser test: real hotel lookup, context persistence, manual duration/priority, locks, overlapping fixed visits, confirmation focus/Escape, session undo, backend regeneration, My Trips restoration and clean console.
- **PASS:** seven requested widths: 1440, 1366, 1280, 1024, 768, 390 and 375; no document horizontal overflow, edit controls visible.
- **PASS:** Phase C regression, 21 stage/viewport checks, recommendation/search/custom save restoration; live Bangkok, Chiang Mai and Tokyo flows.
- **PASS:** live Hua Hin Beach search and day-trip classification; real Grand Palace/Wat Pho/Wat Arun proximity, Dream World separation and arrival/departure constraints.
- **PASS:** ownership, draft restore, save/edit, domestic trip persistence, deletion/cascade/other-user isolation regression.
- **PASS:** public-route regression: eight pages × seven widths × three themes = 168 checks, clean JavaScript/HTTP responses.
- **PASS:** build and git whitespace checks.

Deterministic geographic fixtures are explicitly separate from live provider tests. Tests create isolated QA users and remove only their own test records.

## Limitations / external dependencies

- No verified routing provider is connected by this change: **Travel time not calculated**. Rivers, road connectivity, traffic and transit schedules are not modeled. Geographic distance is never presented as walking/driving time.
- Weekly provider hours may omit holiday exceptions. Unknowns require traveler verification.
- Scheduling is greedy and explainable, not mathematically optimal. Venue durations, buffers and pace targets are planning assumptions.
- IANA zones are stored/validated, but this is not a flight timezone-conversion engine. Enter arrival/departure as the destination-local travel window, as labeled.
- Meals/rest can be explicitly added as custom/free-time blocks; automatic restaurant selection is not performed. An overnight escape requires manual accommodation/transport review.
- Keyboard focus, dialog Escape and reduced-motion mode were browser-tested; a full assistive-technology audit was not performed. The guest login-popup UI journey was not newly retested in Phase D (draft restore API regression passed).
- External provider availability, billing/quota and future schedule changes remain outside the application's guarantees. No provider blocker occurred during these tests.

## Modified files

`public/css/planner-stages.css`; `public/js/canonical-itinerary.js`; `public/js/itinerary-preferences-model.js`; `public/js/itinerary-preferences.js`; `public/js/planner-stages.js`; `public/js/planner-studio.js`; `public/js/saved-trip-workspace.js`; `src/repositories/trip-workspace-repository.js`; `src/routes/place-search.js`; `src/routes/trip-workspace.js`; `src/services/google-places-service.js`; `src/services/place-search-service.js`; `tests/phase-c.browser.mjs`; `tests/phase-d.test.mjs`; `tests/phase-d.browser.mjs`; `tests/phase-d-provider.mjs`; this report.
