import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cleanTripEntity } from "../src/services/ai-concierge-service.js";
import {
  currencyRatesToUsd,
  minimumTripBudgetDetails,
  routeLocation,
} from "../src/services/travel-planner.js";
import {
  createTripPlanDeclaration,
  generateTravelAdvice,
} from "../src/services/geminiService.js";

const [route, client, tripsRoute, packageJson] = await Promise.all([
  readFile(new URL("../src/routes/ai.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/chat-widget.js", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/trips.js", import.meta.url), "utf8"),
  readFile(new URL("../package.json", import.meta.url), "utf8"),
]);

test("Gemini Concierge uses the official SDK and strict create_trip_plan tool", async () => {
  let request;
  const fakeClient = {
    models: {
      generateContent: async (value) => {
        request = value;
        return {
          functionCalls: [{
            name: "create_trip_plan",
            args: {
              origin: "Yangon",
              destination: "Bangkok for a short trip",
              start_date: "10/09/2026",
              end_date: "13/09/2026",
              adults_count: 1,
              children_count: 0,
              trip_type: "Solo",
              travel_purpose: "Leisure",
              budget_estimate: 10000,
              currency: "THB",
            },
          }],
          text: "",
        };
      },
    },
  };
  const result = await generateTravelAdvice("Plan a short Bangkok trip", [], { client: fakeClient });
  assert.equal(request.model, "gemini-3.6-flash");
  assert.equal(request.config.tools[0].functionDeclarations[0].name, "create_trip_plan");
  assert.equal(result.trip_card.destination, "Bangkok");
  assert.equal(result.trip_card.total_budget, 10000);
  assert.equal(result.trip_card.currency, "THB");
  assert.equal(result.trip_card.duration_days, 4);
  assert.equal(result.source, "gemini");
});

test("Gemini schema exposes only the requested clean planner fields", () => {
  assert.equal(createTripPlanDeclaration.name, "create_trip_plan");
  assert.deepEqual(createTripPlanDeclaration.parametersJsonSchema.required, [
    "origin", "destination", "start_date", "end_date", "adults_count",
    "children_count", "trip_type", "travel_purpose", "budget_estimate", "currency",
  ]);
  assert.match(packageJson, /"@google\/genai"/);
  assert.match(route, /process\.env\.GEMINI_API_KEY/);
});

test("budget estimate route uses clean entities and returns validity instead of throwing", () => {
  assert.match(tripsRoute, /"\/estimate-budget"/);
  assert.match(tripsRoute, /cleanTripEntity\(request\.body\.destination/);
  assert.match(tripsRoute, /submitted_budget:[\s\S]*is_valid: submitted >= minimumAmount/);
});

test("budget engine accepts 10,000 THB for a four-day Yangon to Bangkok trip", () => {
  const origin = routeLocation("Yangon");
  const cleanedDestination = cleanTripEntity("Bangkok for a short trip");
  const destination = routeLocation(cleanedDestination);
  const details = minimumTripBudgetDetails("international", origin, destination, {
    travelers: 1,
    days: 4,
  });
  const minimumThb = details.minimumBudgetUsd / currencyRatesToUsd.THB;
  assert.equal(cleanedDestination, "Bangkok");
  assert.equal(details.transitCostPerPersonUsd, 100);
  assert.equal(minimumThb, 9100);
  assert.equal(10000 >= minimumThb, true);
});

test("chat widget sends history, stores the complete card, and keeps auth gating", () => {
  assert.match(client, /history: previousHistory/);
  assert.match(client, /sessionStorage\.setItem\(pendingAiTripKey, JSON\.stringify\(recommendation\)\)/);
  assert.match(client, /await window\.PackSwift\.authReady/);
  assert.match(client, /Save Your Trip &amp; Unlock 1-Click Planning/);
  assert.match(client, /Plan & Customize This Trip with PackSwift/);
});
