# Guest-first planning

Home → **Plan a trip** opens the planner immediately. Anyone can build and edit a trip. **Save to My Trips** is the point where a guest is offered login or account creation. The active trip is held in that browser tab during sign-in (up to 20 minutes). Closing the prompt or choosing **Back to planning** cancels the save. Completing either form returns to the planner and saves the original trip; an already signed-in traveler can save directly.

For this flow the guest snapshot is not uploaded as an anonymous database draft. The authenticated save uses an owner-scoped retry identifier and the existing unique trip ID; no schema change is needed. No analytics or third-party tracking was added.

## Verify

Run from the PackSwift checkout containing `package.json`:

```sh
npm run build
node --test tests/guest-save-retry.test.mjs tests/draft-fields.test.mjs tests/connected-planning.test.mjs
node tests/guest-planning.browser.mjs
```

The browser test needs Playwright and Chromium (or set `PLAYWRIGHT_MODULE` and `CHROME_PATH` for an existing installation). It uses simulated accounts and does not write real trips.

## GitHub

Run in the same terminal in your usual PackSwift Git checkout. Check the changes first: Git stages the entire working copy of each listed file, including earlier edits to that file. The path-limited commit leaves other staged files alone.

```sh
git status --short
set -- public/index.html public/js/app.js public/js/auth-forms.js public/js/trip-draft-gate.js public/js/planner-studio.js public/js/planning-support.js public/js/date-demand-calendar.js public/css/planning-support.css src/services/planner-draft.js tests/global-header.browser.mjs tests/website-qa-journey.browser.mjs tests/activities-preview.browser.mjs tests/planner-sketch.browser.mjs tests/guest-planning.browser.mjs tests/guest-save-retry.test.mjs docs/guest-first-planning-github.md
git add -- "$@"
git diff --cached --stat -- "$@"
git diff --cached --check -- "$@"
git commit --only -m "Let guests plan first and save after signing in" -- "$@"
git push
```
