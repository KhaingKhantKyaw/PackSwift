# Phase C — Workflow simplification

## C1 audit (before implementation)

The current application was run through the real browser journey: Home → signup → calendar → travelers → budget → dietary/interests → four global searches → recommendations → preferences → save → My Trips → Continue → itinerary → packing → edit/restore → Profile. It passed with clean console/network output before changes.

The actual wizard has seven primary sections, not eight: Destination, Travelers, Budget, Travel Style, Activities, Itinerary Preferences, Review. `planner-studio.js` owns the form state, selected places, canonical itinerary, draft restoration and save. `canonical-itinerary.js` is the shared browser/server schedule. `trip-draft-gate.js` handles authentication handoff. The owner-scoped trips/details and workspace routes persist canonical data and revisions. `trip-context.js` provides Phase B cost/context calculations. Activity discovery and global search feed the same selection collection.

### Friction found

- Origin and budget are required even for destination-only activity planning.
- Local/Explore Anywhere asks a mode question before destination selection.
- Travelers and budget require separate steps although both are basic setup.
- Travel Style is a questionnaire separated from the recommendations it affects.
- Preferences describe assignments separately from the actual editable saved schedule.
- Review repeats the already-visible preview and creates another navigation step.
- The right pane contains route, timeline, recommendations, itinerary, packing, checklist and benchmark summaries at once, competing with the form.
- Recommendation presentation starts with 20 cards; selected places are repeated across discovery/search presentation.
- Legacy backend `createTravelPlan` still requires a supported origin and a positive budget. Making frontend fields optional alone would break Save.

## Target composition

| Existing responsibility | New location |
| --- | --- |
| Destination, dates, travelers, optional budget | Trip Basics |
| Interests, dietary choices, recommendations, global search, selected tray | Discover Places |
| Pace, typical day, actual canonical stop editing, optional stay/travel details | Arrange Your Days |
| Review | Compact contextual summary, not a step |
| Save and authentication | Existing flow at the end of Arrange |
| Map, packing, checklist | Existing persistent Trip Workspace |

## Implementation gates

C1–C6 implemented. C7 core browser/regression checks pass; full accessibility and guest UI handoff verification remain partial. No Phase D work.

## Delivered

- Three primary stages using existing controls and the existing studio state owner.
- Destination-first setup; origin and budget optional; travelers and clean calendar together.
- Legacy trip mode retained invisibly for compatibility; saved budget preferences remain available in a collapsed control.
- Interests, dietary preference, free-text interests, recommendations and global search in Discover. Eight initial recommendations, with the larger pool retained.
- Canonical selected-place tray and live add/remove feedback.
- Canonical day/time editing, earlier/later ordering, removal, custom stops and explicit free-time stops in Arrange.
- Pace, typical day, optional stay and arrival/departure local wall-time inputs. New automatic suggestions respect arrival/departure bounds; manual edits remain authoritative.
- Contextual summaries instead of a duplicate full itinerary preview.
- Existing Save/authentication gate, ownership, revisions and persistent workspace retained.
- Old seven-step navigation and separate Review removed from the active UI; unreachable fallback renderer removed. Reused controls and workspace tools were not deleted.

## Persistence and compatibility

`planner-trip.js` adapts destination-first requests to the existing trip repository. It avoids the old mandatory origin/budget generator and stores no invented weather snapshot. Legacy analyze callers keep their existing path. No database schema migration is required. An unset budget is retained in captured fields and displayed as unset in the workspace; the legacy non-null numeric column retains its storage sentinel. Existing mode/preferences are restored; legacy draft step numbers map to the three new stages. Optional travel-time preference fields are omitted when blank so old payloads remain unchanged. Canonical IDs and owner-scoped revision checks are unchanged.

## Test evidence

PASS: pre-change full authenticated browser journey.

PASS: 21 focused unit tests covering Phase A/B regressions, optional data, domestic context, currency retention and arrival/departure constraints.

PASS: Phase C browser — omitted origin/budget, no dietary/stay/arrival input, custom stop, manual day/time, forward/back navigation and exact save/reload.

PASS: real provider Bangkok (3 recommendations + 1 global search), Chiang Mai domestic and Tokyo; exact canonical assignments persisted. No mock recommendations.

PASS: all three stages at 1440, 1366, 1280, 1024, 768, 390 and 375 widths; no horizontal overflow and Next/Save visible.

PASS: 168 public-page viewport/theme checks; clean console/network. Global header and unrelated page styles were not changed.

PASS: draft restoration, ownership, safe deletion/cascade, local-trip persistence and unrelated-account preservation integration test.

PASS: build.

## Remaining verification / limitations

Overall result: PARTIAL, not a claim that every acceptance checkbox has been exhaustively verified. Guest authentication handoff was regression-tested at API level; the redesigned guest popup → login → resumed Save journey still needs a dedicated UI run. Keyboard focus/semantic labels/reduced-motion support are implemented, but a full screen-reader/contrast audit remains outstanding. Explicit manual times are preserved and can conflict with travel windows; users must verify them. Automatic transfer buffers and route-time intelligence remain Phase D, not invented here. Legacy test scripts targeting seven step indexes need migration to the new Phase C browser test before reuse.

Next recommended phase: Phase D — Practical Itinerary Intelligence, only after the remaining Phase C verification is complete and separately authorized.

## Files changed

`public/trip-planner.html`; `public/css/planner-stages.css`; `public/js/planner-stages.js`; `public/js/planner-studio.js`; `public/js/activity-discovery.js`; `public/js/date-demand-calendar.js`; `public/js/canonical-itinerary.js`; `public/js/itinerary-preferences.js`; `public/js/itinerary-preferences-model.js`; `public/js/saved-trip-workspace.js`; `src/services/planner-trip.js`; `src/services/trip-workspace.js`; `src/routes/trips.js`; `src/repositories/trip-repository.js`; `tests/phase-c.browser.mjs`; `tests/phase-c.test.mjs`; this report.
