# Clearer, shorter website copy

Copy cleanup across Home, Explore, About, sign-in/sign-up, My Trips, the planner, packing, itinerary, dashboard, entry guidance, Help and emergency contacts. Destination cards and generated planner/dashboard copy use the same concise style.

Repeated marketing introductions, redundant instructions and the About mission/vision panels were removed or shortened. Controls, form identifiers, navigation, accessibility labels, data handling, source dates, errors, estimate qualifications, privacy guidance and emergency dialing warnings remain. Empty supporting paragraphs no longer create gaps; live/status regions are excluded from this styling.

No backend or database changes are required. Light/dark palettes are unchanged.

## Verify

```sh
npm run build
node --test tests/concise-copy.test.mjs tests/emergency-directory.test.mjs tests/dashboard-state.test.mjs tests/dashboard-tools.test.mjs
node tests/user-dashboard.browser.mjs
node tests/emergency-directory.browser.mjs
node tests/theme-readability.browser.mjs
```

The browser checks use isolated mock data. Set PLAYWRIGHT_MODULE and CHROME_PATH if installed separately.

## GitHub

Commit prior dashboard and directory dependencies first. Review existing work in these files before committing. The scoped commit excludes unrelated staged files; do not include .env, private exports or generated builds.

```sh
git status --short
set -- public/index.html public/explore.html public/about.html public/login.html public/signup.html public/my-trips.html public/packing-list.html public/trip-planner.html public/help.html public/assist-visa.html public/emergency-contacts.html public/profile.html public/assist-trip.html public/trip-itinerary.html public/js/world-explorer.js public/js/planning-support.js public/js/user-dashboard.js public/js/emergency-directory.js public/js/saved-trip-workspace.js public/js/home-slider.js public/js/destination-guide.js public/js/booking-preview.js public/js/profile-personality.js public/css/website-theme.css tests/emergency-directory.browser.mjs tests/concise-copy.test.mjs docs/concise-copy-github.md
git add -- "$@"
git diff --cached --stat -- "$@"
git diff --cached --check -- "$@"
git commit --only -m "Simplify website copy and remove redundant introductions" -- "$@"
git push
```
