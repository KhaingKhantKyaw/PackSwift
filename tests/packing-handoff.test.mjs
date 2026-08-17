import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip planner hands the exact active plan to the packing page", async () => {
  const [plannerHtml, plannerScript] = await Promise.all([
    readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  ]);

  assert.match(plannerHtml, /id="create-packing-list-button"/);
  assert.match(plannerScript, /packswift\.packing-context\.v1/);
  assert.match(plannerScript, /destination\.displayName/);
  assert.match(plannerScript, /destination\.searchParams\.set\("trip"/);
  assert.match(plannerScript, /rememberPackingHandoff\(activePlan\)/);
});

test("packing page has no random city default and loads saved trip context", async () => {
  const [packingHtml, packingScript] = await Promise.all([
    readFile(new URL("../public/packing-list.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/packing-list.js", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(packingHtml, /value="Tokyo"/);
  assert.match(packingHtml, /id="packing-context-destination"/);
  assert.match(packingScript, /\/api\/trips\/\$\{encodeURIComponent\(tripId\)\}\/packing-list/);
  assert.match(packingScript, /sessionStorage\.getItem\(handoffStorageKey\)/);
  assert.match(packingScript, /context\.destination\?\.displayName/);
  assert.match(packingScript, /context\.travelingWithPets/);
});

test("saving a guest packing list requires login and returns to the checklist", async () => {
  const [packingHtml, packingScript, authScript, savedTripRepository] =
    await Promise.all([
      readFile(new URL("../public/packing-list.html", import.meta.url), "utf8"),
      readFile(new URL("../public/js/packing-list.js", import.meta.url), "utf8"),
      readFile(new URL("../public/js/auth-forms.js", import.meta.url), "utf8"),
      readFile(
        new URL(
          "../src/repositories/saved-trip-repository.js",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

  assert.match(packingHtml, /id="save-packing-list-button"/);
  assert.match(packingHtml, />Log in to save checklist</);
  assert.match(packingHtml, /id="login-required-dialog"/);
  assert.match(packingScript, /packswift\.pending-packing-save\.v1/);
  assert.match(packingScript, /\/login\?return=/);
  assert.match(packingScript, /window\.PackSwift\.authReady/);
  assert.match(packingScript, /\/api\/saved-trips/);
  assert.match(packingScript, /packingChecklistSnapshot/);
  assert.match(authScript, /window\.location\.assign\(returnPath\(\)\)/);
  assert.match(savedTripRepository, /JSON_EXTRACT\(trip_data, '\$\.id'\)/);
});

test("saving a guest trip requires login and resumes into My Trips", async () => {
  const [plannerHtml, plannerScript, authScript] = await Promise.all([
    readFile(new URL("../public/trip-planner.html", import.meta.url), "utf8"),
    readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
    readFile(new URL("../public/js/auth-forms.js", import.meta.url), "utf8"),
  ]);

  assert.match(plannerHtml, /id="save-trip-button"/);
  assert.match(plannerHtml, />Log in to save trip</);
  assert.match(plannerHtml, /id="trip-login-required-dialog"/);
  assert.match(plannerHtml, /id="save-trip-feedback"/);
  assert.match(plannerScript, /packswift\.pending-trip-save\.v1/);
  assert.match(plannerScript, /\/login\?return=/);
  assert.match(plannerScript, /window\.PackSwift\.authReady/);
  assert.match(plannerScript, /\/api\/trips\/analyze/);
  assert.match(plannerScript, /\/api\/saved-trips/);
  assert.match(plannerScript, /resumePendingTripSave/);
  assert.match(authScript, /window\.location\.assign\(returnPath\(\)\)/);
});
