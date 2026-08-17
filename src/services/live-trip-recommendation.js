import { readFile } from "node:fs/promises";

const budgetRanks = { budget: 0, mid: 1, luxury: 2 };
const paceActivityCount = {
  relaxed: 2,
  balanced: 4,
  packed: 5,
  cultural: 3,
  culinary: 4,
};
const paceResultCount = {
  relaxed: 4,
  balanced: 6,
  packed: 8,
  cultural: 6,
  culinary: 6,
};
const paceScores = {
  relaxed: { slow: 18, balanced: 5, fast: -20 },
  balanced: { slow: 10, balanced: 18, fast: 6 },
  packed: { slow: -8, balanced: 12, fast: 22 },
  cultural: { slow: 18, balanced: 16, fast: 2 },
  culinary: { slow: 10, balanced: 20, fast: 10 },
};
const specializedPaceTags = {
  cultural: ["culture", "history", "temple", "museum", "heritage"],
  culinary: ["food", "market", "cafe", "dinner", "culinary"],
};
const groupExperienceTags = {
  "friends-group": ["group", "social", "nightlife", "shopping", "beach", "yacht"],
  couples: ["romantic", "spa", "sunset", "dinner", "cruise", "wellness"],
  "family-with-children": ["kids", "family", "waterpark", "temple", "private-transfer"],
  "business-duo": ["workation", "networking", "business", "social"],
  solo: ["culture", "food", "market", "workation"],
  senior: ["culture", "temple", "relaxed", "private-transfer"],
};

let seedPromise;

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function normalizePlannerActivity(activity) {
  return {
    ...activity,
    costUsd: Number(activity.costUsd ?? activity.cost_usd ?? 0),
    suitableGroups: asArray(activity.suitableGroups ?? activity.suitable_groups),
    purposeTags: asArray(activity.purposeTags ?? activity.purpose_tags),
    experienceTags: asArray(activity.experienceTags ?? activity.experience_tags),
    budgetTier: activity.budgetTier ?? activity.budget_tier ?? "mid",
    paceLevel: activity.paceLevel ?? activity.pace_level ?? "balanced",
    imageUrl: activity.imageUrl ?? activity.image_url ?? "",
    imageAlt: activity.imageAlt ?? activity.image_alt ?? "",
    imageCredit: activity.imageCredit ?? activity.image_credit ?? "",
    imageSourceUrl: activity.imageSourceUrl ?? activity.image_source_url ?? "",
    sortOrder: Number(activity.sortOrder ?? activity.sort_order ?? 0),
  };
}

export function calculateBudgetProfile({ budgetUsd, days, travelers }) {
  const safeDays = Math.max(1, Math.min(30, Number(days) || 1));
  const safeTravelers = Math.max(1, Math.min(20, Number(travelers) || 1));
  const perPersonDayUsd = Math.max(0, Number(budgetUsd) || 0) / safeDays / safeTravelers;
  const tier = perPersonDayUsd < 70 ? "budget" : perPersonDayUsd < 180 ? "mid" : "luxury";
  const label = tier === "budget" ? "Value" : tier === "mid" ? "Comfort" : "Premium";
  return {
    tier,
    label,
    perPersonDayUsd: Math.round(perPersonDayUsd * 100) / 100,
  };
}

function activityScore(activity, input, profile) {
  if (!activity.suitableGroups.includes(input.group)) return Number.NEGATIVE_INFINITY;
  let score = 40;
  if (activity.purposeTags.includes(input.purpose)) score += 30;
  else score -= 12;

  score += paceScores[input.pace]?.[activity.paceLevel] ?? 0;
  const budgetDistance = budgetRanks[activity.budgetTier] - budgetRanks[profile.tier];
  score += budgetDistance === 0 ? 18 : budgetDistance < 0 ? 10 : -12 * budgetDistance;
  if (activity.costUsd > profile.perPersonDayUsd * 1.5) score -= 12;

  const preferredTags = groupExperienceTags[input.group] || [];
  score += activity.experienceTags.filter((tag) => preferredTags.includes(tag)).length * 8;
  const paceTags = specializedPaceTags[input.pace] || [];
  score += activity.experienceTags.filter((tag) => paceTags.includes(tag)).length * 14;
  if (
    input.group === "friends-group" && input.purpose === "leisure" &&
    activity.experienceTags.includes("yacht")
  ) score += 36;
  if (
    input.group === "couples" && input.purpose === "leisure" &&
    activity.experienceTags.includes("romantic")
  ) score += 28;
  if (
    input.group === "family-with-children" &&
    activity.experienceTags.includes("kids")
  ) score += 28;
  return score;
}

function buildItinerary(ranked, days, input) {
  const perDay = paceActivityCount[input.pace] || 3;
  const previewDays = Math.max(1, Math.min(Number(days) || 1, 3));
  const source = input.clusterNearby
    ? [...ranked].sort((first, second) => first.category.localeCompare(second.category))
    : ranked;
  return Array.from({ length: previewDays }, (_, dayIndex) => ({
    day: dayIndex + 1,
    startTime: input.lateRiser ? "10:30" : "08:30",
    middayRest: input.middayRest,
    clusterNearby: input.clusterNearby,
    activities: Array.from({ length: perDay }, (_, activityIndex) =>
      source[(dayIndex * perDay + activityIndex) % source.length],
    ).filter(Boolean),
  }));
}

export function recommendPlannerActivities(activities, input) {
  const normalized = activities.map(normalizePlannerActivity);
  const profile = calculateBudgetProfile(input);
  const ranked = normalized
    .map((activity) => ({ activity, score: activityScore(activity, input, profile) }))
    .filter(({ score }) => Number.isFinite(score))
    .sort((first, second) =>
      second.score - first.score || first.activity.sortOrder - second.activity.sortOrder,
    )
    .map(({ activity }) => activity);

  const perDay = paceActivityCount[input.pace] || 3;
  const resultCount = paceResultCount[input.pace] || 6;
  const specializedTags = specializedPaceTags[input.pace] || [];
  const displayRanked = specializedTags.length
    ? ranked.filter((activity) =>
        activity.experienceTags.some((tag) => specializedTags.includes(tag)))
    : ranked;
  const candidateActivities = displayRanked.length ? displayRanked : ranked;
  return {
    city: {
      id: input.cityId || ranked[0]?.cityId || "bkk",
      name: ranked[0]?.cityName || "Bangkok",
    },
    budget: profile,
    activitiesPerDay: perDay,
    schedule: {
      startTime: input.lateRiser ? "10:30" : "08:30",
      middayRest: input.middayRest,
      clusterNearby: input.clusterNearby,
    },
    activities: candidateActivities.slice(0, resultCount),
    candidateActivities: candidateActivities.slice(0, 20),
    itinerary: buildItinerary(
      ranked.slice(0, Math.max(perDay * 3, 6)),
      input.days,
      input,
    ),
  };
}

export function readPlannerActivitySeed() {
  seedPromise ??= readFile(
    new URL("../../public/data/planner-activities.json", import.meta.url),
    "utf8",
  ).then(JSON.parse);
  return seedPromise;
}
