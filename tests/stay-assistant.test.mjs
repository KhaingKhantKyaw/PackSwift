import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [html, script, styles] = await Promise.all([
  readFile(new URL("../public/assist-stay.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/stay-assistant.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
]);

test("stay assistant is exclusively PackSwift branded with prefilled search controls", () => {
  assert.match(html, /PackSwift Stay Assistant/);
  assert.match(html, /id="stay-destination"/);
  assert.match(html, /id="stay-check-in"/);
  assert.match(html, /id="stay-check-out"/);
  assert.match(html, /id="stay-rooms"/);
  assert.match(html, /id="stay-guests"/);
  assert.doesNotMatch(html, /Booking\.com|Agoda|Trip\.com|Expedia/i);
});

test("property results include filters, carousels, ratings, and availability actions", async () => {
  assert.match(html, /Breakfast included/);
  assert.match(html, /Free cancellation/);
  assert.match(html, /id="stay-budget-range"/);
  assert.match(script, /function changePropertyImage/);
  assert.match(script, /Check Availability/);
  assert.match(script, /\/10 \$\{property\.ratingLabel\}/);
  assert.match(styles, /packswift-stay-gallery\.png/);
  await access(new URL("../public/images/packswift-stay-gallery.png", import.meta.url));
});

test("room detail provides beds, size, amenities, rate policies, and reserve actions", () => {
  assert.match(html, /id="stay-detail-dialog"/);
  assert.match(script, /22 m²/);
  assert.match(script, /Free Wi-Fi/);
  assert.match(script, /Air conditioning/);
  assert.match(script, /Non-smoking/);
  assert.match(script, /Pay at the stay/);
  assert.match(script, /Free cancellation/);
  assert.match(script, /reserve\.textContent = "Reserve"/);
});

test("reservation confirmation earns PackSwift Rewards and completes Accommodation", () => {
  assert.match(html, /PackSwift Rewards/);
  assert.match(script, /orderType: "HOTEL"/);
  assert.match(script, /\/api\/checkout\/process/);
  assert.match(script, /returnUrl\.searchParams\.set\("completed", activeItem\.key\)/);
  assert.match(script, /window\.location\.assign/);
});
