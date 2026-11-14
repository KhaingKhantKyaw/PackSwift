# Forest and ocean theme

Site-wide light mode: ivory canvas, white reading surfaces, forest-green primary actions and ocean-blue supporting links.

Site-wide dark mode: deep-ocean canvas, blue-green surfaces, pale mist text, seafoam primary actions and pale ocean-blue links.

The planner uses matching legacy tokens without circular aliases. Forest/ocean accents replace unrelated pink, purple and peach category colors. Amber and red retain their warning/error roles. Photography retains a contrast scrim. Print uses neutral colors. Theme selection, page layout and feature behavior are unchanged.

## Verify

```sh
npm run build
node --test tests/forest-ocean-theme.test.mjs
node tests/theme-readability.browser.mjs
node tests/user-dashboard.browser.mjs
```

Browser checks use sample data and test both themes. Set PLAYWRIGHT_MODULE and CHROME_PATH if needed.

## GitHub

Review earlier changes in these files. Commit earlier shared-theme dependencies first; do not stage .env or generated build files.

```sh
set -- public/css/website-theme.css public/css/preview-destination.css public/js/app.js tests/forest-ocean-theme.test.mjs docs/forest-ocean-theme-github.md
git add -- "$@"
git diff --cached --stat -- "$@"
git diff --cached --check -- "$@"
git commit --only -m "Apply accessible forest and ocean color themes" -- "$@"
git push
```
