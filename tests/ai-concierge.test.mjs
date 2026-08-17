import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  conciergeFallbackReply,
  createConciergeResponse,
  normalizeTripContext,
  normalizeTripRecommendation,
} from "../src/services/ai-concierge-service.js";

const [route, api, client, app, styles, worker, envExample, hostedMigration, tripsRoute, planner, authForms] = await Promise.all([
  readFile(new URL("../src/routes/ai.js", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/api.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/chat-widget.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/css/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../worker/hosted-worker.mjs", import.meta.url), "utf8"),
  readFile(new URL("../.env.example", import.meta.url), "utf8"),
  readFile(new URL("../.openai/drizzle/0005_packswift_concierge.sql", import.meta.url), "utf8"),
  readFile(new URL("../src/routes/trips.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/trip-planner.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/auth-forms.js", import.meta.url), "utf8"),
]);

test("Concierge safely normalizes trip context without canned keyword interception", () => {
  const context = normalizeTripContext({
    destination: { displayName: "Bangkok <script>alert(1)</script>" },
    travelers: 2,
  });
  assert.doesNotMatch(JSON.stringify(context), /[<>]/);
  const reply = conciergeFallbackReply("What should I pack?", context);
  assert.match(reply, /departure city.*destination.*number of nights/i);
  assert.doesNotMatch(reply, /Open the PackSwift Checklist|\/assist-store/);
});

test("OpenAI calls remain server-side and use the Responses API without storage", async () => {
  let request;
  const result = await createConciergeResponse(
    {
      message: "Suggest a three-day itinerary",
      chatHistory: [{ role: "user", content: "I like temples" }],
      tripContext: { destination: { name: "Bangkok" } },
    },
    {
      apiKey: "test-secret-key",
      model: "gpt-4o-mini",
      fetchImpl: async (url, options) => {
        request = { url, options };
        return new Response(JSON.stringify({
          output: [{ content: [{ type: "output_text", text: "• Day 1: Explore Bangkok" }] }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
    },
  );
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.options.headers.authorization, "Bearer test-secret-key");
  const payload = JSON.parse(request.options.body);
  assert.equal(payload.model, "gpt-4o-mini");
  assert.equal(payload.store, false);
  assert.equal(payload.tools[0].name, "generate_trip_recommendation");
  assert.equal(payload.tools[0].strict, true);
  assert.equal(payload.parallel_tool_calls, false);
  assert.match(payload.instructions, /PackSwift Concierge/);
  assert.equal(result.source, "openai");
  assert.match(result.reply, /Day 1/);
});

test("Concierge parses a strict function call into a safe actionable recommendation", async () => {
  const recommendation = {
    scope: "Worldwide", origin: "Yangon", destination: "Bangkok, Thailand",
    start_date: "10/09/2026", end_date: "14/09/2026", total_budget: 3000,
    duration_nights: 4, duration_days: 5,
    currency: "USD", adults_count: 2, children_count: 0, pet_included: false,
    travel_purpose: "Food & Nightlife", travel_group: "Friends",
    travel_pace: "Balanced & Steady",
    summary_pitch: "Bangkok offers energetic food, markets, and group-friendly nightlife.",
    day_by_day_highlights: Array.from({ length: 5 }, (_, index) => ({
      day: index + 1,
      title: `Bangkok day ${index + 1}`,
      highlights: ["Explore a tailored Bangkok highlight"],
    })),
  };
  assert.deepEqual(normalizeTripRecommendation(recommendation), recommendation);
  const cleaned = normalizeTripRecommendation({
    ...recommendation,
    destination: "Bangkok, Thailand for a short trip",
  });
  assert.equal(cleaned.destination, "Bangkok, Thailand");
  const result = await createConciergeResponse(
    { message: "Plan it", chatHistory: [], tripContext: null },
    {
      apiKey: "test-secret-key",
      fetchImpl: async () => new Response(JSON.stringify({
        output: [{
          type: "function_call", name: "generate_trip_recommendation",
          call_id: "call_test", arguments: JSON.stringify(recommendation),
        }],
      }), { status: 200, headers: { "content-type": "application/json" } }),
    },
  );
  assert.deepEqual(result.trip_recommendation, recommendation);
  assert.deepEqual(result.trip_card, recommendation);
  assert.match(result.reply, /4-night \/ 5-day/i);
  assert.equal(normalizeTripRecommendation({ ...recommendation, end_date: "09/09/2026" }), null);
});

test("natural-language planning creates a complete Yangon to Bangkok trip card", async () => {
  const result = await createConciergeResponse({
    message: "i want to go to bangkok for a short trip from yangon for 3 nights next week with 10,000 THB. show me plan",
    chatHistory: [],
    tripContext: null,
  }, { apiKey: "" });
  assert.equal(result.trip_card.origin, "Yangon");
  assert.equal(result.trip_card.destination, "Bangkok, Thailand");
  assert.equal(result.trip_card.scope, "Worldwide");
  assert.equal(result.trip_card.duration_nights, 3);
  assert.equal(result.trip_card.duration_days, 4);
  assert.equal(result.trip_card.currency, "THB");
  assert.equal(result.trip_card.total_budget, 10000);
  assert.doesNotMatch(result.trip_card.destination, /for a short trip/i);
  assert.equal(result.trip_card.day_by_day_highlights.length, 4);
  assert.match(result.reply, /Day 1/);
  assert.match(result.reply, /3-night \/ 4-day/);

  const routeFirst = await createConciergeResponse({
    message: "Plan a short leisure trip from Yangon to Bangkok for 3 nights next week with 10,000 THB",
    chatHistory: [],
    tripContext: null,
  }, { apiKey: "" });
  assert.equal(routeFirst.trip_card.origin, "Yangon");
  assert.equal(routeFirst.trip_card.destination, "Bangkok, Thailand");
});

test("built-in consultation asks first, then produces a trip card without an API key", async () => {
  const question = await createConciergeResponse({
    message: "I am not sure where to travel", chatHistory: [], tripContext: null,
  }, { apiKey: "" });
  assert.match(question.reply, /solo.*couple.*friends.*family/i);
  assert.equal(question.trip_recommendation, undefined);
  const suggestion = await createConciergeResponse({
    message: "I am going with friends and want food and nightlife",
    chatHistory: [{ role: "user", content: "I am not sure where to travel" }],
    tripContext: { route: { origin: { name: "Yangon" } } },
  }, { apiKey: "" });
  assert.equal(suggestion.trip_recommendation.destination, "Bangkok, Thailand");
  assert.equal(suggestion.trip_recommendation.travel_group, "Friends");
});

test("Express Concierge route validates and rate-limits public chat messages", () => {
  assert.match(api, /apiRouter\.use\("\/ai", aiRouter\)/);
  assert.match(route, /"\/chat"/);
  assert.match(route, /windowMs: 10 \* 60 \* 1000/);
  assert.match(route, /limit: 30/);
  assert.match(route, /isLength\(\{ min: 1, max: 1200 \}\)/);
  assert.match(route, /isArray\(\{ max: 12 \}\)/);
  assert.match(route, /askTravelConcierge\(message, chatHistory\)/);
  assert.match(route, /request\.body\.history \|\| request\.body\.chatHistory/);
  assert.match(route, /success: true/);
  assert.match(route, /text,/);
});

test("shared widget includes quick prompts, safe bubbles, loading state, and trip context", () => {
  assert.match(app, /\/js\/chat-widget\.js/);
  for (const prompt of [
    "💡 3-Day Bangkok Itinerary",
    "🎒 What to pack for Chiang Mai?",
    "💰 Budget trip under $300",
  ]) assert.equal(client.includes(prompt), true);
  assert.match(client, /"\/api\/ai\/chat"/);
  assert.match(client, /currentTripContext\(\)/);
  assert.match(client, /concierge-typing/);
  assert.match(styles, /@keyframes concierge-shimmer/);
  assert.match(client, /bubble\.textContent = entry\.content/);
  assert.doesNotMatch(client, /bubble\.innerHTML/);
  assert.match(client, /Plan & Customize This Trip with PackSwift/);
  assert.match(client, /"\/api\/trips\/create"/);
  assert.match(client, /trip_recommendation/);
  assert.match(client, /trip_card/);
  assert.match(client, /Trip plan generated successfully!/);
  assert.match(styles, /\.concierge-launcher/);
  assert.match(styles, /\.concierge-trip-card/);
  assert.match(styles, /\.concierge-trip-apply/);
  assert.match(styles, /width: min\(384px/);
  assert.match(styles, /height: min\(520px/);
  assert.match(styles, /html\[data-theme="dark"\] \.concierge-panel/);
  assert.match(styles, /@media \(max-width: 680px\)/);
});

test("Concierge trip action is auth-gated with a persistent guest conversion modal", () => {
  assert.match(client, /Save Your Trip &amp; Unlock 1-Click Planning/);
  assert.match(client, /Instant auto-generated packing lists/);
  assert.match(client, /Offline trip access &amp; PDF exports/);
  assert.match(client, /Smart group expense splitting/);
  assert.match(client, /await window\.PackSwift\.authReady/);
  assert.match(client, /sessionStorage\.setItem\(pendingAiTripKey/);
  assert.match(client, /"save_after_auth"/);
  assert.match(client, /"guest_preview"/);
  assert.match(client, /\/login\?return=/);
  assert.match(client, /\/trip-planner\?pending_ai_trip=1&preview=guest/);
  assert.match(client, /authModalPrimary\.addEventListener\("click"[\s\S]*storePendingAiTrip[\s\S]*closeAuthModal\(\)/);
  assert.match(client, /authModalGuest\.addEventListener\("click"[\s\S]*storePendingAiTrip[\s\S]*closeAuthModal\(\)[\s\S]*window\.location\.assign/);
  assert.match(styles, /\.concierge-auth-modal/);
  assert.match(styles, /backdrop-filter: blur\(8px\)/);
  assert.match(styles, /html\[data-theme="dark"\] \.concierge-auth-card/);
});

test("pending AI trip resumes after sign-in or loads as a database-free guest preview", () => {
  assert.match(planner, /const pendingAiTripKey = "pending_ai_trip"/);
  assert.match(planner, /async function hydratePendingAiTrip/);
  assert.match(planner, /pendingMode === "save_after_auth"/);
  assert.match(planner, /window\.PackSwift\.api\("\/api\/trips\/create"/);
  assert.match(planner, /buildLocalPlan\(input\)/);
  assert.match(planner, /reason: "ai_guest_preview"/);
  assert.match(planner, /if \(await hydratePendingAiTrip\(\)\) return/);
  for (const mapping of [
    /origin: recommendation\.origin/,
    /destination: destinationQuery/,
    /startDate: toIso\(recommendation\.start_date\)/,
    /endDate: toIso\(recommendation\.end_date\)/,
    /adults_count/,
    /children_count/,
    /purposeMap\[recommendation\.travel_purpose\]/,
    /paceMap\[recommendation\.travel_pace\]/,
  ]) assert.match(planner, mapping);
  assert.match(planner, /restorePlannerFormFromPlan\(\{ input \}\)/);
  assert.match(authForms, /authSwitchLink\.href/);
  assert.match(authForms, /encodeURIComponent\(returnPath\(\)\)/);
});

test("one-click Concierge plans persist and reload into the Trip Planner", () => {
  assert.match(tripsRoute, /tripsRouter\.post\([\s\S]*"\/create"/);
  assert.match(tripsRoute, /createTravelPlan\(recommendationPlannerInput\(recommendation\)\)/);
  assert.match(tripsRoute, /saveTrip\(plan, request\.auth\.userId\)/);
  assert.match(planner, /hydrateConciergeTripFromQuery/);
  assert.match(planner, /get\("trip_id"\)/);
  assert.match(planner, /\/api\/trips\/\$\{encodeURIComponent\(tripId\)\}/);
  assert.match(worker, /url\.pathname === "\/api\/trips\/create"/);
  assert.match(worker, /hostedPlanFromRecommendation/);
});

test("hosted Concierge keeps keys private and has a durable rate-limit fallback", () => {
  assert.match(worker, /url\.pathname !== "\/api\/ai\/chat"/);
  assert.match(worker, /hosted_ai_rate_limits/);
  assert.match(hostedMigration, /CREATE TABLE IF NOT EXISTS hosted_ai_rate_limits/);
  assert.match(worker, /env\.OPENAI_API_KEY/);
  assert.match(worker, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(worker, /packswift_fallback/);
  assert.doesNotMatch(worker, /Continue at \/assist-stay/);
  assert.match(envExample, /OPENAI_API_KEY=/);
  assert.match(envExample, /GEMINI_API_KEY=/);
  assert.match(envExample, /OPENAI_MODEL=gpt-4o-mini/);
  assert.doesNotMatch(client, /OPENAI_API_KEY|GEMINI_API_KEY|Bearer test-secret-key/);
});
