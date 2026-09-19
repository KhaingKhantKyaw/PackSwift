import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL("../public/js/destination-route-editor.js", import.meta.url), "utf8"), context);
const editor = context.window.PackSwiftRouteEditor;
test("fallback contains five labelled Bangkok sample stops with all details", () => {
  const stops = editor.sampleStops();
  assert.equal(stops.length, 5);
  assert.ok(stops.every(stop => stop.isSample && stop.title && stop.hours && stop.ticket && stop.stay && stop.imageUrl));
  stops.pop();
  assert.equal(editor.sampleStops().length, 5);
});
test("normalizer accepts supported payloads and rejects unusable data", () => {
  assert.equal(editor.normalize({ stops: [{ title: "Wat Arun" }] })[0].title, "Wat Arun");
  assert.equal(editor.normalize({ days: [{ activities: [{ placeName: "Wat Pho" }] }] })[0].title, "Wat Pho");
  for (const value of [null, {}, { stops: "bad" }, { stops: [null, {}, { title: " " }] }, { source: "sample", stops: [{ title: "Sample" }] }]) assert.equal(editor.normalize(value).length, 0);
});
