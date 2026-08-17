import { FunctionCallingConfigMode, GoogleGenAI } from "@google/genai";
import { cleanTripEntity, normalizeTripRecommendation } from "./ai-concierge-service.js";

const modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const configuredClient = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

export const createTripPlanDeclaration = Object.freeze({
  name: "create_trip_plan",
  description: "Create a complete PackSwift trip card when the traveller asks to plan a trip and provides enough route and date information.",
  parametersJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      origin: {
        type: "string",
        description: "Clean departure city name only, without filler phrases.",
      },
      destination: {
        type: "string",
        description: "Clean arrival city name only. Never include phrases such as 'for a short trip'.",
      },
      start_date: { type: "string", description: "Departure date in DD/MM/YYYY format." },
      end_date: { type: "string", description: "Return date in DD/MM/YYYY format." },
      adults_count: { type: "integer", minimum: 1, maximum: 12 },
      children_count: { type: "integer", minimum: 0, maximum: 8 },
      trip_type: { type: "string", enum: ["Solo", "Couples", "Friends", "Family"] },
      travel_purpose: { type: "string", enum: ["Leisure", "Adventure", "Culture"] },
      budget_estimate: { type: "number", exclusiveMinimum: 0, maximum: 10000000 },
      currency: { type: "string", enum: ["THB", "USD", "MMK"] },
    },
    required: [
      "origin", "destination", "start_date", "end_date", "adults_count",
      "children_count", "trip_type", "travel_purpose", "budget_estimate", "currency",
    ],
  },
});

const systemInstruction = `You are PackSwift Concierge, a friendly expert travel-planning assistant.
Answer general travel questions naturally and concisely. When the user asks to create or plan a trip and gives enough practical details, call create_trip_plan exactly once.
Extract clean city entities only. Destination and origin must never contain filler such as "for a short trip", "for three nights", "next week", or similar planning phrases.
Interpret three nights as four calendar days. Preserve an explicit user budget and currency. Use realistic regional Southeast Asian prices: Yangon to Bangkok round-trip transit is about USD 100 or THB 3,500 before daily expenses.
Ask one focused follow-up question when dates, route, or traveller details are genuinely missing. Never invent a confirmed booking, visa result, or guaranteed live price.`;

const cityCountries = Object.freeze({
  yangon: "Myanmar", mandalay: "Myanmar", bagan: "Myanmar",
  bangkok: "Thailand", phuket: "Thailand", "chiang mai": "Thailand",
  singapore: "Singapore", "kuala lumpur": "Malaysia", hanoi: "Vietnam",
  bali: "Indonesia", tokyo: "Japan", paris: "France",
});

function cleanCity(value) {
  return cleanTripEntity(String(value || "").split(",")[0], 100)
    .replace(/[^a-zA-ZÀ-ž .'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : "")
    .join(" ");
}

function parseDisplayDate(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value || ""));
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
  return date.getUTCFullYear() === Number(match[3]) &&
    date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[1])
    ? date : null;
}

function buildDayHighlights(destination, days, purpose) {
  const themes = purpose === "Adventure"
    ? ["Outdoor orientation", "Signature adventure", "Nature and local discovery"]
    : purpose === "Culture"
      ? ["Heritage orientation", "Landmarks and local history", "Neighbourhood culture"]
      : ["Easy arrival and orientation", "Signature city highlights", "Food and local discovery"];
  return Array.from({ length: days }, (_, index) => {
    const finalDay = index === days - 1;
    return {
      day: index + 1,
      title: finalDay ? `Easy departure from ${destination}` : themes[index % themes.length],
      highlights: finalDay
        ? ["Check out and allow a safe transfer buffer", "Complete final travel checks before departure"]
        : index === 0
          ? [`Arrive in ${destination} and transfer to your stay`, "Settle in with a relaxed neighbourhood walk"]
          : [`Explore a well-rated ${purpose.toLowerCase()} highlight`, "Add a nearby food or cultural stop"],
    };
  });
}

