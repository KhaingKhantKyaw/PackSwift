# Itinerary Preferences — Phase 1

Only preference collection and persistence are implemented. The existing layout and route/date grouping remain; the flow is Destination (including dates), Travelers, Budget, Travel Style, Activities, Itinerary Preferences, Review.

## Reused architecture
- `planner-studio.js` still owns selected activities. The new step receives references to that array; preferences contain activity IDs, not duplicate place records.
- The existing `pace` control has moved into the new step and stays synchronized with `tripPace`.
- `itinerary-preferences-model.js` is the shared browser/backend schema, normalizer and validator. Explicit day/time choices derive `isUserLocked`; changing planning mode does not discard them.
- The new controller uses the current form controls, expandable details, typography and theme tokens.
- The existing owner-scoped `PUT /api/trips/:id/details` stores one structured `detailPlanning.itineraryPreferences` object. The serialized transport field is removed from saved form fields to avoid conflicting copies. No database migration is needed.
- The existing 20-minute authentication draft retains the hidden preference payload. A user/trip-scoped, 20-minute session draft also restores unfinished work after refresh in the same tab. Successful account saving clears that tab draft. A fresh route uses a separate draft key.
- Saved workspace overview shows the saved planning style and a shortcut to edit preferences. Removing an activity removes its preference reference.

## Defaults and validation
Plan Together, Balanced, 09:00–21:00, Any Day, Any Time and Would Like. Customization is optional, including when no activities have been selected. Specific Time requires a valid clock time. Shortening dates preserves a now-out-of-range preferred day and asks the user to adjust it before saving; it is never silently moved.

## Deliberately deferred
Phase 2 constraint-aware generation and Review & Generate integration; Phase 3 conflicts, reliable opening hours and route/buffer heuristics; Phase 4 generated-itinerary editing and lock-aware regeneration. The existing itinerary is not represented as having applied these new preferences.

## Tests
`node --test tests/itinerary-preferences.test.mjs tests/planner-studio.test.mjs tests/draft-fields.test.mjs tests/trip-workspace.test.mjs`

`tests/itinerary-preferences.browser.mjs` uses six mocked test activities to check customization, mode/pace, refresh, removal synchronization and mobile overflow. It accepts the same installed-Playwright environment variables as `planner-controls.browser.mjs`.

The existing opt-in `trip-workspace.integration.mjs` additionally checks preference draft restoration, database round-trip, owner enforcement and rejection of invalid times without overwriting saved preferences. Temporary accounts are removed in `finally`.
