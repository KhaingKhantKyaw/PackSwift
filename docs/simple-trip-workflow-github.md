# One trip workspace

Normal flow: /profile → Open trip → /trips/:tripId.

The dashboard now contains the trip list and profile/preferences, not duplicated budget, itinerary, packing and safety editors. Opening a trip gives five sections: Overview, Itinerary, Budget, Packing, Help. Sections change within the workspace; ordinary edits do not require resubmitting the planning form.

## Preserved tools

- Overview: trip details, useful next steps, offline export, and private experience notes in a disclosure.
- Itinerary: saved stops, inline edit/save/cancel, move-to-day, remove and add activity. Locked stops require explicit unlocking. No edit silently regenerates an itinerary.
- Budget: planned flight/stay/daily costs, actual expenses, equal shares and currency conversion. Unknown costs remain blank and incomplete estimates can still be saved.
- Packing: immediate checkbox saving, plus add/edit/remove items and quantities. The saved packing snapshot is synchronized.
- Help: weather, guides, destination contacts, private entry reviews and personal contacts.
- Initial planning, discovery and advanced itinerary controls remain available through explicit links to the saved planner. Account/profile editing and private sharing are retained.

The /trips list now redirects to the dashboard. Existing /trips/:id/itinerary, /packing and /requirements URLs redirect to the equivalent workspace section. The old saved-trip-workspace page redirects to the dashboard. The historical /my-trips page is retained for compatibility with older saved-plan records; current trip links do not use it.

## Persistence and safety

Workspace mutations remain authenticated, owned-trip scoped and revision-checked. Planned costs and itinerary edits update the existing trip, not a second copy. Costs preserve trip-currency context. Stop changes use the existing itinerary model and respect locked stops. No new database table is needed; prior draft-budget migrations must already be installed.

The dashboard browser test entry point now runs tests/simple-trip-workflow.browser.mjs because detailed tools moved from /profile into the canonical workspace.

## Check

```sh
npm run build
node --test tests/trip-hub-edits.test.mjs tests/trip-workspace.test.mjs tests/dashboard-state.test.mjs tests/dashboard-tools.test.mjs
node tests/simple-trip-workflow.browser.mjs
```

Optional real local database check:

```sh
DASHBOARD_TEST_URL=http://127.0.0.1:3000 node tests/dashboard-live.integration.mjs
```

The local integration creates one disposable identity/trip and deletes its own records after testing. It does not access real users or search paid booking providers. Browser tests require Playwright; PLAYWRIGHT_MODULE and CHROME_PATH can point to separate installations.

## GitHub

Review these files, including earlier work in them. Prior dashboard, directory and planner dependencies must be committed too. Do not stage .env, generated builds or private exports.

```sh
set -- public/profile.html public/trip-hub.html public/css/trip-hub.css public/js/user-dashboard.js server.js src/routes/pages.js src/routes/trip-workspace.js src/services/trip-workspace.js src/services/trip-hub-edits.js tests/trip-hub-edits.test.mjs tests/simple-trip-workflow.browser.mjs tests/user-dashboard.browser.mjs tests/dashboard-live.integration.mjs docs/simple-trip-workflow-github.md docs/github-upload-nov5-to-now.txt
git add -- "$@"
git diff --cached --stat -- "$@"
git diff --cached --check -- "$@"
git commit --only -m "Simplify dashboard into one saved trip workspace" -- "$@"
git push
```
