# Compact trip setup — GitHub steps

This layout update keeps the six main fields in two equal rows on desktop, followed by compact Travel Experience and Trip Comfort rows. The live overview remains beside the form. The default setup fits laptop viewports from 1180px wide, including 1280 × 720 and 1366 × 768. Extra child ages, an expanded calendar, browser zoom, and smaller screens are allowed to grow naturally rather than clipping controls.

No planning functions, data, or defaults were removed or changed. The trip-plan heading also follows the current theme for readable contrast.

Run these commands from your usual PackSwift Git checkout. This update depends on the earlier planner and travel-guidance files; if those are not yet committed, include them using the other GitHub notes in this folder.

```sh
git status --short
git add public/css/preview-destination.css tests/compact-planner-setup.browser.mjs docs/compact-planner-setup-github.md
git diff --cached --stat
git diff --cached --check
git commit -m "Compact trip setup into aligned desktop panels"
git push
```

Review the staged changes before committing. Do not include `.env`, credentials, private database exports, or temporary screenshots. These instructions do not automatically commit or push anything.

Verified with the build and browser checks for compact setup, combined overview/form layout, and travel guidance. Coverage includes date readability, eight child-age selectors, the calendar, multi-purpose selection, light/dark themes, and responsive layouts.
