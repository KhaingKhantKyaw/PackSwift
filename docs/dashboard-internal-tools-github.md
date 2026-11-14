# Internal-first dashboard tools

This extends the signed-in dashboard, keeping official external links available without making users leave for routine planning.

## Changes

- Saving one dashboard section preserves other unfinished forms, open disclosures and edit identities. Leaving with unsaved dashboard data triggers the browser warning; stale revisions offer a reload that keeps unfinished forms.
- Saved itinerary stops, packing checkboxes and liked activities are visible inside the dashboard. Packing and interest removal save to the owned trip with revision checks. Removing interest never deletes itinerary stops.
- Dashboard workspace loading uses hydrate=0 to read saved data without refetching Google place details.
- Trip-date weather uses the existing forecast service with coverage counts, partial/outside-horizon/unavailable states, refresh, source time and ungendered wear/packing suggestions. Only forecast days inform suggestions. Production still needs its configured licensed weather access; unknown destinations never receive invented weather.
- Combined expense estimates use dated validated exchange rates, keep original records unchanged, and stop when a rate is missing. The existing shared provider supports a configured key or its open endpoint with caching, attribution and stale-rate rejection.
- Shared expense records can show equal shares for 1–30 people. Trip totals include the whole payment once, not the share multiplied again. This is not a debt-settlement system.
- Offline text export now includes saved itinerary, packing, liked activities, original expense records and official/personal contacts. Passport information and private experience drafts are excluded.
- Destination guide notes from the existing PackSwift catalog and saved arrival details are shown internally. These are not current venue hours or legal guidance.

## Still deliberate boundaries

Automatic visa eligibility needs a reliable maintained rules source; this update does not invent eligibility results. The private entry organizer and official-source verification remain. Built-in verified contact coverage remains Thailand, Vietnam and Japan, with explicit unavailable states elsewhere. Public community publishing still needs moderation/privacy design and is not introduced.

## Checks

```sh
npm run build
node --test tests/dashboard-tools.test.mjs tests/dashboard-state.test.mjs tests/trip-workspace.test.mjs tests/booking-exchange-rate.test.mjs
node tests/dashboard-api.integration.mjs
node tests/user-dashboard.browser.mjs
```

Optional real local account check, only on your development database:

```sh
DASHBOARD_TEST_URL=http://127.0.0.1:3000 node tests/dashboard-live.integration.mjs
```

It creates one disposable identity and trip, verifies save/re-login, updates packing and removes a liked activity, then deletes only its own test records. It does not use real users or paid activity/booking searches. Set PLAYWRIGHT_MODULE and CHROME_PATH if needed.

## GitHub

Review these files and commit prior dashboard/provider dependencies first. Do not include .env or private exports. The scoped commit does not include unrelated staged files.

```sh
git status --short
set -- public/profile.html public/css/user-dashboard.css public/js/user-dashboard.js public/js/dashboard-tools.js src/routes/trips.js src/routes/trip-workspace.js src/repositories/trip-workspace-repository.js src/services/trip-workspace.js src/services/dashboard-state.js src/services/dashboard-currency.js tests/dashboard-tools.test.mjs tests/dashboard-live.integration.mjs tests/user-dashboard.browser.mjs docs/dashboard-internal-tools-github.md
git add -- "$@"
git diff --cached --stat -- "$@"
git diff --cached --check -- "$@"
git commit --only -m "Bring trip tools into dashboard and protect unfinished forms" -- "$@"
git push
```
