# Signed-in user dashboard

The existing /profile route is now the personal dashboard. Ordinary sign-in already lands here; saving a guest plan still returns to that plan. No guest planning workflow was removed.

## Included

- Active trip selector, Continue planning, practical next steps, date countdown and offline text summary.
- My Trips with upcoming/past filters and links to existing trip management.
- Flight, stay and daily-spending breakdown when captured by the planner; unknown costs remain unknown. Stale cost contexts are not reused.
- Account-saved expense records: date, category, original currency, description and personal/shared-total scope. Add, edit and remove records. Currency totals stay separate; budget comparisons include only the budget currency.
- Currency conversion using the existing authenticated rate endpoint, with provider time/error handling. EXCHANGERATE_API_KEY must be configured for conversions between different currencies. Changing dashboard currency does not relabel existing amounts or change origin-currency booking searches.
- First-time / experienced support choice; expanded practical guidance for first-time users.
- Packing progress, itinerary access, wishlist access, and preserved travel personality, account editing, avatar, packing presets and profile preferences under a compact disclosure.
- Practical travel guides and official destination links.
- Official-source local contacts for Thailand, Vietnam and Japan, plus private user-added embassy, insurer and accommodation contacts. Unsupported destinations show an explicit unavailable state rather than guessed numbers. Short codes are local, not international phone numbers.
- Passport-issuing country, passport type, residence, purpose, transit and source-based entry review organizer. Changing journey details invalidates the review; changing input fields clears the review checkbox.
- Private experience drafts with edit, delete, preview, device sharing and text download. No public community feed, automatic publishing, moderation system or public profile is introduced.
- Responsive shared light/dark theme; scrollable records instead of endless nested cards.

## Deliberate limits

The entry organizer is not an automated visa eligibility service. It links official resources and stores user notes without passport numbers or scans. A reviewed checkbox is not travel clearance. Forecasts are not fabricated or automatically loaded by the dashboard. Official government guidance can include nationality-specific information; the user must check their own government and destination authorities.

The new GET/PUT /api/profile/dashboard endpoints use the existing user_profile_preferences table (migration 021). Writes require authentication, validate bounded input, preserve existing preferences and photo, and use a locked revision to reject stale updates. No new table is required. Never commit .env, secrets, database dumps or user exports.

Hosted static/Worker-only deployments without the existing authenticated Express/MySQL account backend cannot persist this dashboard; deploy the account backend rather than presenting a fake successful save.

## Official sources checked 14 November 2026

- Thailand: https://www.tourismthailand.org/Plan-Your-Trip/Useful-Call
- Vietnam: https://www.gov.uk/foreign-travel-advice/vietnam/getting-help
- Japan: https://www.japan.travel/en/plan/hotline/
- Entry resources: https://www.thaievisa.go.th/ ; https://evisa.gov.vn/ ; https://www.mofa.go.jp/j_info/visit/visa/index.html

Recheck official contact information before departure; the displayed date is the source-review date, not live verification.

## Verification

Run from the web app directory:

```sh
npm run build
node --test tests/dashboard-state.test.mjs tests/trip-workspace.test.mjs
node tests/dashboard-api.integration.mjs
node tests/user-dashboard.browser.mjs
```

The API integration uses a simulated database and signed test identities, not real accounts. The browser uses mocked trips and rates, exercises persistence across reload, failure recovery, guest hiding, first-time support, and 1440/768/390px light/dark layouts. Set PLAYWRIGHT_MODULE and CHROME_PATH if Playwright/Chrome are installed outside this app.

## GitHub

Use your usual checkout. These files include existing work, so review before committing; do not stage unrelated files or generated deployment output. The scoped commit leaves unrelated staged changes out.

```sh
git status --short
set -- public/profile.html public/css/user-dashboard.css public/js/user-dashboard.js src/routes/profile.js src/services/dashboard-state.js src/services/trip-workspace.js tests/dashboard-state.test.mjs tests/dashboard-api.integration.mjs tests/user-dashboard.browser.mjs docs/user-dashboard-github.md
git add -- "$@"
git diff --cached --stat -- "$@"
git diff --cached --check -- "$@"
git commit --only -m "Add account-backed travel dashboard and trip tools" -- "$@"
git push
```
