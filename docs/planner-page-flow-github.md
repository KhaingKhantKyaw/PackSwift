# Comfortable planner scrolling

- Removed the horizontal four-panel board and nested fixed-height vertical scrollers.
- Added Itinerary & activities, Flights & stays, and Packing & tips section buttons. Controllers stay mounted, preserving search results and edits when switching sections.
- Flight/stay results initially show four options, with Show more in batches of four.
- Activity loading follows the page viewport; in-place rejection and replacement remain supported.
- Packing links open the relevant planner section before navigating there.
- Dialog and autocomplete scrolling is intentionally retained. This change does not collapse or replace the setup form or change save/login behaviour.

Checks: dedicated document-wheel/mobile/theme/section-state browser test; activity replacement position and pointer test; main public route checks; guest login/signup save-and-retry checks; focused model tests and build. The full unit suite remains at 314 pass / 35 existing failures.

```sh
git add public/js/app.js public/trip-planner.html public/css/planner-page-flow.css public/js/planner-scroll-layout.js public/js/packing-preview.js public/js/booking-preview.js public/js/activities-preview.js tests/planner-page-flow.browser.mjs tests/guest-planning.browser.mjs docs/planner-page-flow-github.md docs/github-upload-nov5-to-now.txt
git diff --cached --stat
git commit -m "Simplify planner scrolling and preserve section state"
git push
```

Review any other staged changes before committing. Nothing is pushed automatically.
