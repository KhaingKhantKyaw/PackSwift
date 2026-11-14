# Flight and stay prices in the departure currency

Both searches use the origin city, not the destination or the saved trip budget. Bangkok → Tokyo shows THB; Tokyo → Bangkok shows JPY. For Yangon, PackSwift requests USD quotes and, when a fresh exchange rate is available, shows an estimated MMK price alongside the original USD amount. The same rule applies to Nairobi/KES. If conversion fails, the quote stays in USD and the panel explains why. The booking site determines the final charge.

The change does not migrate data, convert existing budgets, or change travel-style sorting. It uses the existing booking provider configuration. For currency conversion, PackSwift uses the configured exchange-rate service or its public USD feed when no key is configured. See [booking provider currencies](https://serpapi.com/google-travel-currencies) and [public exchange-rate feed](https://www.exchangerate-api.com/docs/free).

## Verify locally

Run from the PackSwift checkout that contains `package.json`:

```sh
npm run build
node --test tests/booking-{currency,search,exchange-rate}.test.mjs tests/destination-currency.test.mjs tests/connected-planning.test.mjs
```

The browser regression is `tests/booking-origin-currency.browser.mjs`. It exercises both searches, external links, route changes, and saved budget isolation using test quotes, not paid searches.

## Add to GitHub

Run the blocks below in the same terminal, in your PackSwift checkout. The file list keeps other staged work out of this commit. Review the full working copy of each listed file: if it also includes an older planner edit, that edit will be included. These paths assume the earlier planner, booking routes and destination catalog are already present on your branch.

```sh
git status --short
set -- public/js/destination-currency.js public/js/booking-preview.js public/js/planner-workspace.js src/services/destination-currency.js src/services/booking-search.js src/services/booking-exchange-rate.js tests/booking-search.test.mjs tests/booking-currency.test.mjs tests/booking-exchange-rate.test.mjs tests/booking-origin-currency.browser.mjs docs/booking-origin-currency-github.md
git add -- "$@"
git diff --cached --stat -- "$@"
git diff --cached --check -- "$@"
```

Only when the staged list matches what you intend to publish:

```sh
git commit --only -m "Show flight and stay prices in the origin currency" -- "$@"
git push
```

Do not stage private configuration, API keys, or database exports.
