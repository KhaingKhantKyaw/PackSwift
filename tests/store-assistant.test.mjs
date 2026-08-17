import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const [html, script, styles, checklist, localRoutes, hostedWorker] = await Promise.all([
  readFile(new URL("../public/assist-store.html", import.meta.url), "utf8"),
  readFile(new URL("../public/js/store-assistant.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/js/assist-trip.js", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/pages.js", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
]);

test("gear assistant is exclusively PackSwift branded and tied to the selected checklist item", () => {
  assert.match(html, /PackSwift Gear Assistant/);
  assert.match(html, /PackSwift Travel Store/);
  assert.match(html, /id="store-search-input"/);
  assert.match(script, /itemProfiles/);
  assert.match(script, /storeSearchForm\.elements\.keyword\.value = profile\.keyword/);
  assert.doesNotMatch(`${html}\n${script}`, /Shopee|Lazada|Amazon/i);
});

test("store offers requested filters, sorting, product details, and a one-item trip cart", () => {
  for (const label of [
    "With Discount", "Ready Stock", "PackSwift Verified Seller", "Domestic",
    "Overseas", "Express Delivery", "Relevance", "Latest", "Top Sales",
    "Price Low–High", "Price High–Low", "Add to Trip Cart", "Buy Now",
  ]) assert.match(`${html}\n${script}`, new RegExp(label));
  assert.match(script, /product\.rating/);
  assert.match(script, /product\.location/);
  assert.match(script, /originalUsd/);
  assert.match(script, /selectedStoreProduct/);
});

test("product grid uses the original PackSwift gear gallery asset", async () => {
  assert.match(styles, /packswift-gear-gallery\.png/);
  assert.match(styles, /grid-template-columns: repeat\(3/);
  await access(new URL("../public/images/packswift-gear-gallery.png", import.meta.url));
});

test("checkout confirmation completes the exact physical checklist item and returns", () => {
  assert.match(html, /does not collect card details or process a real payment/);
  assert.match(html, /PackSwift Coins/);
  assert.match(script, /orderType: "GEAR"/);
  assert.match(script, /\/api\/checkout\/process/);
  assert.match(script, /returnUrl\.searchParams\.set\("completed", activeStoreItem\.key\)/);
  assert.match(checklist, /shopping: "\/assist-store"/);
  assert.match(localRoutes, /\["\/assist-store", "assist-store\.html"\]/);
  assert.match(hostedWorker, /\["\/assist-store", "\/assist-store\.html"\]/);
});
