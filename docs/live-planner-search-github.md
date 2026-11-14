# Activities, flights and stays: run, verify and publish

Open the planner via the PackSwift server. From your configured checkout (on this machine, `/Users/bluemingadri/Desktop/PackSwift`), run `npm run dev`, then open `http://127.0.0.1:3000/trip-planner`. Opening the HTML file or serving only `dist/client` cannot serve searches. This checkout's own `.env` loads regardless of the shell's starting directory.

Set **GOOGLE_PLACES_API_KEY** (Places API New enabled) and **SERPAPI_API_KEY** on the server. Hosted deployments need the same names as Worker secrets and the entire rebuilt server and client artifacts. Do not commit keys or place them in browser JavaScript. After changing configuration, restart the local server or redeploy the Worker.

- Activities: choose a destination and **Explore popular activities**, or select interests to load matches. Travel style is optional.
- Flights and stays: choose a supported origin and destination, future travel dates and travelers. Enter child ages if applicable. Use each panel's search button. Nearby stays and origin-currency display still work.
- Empty availability is not a fare of zero. If the provider is unavailable, use the panel's retry or external booking link.

Build and run the provider-independent checks:

```sh
npm run build
node --test tests/hosted-live-search.test.mjs tests/booking-search.test.mjs tests/activity-discovery-plan.test.mjs tests/place-search.test.mjs
```

Optional: with the server running and Playwright installed, `RUN_LIVE_SEARCH=1 node tests/planner-live-provider-smoke.mjs` checks real cards in the browser. This consumes provider quota (at most one activity, one flight and one hotel query). Set `PLAYWRIGHT_MODULE` and `CHROME_PATH` if using a separate browser installation.

## GitHub

Use the following in one terminal in your usual Git checkout. Review the listed files first, particularly earlier changes in the same files. The scoped commit leaves unrelated staged files alone. Previous planner and booking service dependencies must also be on your branch.

```sh
git status --short
set -- .env.example server.js scripts/build.mjs worker/hosted-worker.mjs worker/live-search.mjs src/config/load-env.js src/services/search-destinations.js src/services/booking-search.js src/services/place-search-service.js src/services/activity-discovery-plan.js src/routes/place-search.js public/js/activities-preview.js public/js/booking-preview.js public/js/destination-currency.js tests/activity-discovery-plan.test.mjs tests/activities-preview.browser.mjs tests/booking-search.test.mjs tests/booking-preview.browser.mjs tests/hosted-live-search.test.mjs tests/planner-live-provider-smoke.mjs docs/live-planner-search-github.md
git add -- "$@"
git diff --cached --stat -- "$@"
git diff --cached --check -- "$@"
git commit --only -m "Restore live activity, flight and hotel searches" -- "$@"
git push
```
