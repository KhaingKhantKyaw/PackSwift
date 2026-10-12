# Phase A — one canonical trip and itinerary

Result: PASS for the Phase A acceptance flows, tested against the local running app on 2026-10-11. Phase B has not started. No schema reset, account deletion, visual redesign, Routes API, or AI work was performed. Isolated QA accounts were cleaned up after testing.

## Root cause and old flow

The planner held selected activities separately from its live review. Live review used independent selection scheduling or generic destination-generated days. Saving invoked `buildDetailedTimeline`, while the saved workspace also built a selected schedule only when a `user_search` source was present. Consequently, recommendation-only selections could disappear behind dozens of generated stops; search selections could appear in a separate itinerary. Day/time editing affected different data than preview.

Old flow:

Discovery → selected state → independent preview schedule

Save → generated timeline table → workspace, sometimes with an additional search-only schedule

## New source of truth and ownership

Discovery → stable selected places → canonical itinerary → same preview → saved trip preferences → workspace / My Trips / Edit Trip

- Existing `trip_sessions.public_id` and `user_id` remain trip identity and ownership. No duplicate trip table was introduced.
- Existing captured `detailPlanning.fields` remain the authoritative edited route, dates, travelers, budget and preferences; older columns are fallback only.
- `public/js/canonical-itinerary.js` owns selected-place identity, deduplication, simple day allocation, pace limits, validation, legacy normalization, and display-row projection. It runs in browser and server.
- `preferences_json.canonicalItinerary` stores version 1: `selectedPlaces`, `items`, and a preference signature. Each item has stable ID, selectedPlaceId, type, day (nullable for unassigned), time, order, notes and userModified.
- Sources normalize to recommendation, user_search or custom. Sources do not gate scheduling. Provider IDs take precedence; custom activities receive UUID-backed identities. Similar custom names are not deduplicated.
- `planner-studio.js` owns the current canonical draft and its existing 20-minute session draft. Saved-trip drafts include a revision; a stale draft cannot overwrite a newer workspace revision.
- `planner-workspace.js` renders canonical items, not fallback attraction suggestions. An empty day shows free time, not invented selections.
- `live-review.js` projects the same canonical itinerary alongside existing estimates and reminders. It no longer invokes the generic itinerary generator.
- `canonical-trip.js` is the persistence/hydration adapter. Search provider references continue using the existing reference-only storage and refresh behavior; failed provider refresh keeps identity.
- `trips.js` persists the submitted canonical itinerary. `trip-repository.js` skips generic timeline creation for canonical requests.
- `trip-workspace-repository.js` returns canonical rows and itinerary. My Trips and Profile share this repository; Continue Planning and Edit Trip read the same saved state.
- `trip-workspace.js` applies owner-scoped, revision-checked transactions for edits, custom additions, removal and explicit regeneration.

## Editing and scheduling semantics

- Workspace supports changing day/time/title/notes, moving up/down, adding custom activities and removing activities.
- Remove means remove from both the itinerary and selected places; related activity preferences are pruned. No orphaned selected-place references remain.
- Order is the stable stored item order within each day; changing a day does not change identity.
- Manual edits are marked `userModified` and preserved during preference recalculation. Explicit full regeneration resets arrangement only, using the same selected places, never new recommendations.
- Pace has one source: relaxed 2, balanced 3, packed 4 maximum automatically assigned activities/day. UI labels, recommendation demand and compatibility scheduling use that source. A day trip reserves a whole day. Overflow and long-distance places remain selected but unassigned; nothing is silently discarded.
- Shortening dates past an assigned activity is rejected instead of silently moving it. Users can move it first. Explicit user edits may exceed an automatic pace cap.
- Save preserves the currently previewed itinerary; recommendations that were not added never become saved activities.
- The old timeline endpoint now returns the canonical projection and directs edits to the workspace. It no longer invokes a second generator. The old search scheduler is a compatibility projection of the canonical model.

## Compatibility and database safety

No destructive migration or schema change. Older timeline records are normalized on read into stable `legacy:<row id>` selected places and `legacy-item:<row id>` items, retaining their edited title/time/description/day. Existing saved selections are also retained rather than silently discarded. This deliberately preserves historical generated entries; Phase A does not guess which old entries a user intended to delete. The canonical representation is stored on the next edit/save. Legacy table rows remain for compatibility but are not read as the active itinerary after a canonical version exists.

