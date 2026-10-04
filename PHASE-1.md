# Saved Trip Workspace — Phase 1

Uses the existing `trip_sessions`, `itinerary_timeline_items`, and `packing_lists` tables. No migration or replacement database is required. Requirements review timestamps, missing-item IDs and the optimistic concurrency revision are stored under `preferences_json.workspace`. Exact planner form fields remain under `detailPlanning`. Itinerary edits update the existing timeline table; packing ownership updates the existing packing table.

## Run

1. Start the project's configured MySQL/MariaDB database.
2. Run `npm start` from this project (restart after backend changes).
3. Open `/trip-planner`, complete the form, and choose **Save & Continue Planning**.
4. Guests use the existing 20-minute database draft and login/signup return flow.
5. Successful save opens `/trips/{tripId}`. `/trips` lists account-owned trip sessions. The older `/my-trips` collection remains accessible without deleting or migrating user data.

## Verify

- Review requirements, refresh, and confirm the review timestamps persist.
- Edit an itinerary title/time/day, save, and reload. Regeneration asks before replacing edits.
- Mark packing items **I Have It** / **I Need It**, reload, and verify progress.
- Open a second tab and try saving an outdated revision: it must be rejected, not overwrite newer state.
- Editing trip basics resets requirements/itinerary review completion; review the itinerary against revised dates and regenerate if needed. Packing choices are retained.
- Another user must receive 404 for this trip; anonymous API access must receive 401.

Unit tests: `node --test tests/trip-workspace.test.mjs tests/draft-fields.test.mjs`

Optional database integration test (creates then deletes isolated test users):
`PHASE1_TEST_URL=http://127.0.0.1:3001 node --env-file=.env tests/trip-workspace.integration.mjs`

## Scope

Readiness covers Phase 1 only: saved details, user-reviewed requirements, reviewed itinerary and prepared packing. It is not a safety/entry clearance, and does not claim flights or stays are booked. Requirements are verification prompts, not live immigration rules. Missing items are saved but do not open a shopping flow. Phase 2–4 recommendation/booking/commerce work is not implemented here.
