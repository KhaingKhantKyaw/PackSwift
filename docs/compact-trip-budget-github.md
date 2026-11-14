# Compact estimate and Save trip

Removed the large Finish your plan panel and its duplicate budget inputs. Plan Trip now ends with a compact optional estimate, expandable read-only breakdown and Save to My Trips. The row stays in document flow; mobile places the summary above a full-width save button. Print, saved preferences and packing presets remain under More options.

Detailed editing remains in My Trips → Open trip → Budget. An existing saved trip has a direct budget link in the breakdown. Unknown amounts stay unknown; incomplete drafts can be saved. Changed routes/currencies mark old estimates for review. Explicit zero amounts remain valid.

Fixed during verification: older scalar fields now restore safely when control types changed (without guessing between duplicate names), and empty child-age representations no longer falsely invalidate a no-children budget. The existing Budget-tab search link now opens Flights & stays in the planner.

```sh
git add public/js/planning-support.js public/js/trip-draft-gate.js public/css/planner-page-flow.css public/js/planner-scroll-layout.js tests/compact-trip-budget.browser.mjs tests/guest-planning.browser.mjs tests/dashboard-live.integration.mjs tests/draft-fields.test.mjs docs/compact-trip-budget-github.md docs/github-upload-nov5-to-now.txt
git diff --cached --stat
git commit -m "Replace planner budget form with a compact estimate and save row"
git push
```

Review other staged changes before committing. No automatic push is performed.

Verification: compact-summary browser checks, real database save/reopen and Budget-tab edits, guest login/signup/retry workflows, main saved-trip workflow and responsive theme checks. Full unit suite: 315 pass, the same 35 pre-existing failures. One new test protects legacy scalar restoration.
