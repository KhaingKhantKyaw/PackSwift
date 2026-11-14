# Connected planning upgrade — November 2026

## Implemented in the local Node/MySQL app

- Activities use all selected purposes and spending style. Disliked cards fade and are replaced in the same slot, without moving the pointer target. Results are bounded by available provider matches, not literally infinite.
- Interested activities appear in a shared itinerary shortlist. Liking is separate from scheduling: choose a day and use **Add to day**. Removing an interest does not silently delete an already scheduled stop.
- Daily pace, walking comfort and rest breaks are independent of spending style and available to guests. Manual scheduling leaves unassigned places flexible; automatic scheduling distributes them. Specific-time conflicts use a basic duration/buffer heuristic, not live routing.
- The feature board uses four columns on wide screens, two on medium screens and one on phones. Panels stay scrollable and can be expanded individually. Existing arrival, activity-details, packing, booking and footer actions remain available.
- Child ages, destination-specific stay-near text and current trip details travel with search requests. Changes clear stale results; late responses cannot replace a newer search.
- Packing uses date-specific weather when available and distinguishes per-traveler quantities from shared quantities. Categories, custom items, removal, undo and packed progress are retained.
- The final budget is flight total + stay total + desired daily group spending × trip days. Currency is visible. Unfinished amounts save as unknown, not zero. Saving requires login and writes canonical trip facts and the editable draft together.
- Packing IDs and newer completion progress survive resaving. Budget/packing-only edits retain a manually edited saved itinerary; changed scheduling inputs invalidate the old schedule.
- Saved profile preferences are applied explicitly; the interface describes only settings actually connected.

## Setup

Run `node scripts/migrate-planner-draft.mjs` before using the new draft endpoint. Migration 022 makes `trip_sessions.budget_amount` nullable; existing amounts are unchanged. Normal database initialization also includes it.

Weather uses Open-Meteo. Local development can use the public endpoint; production requires a server-only `OPEN_METEO_API_KEY` for the customer endpoint. Only dates actually returned within the provider horizon are shown. Trips beyond it show an unavailable message, not invented weather. See [Open-Meteo documentation](https://open-meteo.com/en/docs).

Infants remain distinct from one-year-olds in the UI. Hotel requests map age zero to the provider's age-one convention only at the API boundary. See [SerpApi hotel parameters](https://serpapi.com/google-hotels-api).

## Deliberately not restored

- Guide Me questionnaire / Plan with confidence banner.
- Large budget worksheet and Use in budget actions.
- Silent default purpose or spending-style choices.

## Still outside this upgrade

- Guaranteed minimum budgets, verified group booking totals or automatic conversion of provider quotes.
- Guaranteed route optimization, verified accessibility or venue suitability. The [editable itinerary upgrade](itinerary-upgrade.md) adds heuristic nearby grouping, regular-hours checks and optional Google route-duration estimates.
- Forecasts beyond the provider horizon.
- Automatic booking: external links remain comparison/booking-site handoffs.
- Hosted worker parity for the new Node/MySQL draft and forecast endpoints.

## Verification

- Targeted model/service tests cover draft amounts, owner scoping, dates, traveler limits, manual scheduling, time conflicts, forecast coverage, infant mapping and packing reconciliation.
- Browser checks cover combined setup/overview, purpose selection, in-place replacement, undo/refill, login restoration, shortlist/day assignment, age and stay-near invalidation, weather packing, themes, expand controls and responsive overflow.
- Browser provider and account responses are mocked; no real booking or user account is changed by those checks.
- Build and 61 focused tests pass. Five browser workflows pass. A real MySQL integration check verifies inserts/updates, ownership, packing progress and manual-itinerary preservation in a rolled-back transaction.
- Migration 022 has been applied to the local database. The verified source files have been copied to the running Desktop project.
- Full suite: 215 passing, 34 failing legacy UI/source assertions. The unchanged Desktop baseline has the same 34 failures (206 passing); this upgrade adds nine passing tests. Existing failures were not hidden or weakened.

The newer editable-itinerary implementation and current verification totals are documented in [itinerary-upgrade.md](itinerary-upgrade.md).