Trip ownership is checked at the backend. Workspace edits are transactional and revision checked. Other trips, user accounts, packing and preparation storage retain their existing ownership relationships. Older non-planner creation entry points are normalized on workspace read; their historical generator is not used to replace canonical trips.

Domestic/international classification uses normalized origin/destination country codes through shared `trip-context.js`, independent of Local/Explore mode. Bangkok → Chiang Mai remains domestic after saving. Domestic saved preparation shows accommodation/insurance and carrier-ID guidance, not passport/visa entry cards.

## Verification

`tests/canonical-trip.browser.mjs`: actual Chrome, real recommendation/search provider, live Express server and MySQL, isolated account.

| Case | Result | Evidence |
| --- | --- | --- |
| A | PASS | Yangon → Bangkok, Dec 3–10 2026, two adults. Exactly three real recommendation selections remain three, same names and IDs, through My Trips / Continue. Final run: Counter Culture Bangkok, Culture Café, Bangkok 1899 at Ban Chao Phraya Thammasakmontri. |
| B | PASS | Real Lumpini Park search joins recommendations in the same itinerary; a separate Bangkok trip with exactly one recommendation and one search result restores exactly two items. |
| C | PASS | Same provider identity submitted through the second source remains one selected activity. |
| D | PASS | Bangkok → Chiang Mai remains domestic in live-review response, saved workspace context and rendered requirements. |
| E | PASS | Day 2 → 3, time 11:30, notes and move-down order persist after save/reload and subsequent Edit Trip/save. Same trip ID; no accidental duplicate. |
| F | PASS | Browser refresh restores the draft's exact itinerary identities, assignments and ordering without regeneration. |

Additional verification:

- Build passed.
- 36 focused unit tests passed across canonical itinerary, live review, workspace, provider search, recommendations, preferences and travel scope.
- Existing workspace integration passed: owner isolation, stale revision rejection, legacy details compatibility, packing persistence, safe removal and cascading cleanup.
- Full real-provider browser journey passed: Home → UI signup → dates/travelers/budget → preferences → four global searches → recommendations → save → My Trips → itinerary → packing toggle/reload → Edit Trip → Profile → invalid/valid login.
- Public-route regression passed: Home, Explore, Help, Login, Signup, Plan Trip, My Trips and Profile; 168 viewport/theme checks across light, dark and system themes.
- Console: CLEAN in acceptance/regression browser runs.
- Network: CLEAN; the journey test intentionally verifies one rejected invalid-password login.
- During testing, a hidden restored calendar made the initial test wait inappropriate; the wait now follows restored state. Saved-form initialization also prevents input until restoration completes, and regression waits for that readiness signal.

## Preference propagation / remaining Phase B issues

- Pace, selected places and per-place day/specific-time preferences are consumed by the shared basic allocator.
- Interests/notes influence discovery; they do not replace user-selected activities.
- Dietary preferences persist but do not yet enforce meal selection or restaurant eligibility.
- Typical-day start/end and broad morning/afternoon/evening preferences persist but are not a duration-aware time optimizer. Planning-mode labels do not currently select different optimization engines.
- No route-time optimization, opening-hours constraints, booking verification or live-fare integration was added. Existing budget estimates, packing and provider-content storage policy were not rebuilt.
- Legacy generated items are intentionally preserved; cleanup requires explicit user editing, not heuristic deletion.

## Changed files

Browser: `public/trip-planner.html`; `public/js/canonical-itinerary.js`, `planner-studio.js`, `planner-workspace.js`, `saved-trip-workspace.js`, `place-search-model.js`, `activity-recommendation-model.js`, `itinerary-preferences-model.js`, `itinerary-preferences.js`, `tripEngine.js`.

Server: `src/services/canonical-trip.js`, `live-review.js`, `trip-workspace.js`, `place-search-service.js`, `activity-recommendations.js`; `src/repositories/trip-repository.js`, `trip-workspace-repository.js`; `src/routes/trips.js`, `trip-workspace.js`.

Tests: `tests/canonical-itinerary.test.mjs`, `canonical-trip.browser.mjs`, `live-review.test.mjs`, `website-qa-journey.browser.mjs`.

This document: `docs/PHASE-A-CANONICAL-TRIP.md`.
