# Add the connected planning upgrade to GitHub

No commit or push has been made automatically. These commands stage only this update's files and leave other staged files out of the commit. Existing edits within the listed files will be included, so review the diff before committing. Older uncommitted features outside this list are not included.

Run from Terminal:

```bash
cd /Users/bluemingadri/Desktop/PackSwift

files=(
  .env.example
  database/schema.sql
  database/migrations/022_nullable_draft_budget.sql
  scripts/db-init.mjs
  scripts/migrate-planner-draft.mjs
  public/css/preview-destination.css
  public/js/itinerary-discovery.js
  public/js/itinerary-preferences.js
  public/js/place-search-model.js
  public/js/planner-sketch.js
  public/js/planner-studio.js
  public/js/planner-workspace.js
  public/js/planning-support.js
  public/js/booking-preview.js
  public/js/packing-preview.js
  public/js/saved-trip-workspace.js
  src/services/planner-draft.js
  src/services/trip-forecast.js
  src/services/booking-search.js
  src/services/live-review.js
  src/services/trip-workspace.js
  src/routes/trips.js
  src/routes/api.js
  src/routes/trip-forecast.js
  src/routes/trip-workspace.js
  src/repositories/trip-workspace-repository.js
  tests/connected-planning.test.mjs
  tests/connected-planning.browser.mjs
  tests/connected-planning.integration.mjs
  tests/run-planner-browser.mjs
  tests/itinerary-arrival.test.mjs
  tests/activities-preview.browser.mjs
  tests/booking-preview.browser.mjs
  tests/activity-dismissal.browser.mjs
  docs/planning-upgrade-status.md
  docs/connected-planning-github.md
)

git add -- "${files[@]}"
git diff --cached --stat -- "${files[@]}"
git diff --cached -- "${files[@]}"

# After reviewing the changes:
git commit --only -m "Connect activity planning, weather packing and reliable trip drafts" -- "${files[@]}"
git push
```

On another Node/MySQL deployment, run `node scripts/migrate-planner-draft.mjs` before enabling draft saving. Production weather requires the server-only `OPEN_METEO_API_KEY`. Do not commit a populated `.env` file.
