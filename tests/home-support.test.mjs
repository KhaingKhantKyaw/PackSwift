import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [home, client, styles, contactRoute, pages, worker] = await Promise.all([
  readFile(new URL("../public/index.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/home-support.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/contact.js", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/pages.js", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
]);

test("homepage ends with one focused glass support card", () => {
  assert.match(home, /id="support"/);
  assert.match(home, /User feedback &amp; support/);
  assert.match(home, /Help us make travel planning better/);
  assert.match(home, /packswiftdemo@support\.com/);
  assert.match(home, /mailto:packswiftdemo@support\.com/);
  assert.match(home, /data-copy-email="packswiftdemo@support\.com"/);
  assert.doesNotMatch(home, /Phone number|Head office/i);
  assert.ok(home.indexOf('id="support"') < home.indexOf('<footer class="site-footer"'));
  assert.match(styles, /\.home-support-card \{[\s\S]*backdrop-filter: blur\(20px\)/);
});

test("quick feedback validates and persists through local and hosted APIs", () => {
  assert.match(home, /id="home-feedback-form"/);
  assert.match(home, /name="message"[^>]*minlength="10"[^>]*maxlength="500"/);
  assert.match(client, /navigator\.clipboard\.writeText/);
  assert.match(client, /window\.PackSwift\.api\("\/api\/contact\/feedback"/);
  assert.match(contactRoute, /contactRouter\.post\([\s\S]*"\/feedback"/);
  assert.match(contactRoute, /saveContactMessage/);
  assert.match(worker, /hosted_feedback_messages/);
  assert.match(worker, /url\.pathname === "\/api\/contact\/feedback"/);
});

test("old Contact page redirects to homepage support and is no longer orphaned", async () => {
  assert.match(pages, /pageRouter\.get\("\/contact"/);
  assert.match(pages, /response\.redirect\(302, "\/#support"\)/);
  assert.match(worker, /url\.pathname === "\/contact"/);
  await assert.rejects(access(new URL("../public/contact.html", import.meta.url)));
  await assert.rejects(access(new URL("../public/js/contact.js", import.meta.url)));
});
