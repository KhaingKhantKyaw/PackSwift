import {
  findDestinationBySlug,
  getAllDestinationMetrics,
  listDestinationEvidence,
  upsertDestinationInsightSnapshot,
} from "../repositories/destination-repository.js";

export const insightAlgorithmVersion = "community-rules-v1";

export function calculatePopularityScore({
  reviewCount = 0,
  reportCount = 0,
  savedTripCount = 0,
  averageRating = 0,
}) {
  return Math.round(
    (reviewCount * 2 +
      reportCount * 1.5 +
      savedTripCount +
      averageRating * 5) *
      100,
  ) / 100;
}

function normalizedTip(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
}

function rankedTextValues(values, limit) {
  const counts = new Map();
  for (const value of values.map(normalizedTip).filter(Boolean)) {
    const key = value.toLocaleLowerCase();
    const entry = counts.get(key) || { value, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()]
    .sort((first, second) =>
      second.count - first.count ||
      first.value.localeCompare(second.value),
    )
    .slice(0, limit)
    .map((entry) => entry.value);
}

function collectTagValues(rows, field) {
  return rows.flatMap((row) =>
    Array.isArray(row[field]) ? row[field].map(normalizedTip) : [],
  );
}

export function synthesizeCommunityGuidance(evidence) {
  const knowStatements = evidence.reviews.map((review) => review.what_to_know);
  const avoidStatements = evidence.reviews.map((review) => review.what_to_avoid);
  const positiveTags = collectTagValues(evidence.reviews, "positive_tags_json");
  const cautionTags = collectTagValues(evidence.reviews, "caution_tags_json");

  const whatToKnow = rankedTextValues(
    [
      ...knowStatements,
      ...positiveTags.map(
        (tag) => `PackSwift travellers frequently mention ${tag}.`,
      ),
    ],
    5,
  );
  const whatToAvoid = rankedTextValues(
    [
      ...avoidStatements,
      ...cautionTags.map(
        (tag) => `Take extra care with ${tag}.`,
      ),
    ],
    5,
  );

  return { whatToKnow, whatToAvoid };
}

export async function getDestinationInsight(slug) {
  const destination = await findDestinationBySlug(slug);
  if (!destination) return null;

  const [allMetrics, evidence] = await Promise.all([
    getAllDestinationMetrics(),
    listDestinationEvidence(destination.id),
  ]);
  const rankedMetrics = allMetrics
    .map((metrics) => ({
      ...metrics,
      popularityScore: calculatePopularityScore(metrics),
    }))
    .sort((first, second) =>
      second.popularityScore - first.popularityScore ||
      first.destinationId - second.destinationId,
    );
  const selectedIndex = rankedMetrics.findIndex(
    (metrics) => metrics.destinationId === Number(destination.id),
  );
  const metrics = rankedMetrics[selectedIndex];
  const guidance = synthesizeCommunityGuidance(evidence);
  const contributionCount = metrics.reviewCount + metrics.reportCount;
  const hasCommunityEvidence = contributionCount > 0;
  const overview = contributionCount
    ? `${destination.canonicalOverview || destination.displayName} This summary reflects ${contributionCount} PackSwift community ${contributionCount === 1 ? "contribution" : "contributions"}.`
    : destination.canonicalOverview ||
      `${destination.displayName} is ready for its first PackSwift community report.`;

  const snapshot = {
    destinationId: Number(destination.id),
    overview,
    popularityScore: metrics.popularityScore,
    popularityRank: hasCommunityEvidence ? selectedIndex + 1 : null,
    rankedDestinationCount: rankedMetrics.length,
    averageRating: metrics.averageRating,
    reviewCount: metrics.reviewCount,
    reportCount: metrics.reportCount,
    savedTripCount: metrics.savedTripCount,
    whatToKnow: guidance.whatToKnow,
    whatToAvoid: guidance.whatToAvoid,
    evidence: {
      source: "PackSwift community reviews and travel reports",
      reviewPostIds: evidence.reviews.map((review) => review.id),
      reportPostIds: evidence.reports.map((report) => report.id),
    },
    algorithmVersion: insightAlgorithmVersion,
    sourceContentUpdatedAt: metrics.sourceContentUpdatedAt,
  };

  await upsertDestinationInsightSnapshot(snapshot);

  return {
    destination,
    insight: {
      overview: snapshot.overview,
      popularity: {
        rank: snapshot.popularityRank,
        outOf: snapshot.rankedDestinationCount,
        score: snapshot.popularityScore,
        label: hasCommunityEvidence
          ? "PackSwift worldwide popularity rank"
          : "Not yet ranked — community reviews are required",
      },
      averageRating: snapshot.averageRating || null,
      reviewCount: snapshot.reviewCount,
      reportCount: snapshot.reportCount,
      savedTripCount: snapshot.savedTripCount,
      whatToKnow: snapshot.whatToKnow,
      whatToAvoid: snapshot.whatToAvoid,
      evidence: snapshot.evidence,
      algorithmVersion: snapshot.algorithmVersion,
    },
  };
}
