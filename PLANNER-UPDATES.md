# Connected Plan Trip controls

The existing six-step planner, account/draft gate, saved-trip workspace, and removal flow are retained.

## State and display
- The existing form remains the source of truth. `tripType` defaults to `worldwide`; `local` uses one destination city and hides international preparation.
- ISO dates remain in form state, drafts and database payloads. `public/js/trip-context.js` provides DD/MM/YY display formatting.
- `date-demand-calendar.js` adapts the existing date and traveler inputs without duplicating submitted values. Calendar colors illustrate weekdays only; there are no invented fares.
- Destination currency uses city → country → currency data. A currency change clears an entered amount and requests re-entry. No UI conversion is implied.
- Exact form fields are saved through the existing details endpoint; trip type also persists in the existing preferences JSON. No schema migration is needed.

## Data quality
- `public/data/entry-rules.json` is deliberately empty. No verified immigration provider is configured. The UI therefore shows **Verification required**.
- To add a curated rule, supply ISO country codes, a supported visa type, conditions, `sourceUrl` (HTTPS), `lastUpdated`, `validUntil`, and `verificationStatus: "verified"`. Expired, malformed and mismatched rules cannot declare visa-free status. Review sources and all applicability conditions before publishing a rule.
- Flight/stay buttons carry the current route, ISO dates and adults/children to external searches. These are not booking integrations or guaranteed provider form prefill. No selected flight/stay records currently exist in this workflow.
- Quick Summary uses labeled internal ground-cost benchmarks, not live quotes. Worldwide flight costs remain unknown; local flight cost is not applicable. Manual currency choices without matching cost data show an unavailable estimate rather than an invented conversion.
- Lowest Cost, Best Value and Comfort influence the benchmark and emergency buffer. Stay style also affects the lodging benchmark. Recommended budgets require user action.
- Typography is centralized in `journey-theme.css`. Times New Roman is active. Paper Cuts has no verified licensed asset in this project, so its heading token uses the safe fallback.

## Verification
- `npm run build`
- Targeted tests: `node --test tests/planner-workspace.test.mjs tests/trip-workspace.test.mjs tests/planner-studio.test.mjs tests/draft-fields.test.mjs tests/draft-budget.test.mjs tests/live-review.test.mjs tests/destination-currency.test.mjs tests/cost-engine.test.mjs`
- `tests/planner-controls.browser.mjs`: optional installed-Playwright smoke test for dates, travelers, currency reset, local mode, browser errors and mobile overflow. Accepts `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `PLANNER_TEST_URL`.
- `tests/trip-workspace.integration.mjs`: isolated accounts test draft restoration, local-trip persistence, save/edit, deletion ownership and cleanup. Requires `PHASE1_TEST_URL` and the existing local database configuration. Test accounts are removed in `finally`.

The legacy full suite still contains assertions for retired homepage/planner DOM layouts; those should be migrated separately rather than restoring old UI to satisfy them.
