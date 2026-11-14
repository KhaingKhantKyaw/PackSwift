# Add the editable itinerary upgrade to GitHub

No commit or push was made automatically. These commands include only this upgrade's files, not the other existing workspace edits. If earlier PackSwift features are not committed yet, first review the earlier `connected-planning-github.md` instructions and their dependencies.

Run in Terminal:

```sh
cd /Users/bluemingadri/Documents/PackSwift/web
files=(
  .env.example
  public/trip-planner.html
  public/css/itinerary-editor.css
  public/css/saved-trip-workspace.css
  public/js/itinerary-editor.js
  public/js/itinerary-plan-model.js
  public/js/itinerary-discovery.js
  public/js/planner-studio.js
  public/js/planner-workspace.js
  public/js/planning-support.js
  public/js/saved-trip-workspace.js
  src/routes/api.js
  src/routes/itinerary-plan.js
  src/routes/trip-drafts.js
  src/routes/trip-workspace.js
  src/services/itinerary-plan.js
  src/services/itinerary-routing.js
  src/services/planner-draft.js
  src/repositories/trip-workspace-repository.js
  tests/itinerary-plan.test.mjs
  tests/editable-itinerary.browser.mjs
  tests/connected-planning.test.mjs
  tests/connected-planning.integration.mjs
  docs/planning-upgrade-status.md
  docs/itinerary-upgrade.md
  docs/itinerary-upgrade-github.md
)
git add -- "${files[@]}"
git diff --cached --check
git diff --cached --stat -- "${files[@]}"
git diff --cached -- "${files[@]}"
```

After reviewing the staged changes:

```sh
git commit --only -m "Add personalized editable day-by-day itineraries" -- "${files[@]}"
git push
```

Never add `.env`, provider keys, database exports containing user information, or browser test artifacts. `.env.example` contains blank configuration placeholders only.