function tripCardFromFunctionArgs(args) {
  const origin = cleanCity(args?.origin);
  const destination = cleanCity(args?.destination);
  const start = parseDisplayDate(args?.start_date);
  const end = parseDisplayDate(args?.end_date);
  const nights = start && end ? Math.round((end - start) / 86400000) : 0;
  const adults = Number(args?.adults_count);
  const children = Number(args?.children_count);
  const budget = Number(args?.budget_estimate);
  const purposeMap = {
    Leisure: "Leisure & Relaxation",
    Adventure: "Adventure & Outdoor",
    Culture: "Culture & Heritage",
  };
  if (!origin || !destination || !start || !end || nights < 1 || nights > 29 ||
      !Number.isInteger(adults) || adults < 1 || adults > 12 ||
      !Number.isInteger(children) || children < 0 || children > 8 || adults + children > 20 ||
      !["Solo", "Couples", "Friends", "Family"].includes(args?.trip_type) ||
      !Object.hasOwn(purposeMap, args?.travel_purpose) ||
      !["THB", "USD", "MMK"].includes(args?.currency) ||
      !Number.isFinite(budget) || budget <= 0) return null;

  const originCountry = cityCountries[origin.toLowerCase()];
  const destinationCountry = cityCountries[destination.toLowerCase()];
  return normalizeTripRecommendation({
    scope: originCountry && destinationCountry && originCountry === destinationCountry
      ? "Nationwide" : "Worldwide",
    origin,
    destination,
    start_date: args.start_date,
    end_date: args.end_date,
    duration_nights: nights,
    duration_days: nights + 1,
    total_budget: budget,
    currency: args.currency,
    adults_count: adults,
    children_count: children,
    pet_included: false,
    travel_purpose: purposeMap[args.travel_purpose],
    travel_group: args.trip_type,
    travel_pace: "Balanced & Steady",
    summary_pitch: `${destination} fits a ${args.trip_type.toLowerCase()} ${args.travel_purpose.toLowerCase()} trip from ${origin}, with the route, dates, travellers, and budget ready to customize.`,
    day_by_day_highlights: buildDayHighlights(destination, nights + 1, args.travel_purpose),
  });
}

function explanationFor(card) {
  const travellers = card.adults_count + card.children_count;
  return `I’ve prepared a ${card.duration_nights}-night / ${card.duration_days}-day ${card.travel_purpose.toLowerCase()} trip from ${card.origin} to ${card.destination}. ✨\n\n• ${travellers} traveller${travellers === 1 ? "" : "s"}\n• ${card.start_date} to ${card.end_date}\n• Estimated total budget: ${card.currency} ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(card.total_budget)}\n\nUse the trip card below to apply every detail to PackSwift in one click.`;
}

function safeHistory(history) {
  return (Array.isArray(history) ? history : []).slice(-12).map((entry) => ({
    role: entry?.role === "assistant" ? "model" : "user",
    parts: [{ text: String(entry?.content || "").replace(/[<>\u0000-\u001F\u007F]/g, "").trim().slice(0, 1200) }],
  })).filter((entry) => entry.parts[0].text);
}

export async function generateTravelAdvice(
  userMessage,
  chatHistory = [],
  { client = configuredClient, model = modelName } = {},
) {
  if (!client) throw new Error("GEMINI_API_KEY is not configured.");
  const message = String(userMessage || "").replace(/[<>\u0000-\u001F\u007F]/g, "").trim().slice(0, 1200);
  if (!message) throw new TypeError("A travel message is required.");
  const response = await client.models.generateContent({
    model,
    contents: [...safeHistory(chatHistory), { role: "user", parts: [{ text: message }] }],
    config: {
      systemInstruction,
      tools: [{ functionDeclarations: [createTripPlanDeclaration] }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      maxOutputTokens: 1800,
    },
  });
  const call = response.functionCalls?.find((item) => item?.name === createTripPlanDeclaration.name);
  const tripCard = call ? tripCardFromFunctionArgs(call.args) : null;
  const reply = tripCard ? explanationFor(tripCard) : String(response.text || "").trim();
  if (!reply) throw new Error("Gemini returned an empty travel response.");
  return {
    reply: reply.slice(0, 6000),
    ...(tripCard ? { trip_card: tripCard, trip_recommendation: tripCard } : {}),
    source: "gemini",
    model,
  };
}
