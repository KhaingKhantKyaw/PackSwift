import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [app, pages, api, profileHtml, profileClient, profileRepository, worker] = await Promise.all([
  readFile(new URL("../public/js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/pages.js", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/api.js", import.meta.url), "utf8"),
  readFile(new URL("../public/profile.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/profile.js", import.meta.url), "utf8"),
  readFile(new URL("../src/repositories/profile-repository.js", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
]);

test("Community is absent from desktop and mobile navigation", () => {
  assert.doesNotMatch(app, /community-feed|data-nav="community"/i);
  for (const expected of ["Home", "Plan Trip", "Travel Guide", "About", "Support"]) {
    assert.match(app, new RegExp(`>${expected}<`));
  }
});

test("legacy Community URLs redirect to Travel Guide locally and when hosted", () => {
  assert.match(pages, /pageRouter\.get\(\["\/community", "\/community-feed"\]/);
  assert.match(pages, /response\.redirect\(302, "\/travel-guide"\)/);
  assert.match(worker, /\["\/community", "\/community-feed"\]\.includes\(url\.pathname\)/);
  assert.match(worker, /Response\.redirect\(new URL\("\/travel-guide"/);
  assert.doesNotMatch(api, /communityRouter|apiRouter\.use\("\/community"/);
});

test("Community-only views, controllers, and profile panels are removed", async () => {
  for (const path of [
    "../public/community.html",
    "../public/js/community.js",
    "../src/routes/community.js",
    "../src/repositories/community-repository.js",
    "../src/repositories/shorts-repository.js",
  ]) {
    await assert.rejects(access(new URL(path, import.meta.url)));
  }
  assert.doesNotMatch(`${profileHtml}\n${profileClient}\n${profileRepository}`, /community-feed|Saved Trip Shorts|sharedPosts|savedShorts|renderSavedShorts/i);
});
