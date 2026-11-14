# Add this upgrade to GitHub

Run these from the PackSwift Git checkout you normally push. If the earlier connected-planning and itinerary changes have not been committed, include them first using the corresponding GitHub notes in this folder. This upgrade uses those features.

Review the changes first:

```sh
git status --short
git diff -- public/trip-planner.html public/js/planner-studio.js public/js/planner-workspace.js public/js/planning-support.js public/js/packing-preview.js src/services/planner-draft.js src/routes/trip-drafts.js
```

Then stage this upgrade:

```sh
git add public/trip-planner.html public/js/travel-guidance-model.js public/js/travel-guidance.js public/css/travel-guidance.css public/css/packing-essentials.css public/js/packing-preview.js public/js/planner-workspace.js public/js/planner-studio.js public/js/planning-support.js src/services/planner-draft.js src/routes/trip-drafts.js tests/travel-guidance-model.test.mjs tests/travel-guidance-persistence.test.mjs tests/travel-guidance.browser.mjs tests/connected-planning.integration.mjs docs/travel-guidance-upgrade.md docs/travel-guidance-github.md
git diff --cached --stat
git commit -m "Add adaptive travel guidance and packing essentials"
git push
```

Do not add `.env`, API keys, database exports containing users, or local test screenshots. No database migration is needed for this upgrade. These instructions do not automatically commit or push anything.
