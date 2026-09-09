import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("hosted PackSwift uses authenticated identity and persistent D1 storage", async () => {
  const [hosting, worker, migration, schema] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
    readFile(
      new URL("../drizzle/0001_hosted_packswift.sql", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(hosting, /"d1": "DB"/);
  assert.match(worker, /oai-authenticated-user-email/);
  assert.match(worker, /\/api\/auth\/me/);
  assert.match(worker, /\/api\/profile/);
  assert.match(worker, /hosted_saved_trips/);
  assert.match(worker, /hosted_readiness_items/);
  assert.doesNotMatch(worker, /confirm-assistance|hosted_orders|checkout\/process/);
  assert.match(worker, /readiness\\\/complete/);
  assert.match(worker, /readiness\\\/cancel/);
  assert.match(worker, /readyTrips/);
  assert.doesNotMatch(worker, /hosted preview provides the travel interface only/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS hosted_users/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS hosted_trip_sessions/);
  assert.match(schema, /hostedPackSwiftSchema/);
});

test("browser plans can be imported when hosted analysis falls back locally", async () => {
  const [routes, planner, packing] = await Promise.all([
    readFile(new URL("../src/routes/trips.js", import.meta.url), "utf8"),
    readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
    readFile(new URL("../public/js/packing-list.js", import.meta.url), "utf8"),
  ]);

  assert.match(routes, /tripsRouter\.post\(\s*"\/import"/);
  assert.match(routes, /body\("plan\.id"\)\.isUUID\(4\)/);
  assert.match(planner, /window\.PackSwift\.api\("\/api\/trips\/import"/);
  assert.match(packing, /window\.PackSwift\.api\("\/api\/trips\/import"/);
});

test("deployment build contains the functional hosted worker", async () => {
  const worker = await readFile(
    new URL("../dist/server/index.js", import.meta.url),
    "utf8",
  );
  assert.match(worker, /async function handleApi/);
  assert.match(worker, /async function currentHostedUser/);
  assert.match(worker, /Hosted planning will use PackSwift's browser recommendation engine/);
});
