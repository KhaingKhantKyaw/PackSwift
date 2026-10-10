# PackSwift QA result — 11 October 2026

## Overall: FAIL (repository-wide regression gate)

The tested primary user journey passes. This is **not** a claim that the complete repository is green: the full existing suite produced **174 passes and 32 failures (206 tests)**. Most failures assert obsolete HTML, IDs, copy or navigation. These tests need individual migration to current behavioral contracts; they were not deleted or weakened to manufacture a pass.

Issues tracked: **5**. Fixed: **4**. Remaining: **1 regression-maintenance group containing 32 failing tests**.

## Bug log

| ID | Severity | Area | Reproduction / cause | Fix | Verification |
|---|---|---|---|---|---|
| PS-QA-001 | P2 | Planner checklist | Check a preparation item, then refresh without editing a form field. Form-associated checkboxes live outside the form DOM, so their events did not reach the form draft listener. | Save the draft in the checkbox change handler. | PASS: exact browser regression; checked state also survives database save and edit. |
| PS-QA-002 | P2 | Live Preview | Start a calculation then clear dates. Early return left the loading class and message active after cancellation. | Clear pending visual state before validating the next request; show an appropriate incomplete-input message. | PASS: exact browser regression. |
| PS-QA-003 | P2 | Place search errors | Provider failures were reduced to a generic message; local rate limiting returned a non-JSON body. | Sanitized, distinct public error codes/messages for configuration, billing, denied access, quota, timeout, network and request errors; JSON rate-limit response and defensive client parsing. | PASS: unit error matrix and browser rate-limit/malformed-response tests. Normal autocomplete aborts remain silent. |
| PS-QA-004 | P2 | Server / rapid navigation | Server logs showed `Hash.update(undefined)` inside rate-limit headers when an aborted request lost its socket IP during asynchronous processing. | Snapshot Express's resolved IP before asynchronous middleware, retaining its existing trust-proxy policy. Unidentifiable live requests are rejected, not allowed around limits. | PASS: socket-teardown unit tests; clean restart followed by real journey and rapid public-route sweep produced no further server errors. |
| PS-QA-005 | P3 | Regression suite | 32 tests still expect previous designs, controls or copy. Example: live-review test expects `Return flights`, while the current international exclusion is `International transport`. | Not changed in this pass; migrate each assertion without removing valid coverage. | OPEN: repository-wide `npm test` is not green. |

## Actual rendered application testing

- Started the existing Express application with `npm start`; restarted cleanly after server changes.
- Real UI signup with an isolated account, followed by Yangon → Bangkok, 3–10 December 2026, two adults, THB 30,000, Best Value, culture/food/beaches, halal, Balanced.
- Real Google Places autocomplete/details: Grand Palace, Dream World, Hua Hin Beach, Eiffel Tower Paris. Four unique provider identities persisted. The distant-place confirmation was honored.
- Actual recommendations loaded; no mock success or substituted provider data.
- Save → My Trips → Continue Planning → Itinerary → Packing → reload → Edit → Profile passed. ISO dates and budget remained unchanged, including in an America/Los_Angeles browser timezone.
- UI logout, rejected invalid password, successful login and restored saved-trip list passed.
- Separate isolated-account integration passed ownership isolation, same-ID editing, Profile/My Trips equality, cross-tab refresh, readiness reaching 100%, confirmed removal, empty state and retry behavior. Existing user accounts were not modified.
- Calendar regression passed range selection, clear, past-date disabling, today marker, December/January boundary, nights calculation and stable sizing.
- Motion regression passed rapid Next/Back, retained image/route/metric nodes, slow image loading, keyboard focus and reduced-motion behavior.
- Public routes `/`, `/#world-explorer`, `/help`, `/login`, `/signup`, `/trip-planner`, `/trips`, `/profile`: **168 viewport/theme combinations** (7 sizes × 3 themes × 8 routes) without horizontal overflow or unexpected HTTP/JavaScript errors. Guest protected routes were checked as guest entry states, not as authenticated content.
- Sizes: 1440×900, 1366×768, 1280×800, 1024×768, 768×1024, 390×844, 375×812. Themes: light, dark, system.
- Targeted unit regressions: **48 passed, 0 failed**.

## Feature status

| Feature | Result | Scope / limitation |
|---|---|---|
| Public navigation | PASS | Direct routes and rendered layout |
| Authentication | PASS | Signup, login, invalid credentials, logout, session |
| Plan Trip | PASS | Tested critical journey |
| Calendar | PASS | Selection, year transition, clear, responsive |
| Budget | PASS | Benchmarks, nonnegative allocation, unknown costs remain unknown |
| Activities | PASS | Real recommendations, selection and persistence |
| Activity photos | PASS | Real provider/proxy and card layout tests; missing-photo fallback |
| Google Places | PASS | Real global searches; sanitized failure states |
| Itinerary | PASS | Provider identity, preferences and day-trip blocks in existing scheduler |
| Map / route | PASS | Existing schematic map and route labels; not turn-by-turn routing |
| Weather | BLOCKED / not implemented | Current feature is a forecast link, not a live weather API. No live-weather race/success claim is made. |
| Packing | PASS | Render, check, persist and reload |
| Checklist | PASS | Draft persistence fixed; saved workspace readiness integration |
| Save Trip | PASS | Real database round trip |
| My Trips | PASS | Continue, edit, owner-only confirmed remove and empty state |
| Profile | PASS | Canonical counts/classification and cross-tab sync |
| Light / dark / system | PASS | Tested viewport/theme matrix |
| Responsive | PASS | Tested overflow matrix and existing component regressions |
| Browser console | CLEAN | Final critical journey; intentional error tests are separate |
| Network | CLEAN | Final journey excluding the deliberate invalid-login 401 |
| Server logs | CLEAN | After final restart, critical journey and public sweep |

## External blockers and limits

- No current Google Places key, billing or enabled-service blocker was observed. No secrets or `.env` values were changed.
- Live weather and real routing are not implemented integrations; existing links/schematic displays were preserved rather than falsely presented as live services.
- Repository-wide test maintenance remains. This prevents a complete PASS despite successful primary-flow testing.
- Test accounts and their trip data were removed after each integration run.

## Files changed in this QA pass

- `public/js/planner-studio.js`
- `public/js/place-search.js`
- `src/routes/place-search.js`
- `src/services/place-search-service.js`
- `src/middleware/request-ip.js`
- `server.js`
- `tests/place-search.test.mjs`
- `tests/request-ip.test.mjs`
- `tests/planner-qa-state.browser.mjs`
- `tests/website-qa-journey.browser.mjs`
- `tests/website-qa-public.browser.mjs`
- `docs/WEBSITE-QA-2026-10-11.md`

Changes were applied in the Documents working copy and synchronized explicitly to the running Desktop checkout. No commit or push was performed.
