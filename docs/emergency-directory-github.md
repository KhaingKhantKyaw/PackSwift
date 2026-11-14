# Country-based emergency directory

Public page: /emergency-contacts.html (no account needed). Express also supports /emergency-contacts.

All 249 ISO country/territory codes plus Kosovo are selectable. Initial official-source number coverage is 36 countries: 27 EU members plus Australia, India, Japan, New Zealand, Singapore, Thailand, United Kingdom, United States and Vietnam. Overseas territories do not inherit mainland or EU records. Missing coverage never defaults to 112 or 911.

The dashboard selects contacts from the saved trip's resolved destination country. Users can explicitly correct the country in the selector; it does not request GPS access or silently select an ambiguous city. Offline exports include the selected contact country, local dialing guidance, review date and source. Personal contacts stay separately labeled.

The public JSON directory is the sole number source for the new display. Records are source-reviewed, not a promise of live emergency-service availability. After 90 days they show review-overdue warnings. Future review dates are not trusted. Unsupported coverage and failed downloads have no guessed telephone links.

## Maintaining coverage

Edit public/data/emergency-contacts.json only after checking the relevant official authority. Each group needs explicit country codes, source URL, manual review date, service names, local phone strings and dialing limitations. For a new authority, also add its exact host to the sourceHosts allowlist in public/js/emergency-directory.js.

Never add 112/911 as a worldwide fallback, automatically infer embassy contacts, or include specialized crisis hotlines without separate appropriate verification. No test calls should be made.

Run the local audit:

```sh
node scripts/audit-emergency-contacts.mjs
node scripts/audit-emergency-contacts.mjs --fetch
```

The second command checks each unique official source with timeouts and no automatic redirects. It writes output/emergency-source-audit.json, reporting missing areas, overdue groups, changed content, redirects and failures. All fetched pages still need human review. It never edits review dates, publishes records or claims that HTTP 200 verifies a number. No recurring task has been scheduled; arrange a periodic maintenance run when your deployment environment is chosen.

## Tests

```sh
node --test tests/emergency-directory.test.mjs
node tests/emergency-directory.browser.mjs
node tests/user-dashboard.browser.mjs
npm run build
```

Browser checks use an isolated static server, no real accounts or emergency calls. Set PLAYWRIGHT_MODULE and CHROME_PATH if required.

## GitHub

Commit earlier dashboard dependencies first. Review these exact files; keep audit output, .env and private offline exports out of Git.

```sh
set -- public/data/emergency-contacts.json public/js/emergency-directory.js public/js/emergency-contacts-page.js public/emergency-contacts.html public/profile.html public/js/user-dashboard.js public/js/help-search.js src/routes/pages.js scripts/audit-emergency-contacts.mjs tests/emergency-directory.test.mjs tests/emergency-directory.browser.mjs tests/user-dashboard.browser.mjs docs/emergency-directory-github.md
git add -- "$@"
git diff --cached --stat -- "$@"
git diff --cached --check -- "$@"
git commit --only -m "Add public country emergency directory and review workflow" -- "$@"
git push
```
