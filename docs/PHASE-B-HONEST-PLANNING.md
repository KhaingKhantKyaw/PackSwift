# Phase B — Honest planning

## Scope and status

Phase B only; no redesign or Phase C work. Phase A canonical itinerary remains the source of truth. Core acceptance scenarios A–E PASS. Full product capability remains PARTIAL because live quotes, verified dietary certification, route travel times and live weather are not provided.

## Cost model

`PackSwiftTripContext.budgetSummary` is shared by the browser and server review. User budget is a spending ceiling, not a quote. Optional transport, stay, food, activities, local transport and shopping costs are USER_ENTERED in the selected currency. Explicit zero is valid; blank is UNKNOWN. Food and local transport can use ESTIMATED internal benchmark ranges. Emergency reserve is ALLOCATED and excluded from the expense subtotal. Unknown transport, accommodation and tickets are never replaced with invented prices. Partial totals list missing categories and cannot establish complete affordability. Currency changes clear optional costs rather than silently converting or relabelling them. No PROVIDER_QUOTED costs are currently available.

Existing destination benchmarks remain planning allowances, not selected hotel, flight or attraction prices. Visa, insurance and other extras require separate verification.

## Preferences and their consumers

| Preference | Effect |
| --- | --- |
| Interests / notes | Recommendation category queries, coverage and ranking |
| Travel style | Nature, culture or leisure category weighting |
| Lowest cost / fixed budget | Qualitative provider price-level ranking when available |
| Stay style | Internal accommodation benchmark, not a hotel quote |
| Halal / vegetarian / vegan | Changes food provider queries; possible matches remain unverified |
| Pace | Canonical daily caps: relaxed 2, balanced 3, packed 4 |
| Typical day start/end | Suggested schedule window |
| Preferred day/time | Scheduling constraints; conflicts remain unassigned |
| Manual itinerary edits | Preserved during recalculation and save/restore |

Provider keyword matches are POSSIBLE_MATCH, never certification. Other dining results are UNKNOWN. Confirm ingredients, preparation and allergy suitability with the venue. Dietary query matches are reserved in the visible results so general food ranking cannot bury all of them.

## Scheduling and context

Known structured opening periods constrain suggested slots. Unknown hours remain tentative. Duration defaults and a planning buffer are not route-time calculations. Regional escapes require transfer verification. Country codes determine domestic/international context; missing codes remain unknown. Nationality is optional and never inferred from departure city. Weather links open an external forecast; no invented forecast is displayed.

## Reliability and persistence

Recommendation and review requests retain abort/revision/signature guards against stale responses. Dietary preference and planning goal participate in recommendation invalidation. Provider errors/unavailability remain explicit; hardcoded fallback attractions were removed. Missing provider ratings and prices remain null. Canonical IDs, manual edits, preferences and cost fields use existing persistence. No user account migrations or deletions are required.

## Verification

- PASS: build.
- PASS: 37 focused unit tests, including unknown costs, currency isolation, all three dietary queries, provider failure, opening windows, manual edits and route context.
- PASS: real-provider/database/browser scenarios A Yangon–Bangkok, B Bangkok–Chiang Mai and C Bangkok–Tokyo.
- PASS: D unknown transport/stay and E identical canonical itinerary/preferences/budget restoration.
- PASS: Phase A browser regression: recommendation + search, deduplication, edits/order/time/notes, draft refresh and domestic trip.
- PASS: ownership, draft restoration, safe deletion/cascade and unrelated-trip preservation integration tests.
- PASS: 168 viewport/theme checks across eight public/protected-entry routes; no console/network failures.
- PASS: authenticated end-to-end journey through signup, dates, travelers, budget, dietary/interests, global search, recommendations, preferences, save, My Trips, itinerary, packing, edit/restore and Profile; console/network clean.
- Manual limitation: no dedicated delayed-response race simulation was added in this pass; existing stale-response guards were inspected.

Tests create isolated QA accounts and remove only their own records. Browser fixtures omit optional field type instead of falsely labelling selects as text; production typed restore matching was not weakened.

## Remaining Phase C/D work

Actual flight/hotel/transport quotes, verified dietary evidence, routing/transfer durations, richer hours/holiday constraints, global destination geocoding beyond the current catalog, and dedicated concurrent response race coverage remain future work. Do not present these as completed or automatically proceed into those phases.
