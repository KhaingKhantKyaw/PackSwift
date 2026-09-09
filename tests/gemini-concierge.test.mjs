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
  askTravelConcierge,
  explicitRouteEntities,
  createTripPlanDeclaration,
  generateTravelAdvice,
  isTravelDomainMessage,
  OFF_TOPIC_REFUSAL,
  PACKSWIFT_SYSTEM_PROMPT,
  reinforceTripPlanArgs,
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
              duration_nights: 3,
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
  assert.equal(request.model, "gemini-2.5-flash");
  assert.equal(request.config.tools[0].functionDeclarations[0].name, "create_trip_plan");
  assert.equal(result.trip_card.destination, "Bangkok");
  assert.equal(result.trip_card.total_budget, 10000);
  assert.equal(result.trip_card.currency, "THB");
  assert.equal(result.trip_card.duration_days, 4);
  assert.equal(result.source, "gemini");
});

test("Gemini Concierge rejects unrelated topics before calling the provider", async () => {
  let providerCalled = false;
  const result = await askTravelConcierge("Write JavaScript code for a calculator", [], {
    client: { models: { generateContent: async () => { providerCalled = true; } } },
  });
  assert.equal(providerCalled, false);
  assert.equal(result.text, OFF_TOPIC_REFUSAL);
  assert.equal(result.reply, OFF_TOPIC_REFUSAL);
  assert.equal(result.source, "domain-guardrail");
  assert.equal(isTravelDomainMessage("What should I pack for Chiang Mai?"), true);
  assert.equal(isTravelDomainMessage("Give me three Bangkok attractions."), true);
  assert.equal(isTravelDomainMessage("Solve this algebra equation"), false);
  assert.equal(isTravelDomainMessage("yes", [{ role: "model", text: "Would you like a beach trip?" }]), true);
});

test("Gemini Concierge retries a supported model only when 2.5 is unavailable", async () => {
  const models = [];
  const result = await askTravelConcierge("What should I pack for Chiang Mai?", [], {
    client: {
      models: {
        generateContent: async (request) => {
          models.push(request.model);
          if (models.length === 1) throw new Error("404 model no longer available");
          return { text: "Pack a light layer and comfortable walking shoes." };
        },
      },
    },
  });
  assert.deepEqual(models, ["gemini-2.5-flash", "gemini-3.6-flash"]);
  assert.equal(result.model, "gemini-3.6-flash");
  assert.match(result.text, /light layer/);
});

test("Gemini Concierge accepts itinerary refinements and sends the full conversation", async () => {
  let request;
  const history = [
    { role: "user", text: "Plan three days in Bangkok." },
    { role: "model", text: "Day 1 temples, Day 2 markets, Day 3 river sights." },
  ];
  const result = await askTravelConcierge("add beach plan", history, {
    client: { models: { generateContent: async (value) => {
      request = value;
      return { text: "I added a beach day to your Bangkok plan." };
    } } },
  });
  assert.equal(request.contents.length, 3);
  assert.deepEqual(request.contents.map((entry) => entry.role), ["user", "model", "user"]);
  assert.match(result.text, /added a beach day/i);
  assert.match(PACKSWIFT_SYSTEM_PROMPT, /Always consider the entire chat history/);
  assert.match(PACKSWIFT_SYSTEM_PROMPT, /modify, add, remove, or refine activities/);
});

test("explicit BKK and YGN route aliases override an activity-based destination guess", async () => {
  const message = "make plan for four nights in bkk from ygn. 2 adults 2 kids. adventure and beaches. no budget set";
  let functionArgs;
  const fakeClient = {
    models: {
      generateContent: async () => ({
        functionCalls: [{
          name: "create_trip_plan",
          args: {
            origin: "Yangon",
            destination: "Bali",
            start_date: "10/09/2026",
            end_date: "14/09/2026",
            duration_nights: 4,
            adults_count: 1,
            children_count: 0,
            trip_type: "Solo",
            travel_purpose: "Adventure",
            budget_estimate: 42000,
            currency: "THB",
          },
        }],
      }),
    },
  };
  const route = explicitRouteEntities(message);
  functionArgs = reinforceTripPlanArgs({
    origin: "Yangon", destination: "Bali", start_date: "10/09/2026", end_date: "14/09/2026",
    duration_nights: 4, adults_count: 1, children_count: 0, trip_type: "Solo",
    travel_purpose: "Adventure", budget_estimate: 42000, currency: "THB",
  }, message);
  const result = await askTravelConcierge(message, [], { client: fakeClient });

  assert.deepEqual(route, { origin: "Yangon", destination: "Bangkok" });
  assert.equal(functionArgs.origin, "Yangon");
  assert.equal(functionArgs.destination, "Bangkok");
  assert.equal(functionArgs.duration_nights, 4);
  assert.equal(functionArgs.adults_count, 2);
  assert.equal(functionArgs.children_count, 2);
  assert.equal(functionArgs.trip_type, "Family");
  assert.equal(functionArgs.travel_purpose, "Adventure & Leisure");
  assert.equal(result.trip_card.origin, "Yangon");
  assert.equal(result.trip_card.destination, "Bangkok");
  assert.equal(result.trip_card.duration_nights, 4);
  assert.equal(result.trip_card.adults_count, 2);
  assert.equal(result.trip_card.children_count, 2);
  assert.equal(result.trip_card.trip_type, "Family");
  assert.equal(result.trip_card.travel_purpose, "Adventure & Leisure");
  assert.match(JSON.stringify(result.trip_card.day_by_day_highlights), /Koh Larn|Pattaya/);
  assert.match(PACKSWIFT_SYSTEM_PROMPT, /explicit destinations as immutable constraints/);
  assert.match(PACKSWIFT_SYSTEM_PROMPT, /BKK or DMK = Bangkok/);
});

test("Gemini trip cards cannot keep provider-generated dates in the past", async () => {
  const result = await askTravelConcierge("Plan four nights in Bangkok from Yangon for two adults", [], {
    client: {
      models: {
        generateContent: async () => ({
          functionCalls: [{
            name: "create_trip_plan",
            args: {
              origin: "Yangon",
              destination: "Bangkok",
              start_date: "01/12/2024",
              end_date: "05/12/2024",
              duration_nights: 4,
              adults_count: 2,
              children_count: 0,
              trip_type: "Couples",
              travel_purpose: "Leisure",
              budget_estimate: 1200,
              currency: "USD",
            },
          }],
        }),
      },
    },
  });
  const [day, month, year] = result.trip_card.start_date.split("/").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  assert.ok(start > new Date());
  assert.equal(result.trip_card.duration_nights, 4);
  assert.match(result.text, new RegExp(result.trip_card.start_date.replaceAll("/", "\\/")));
});

test("Gemini schema exposes only the requested clean planner fields", () => {
  assert.equal(createTripPlanDeclaration.name, "create_trip_plan");
  assert.deepEqual(createTripPlanDeclaration.parametersJsonSchema.required, [
    "origin", "destination", "start_date", "end_date", "duration_nights", "adults_count",
    "children_count", "trip_type", "travel_purpose", "budget_estimate", "currency",
  ]);
  assert.match(packageJson, /"@google\/genai"/);
  assert.match(route, /process\.env\.GEMINI_API_KEY/);
});

test("budget estimate route uses clean entities and returns validity instead of throwing", () => {
  assert.match(tripsRoute, /"\/estimate-budget"/);
  assert.match(tripsRoute, /cleanTripEntity\(request\.body\.destination/);
  assert.match(tripsRoute, /submitted_budget:[\s\S]*is_valid: submitted > 0/);
  assert.match(tripsRoute, /meets_recommended_budget: submitted >= minimumAmount/);
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
  assert.match(client, /role: entry\.role === "assistant" \? "model" : "user"/);
  assert.match(client, /content: result\.text \|\| result\.reply/);
  for (const prompt of [
    "💡 3-Day Bangkok Itinerary",
    "🎒 What to pack for Chiang Mai?",
    "💰 Budget trip under $300",
  ]) assert.equal(client.includes(prompt), true);
  assert.match(client, /sessionStorage\.setItem\(pendingPackswiftTripKey, JSON\.stringify\(pendingTrip\)\)/);
  assert.match(client, /sessionStorage\.setItem\(authRedirectTargetKey, "\/trip-planner"\)/);
  assert.match(client, /await window\.PackSwift\.authReady/);
  assert.match(client, /Save Your Trip &amp; Unlock 1-Click Planning/);
  assert.match(client, /Plan & Customize This Trip with PackSwift/);
});
