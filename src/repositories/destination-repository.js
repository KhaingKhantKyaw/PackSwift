import { getDatabasePool } from "../config/database.js";

function parseJson(value, fallback = []) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapDestination(row) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.destination_type,
    name: row.name,
    cityName: row.city_name,
    countryName: row.country_name,
    countryCode: row.country_code,
    displayName:
      row.city_name && row.city_name !== row.country_name
        ? `${row.city_name}, ${row.country_name}`
        : row.name,
    canonicalOverview: row.canonical_overview,
    primaryAirportCode: row.primary_airport_code,
    latitude: row.latitude,
    longitude: row.longitude,
    popularityRank: row.popularity_rank ?? null,
    popularityScore: row.popularity_score ?? null,
    averageRating: row.average_rating ?? null,
    reviewCount: Number(row.review_count || 0),
    reportCount: Number(row.report_count || 0),
  };
}

export async function searchDestinations({ search = "", limit = 20 } = {}) {
  const pool = getDatabasePool();
  const trimmedSearch = String(search).trim().slice(0, 100);
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const parameters = [];
  let where = "";
  let relevance = "d.name ASC";

  if (trimmedSearch) {
    const contains = `%${trimmedSearch}%`;
    const prefix = `${trimmedSearch}%`;
    where = `
      WHERE d.name LIKE ?
         OR d.city_name LIKE ?
         OR d.country_name LIKE ?
         OR d.canonical_overview LIKE ?`;
    relevance = `
      CASE
        WHEN LOWER(d.name) = LOWER(?) THEN 0
        WHEN d.name LIKE ? THEN 1
        WHEN d.city_name LIKE ? THEN 2
        WHEN d.country_name LIKE ? THEN 3
        ELSE 4
      END,
      COALESCE(s.popularity_rank, 2147483647),
      d.name`;
    parameters.push(
      contains,
      contains,
      contains,
      contains,
      trimmedSearch,
      prefix,
      prefix,
      prefix,
    );
  }

  const [rows] = await pool.execute(
    `SELECT
       d.id, d.slug, d.destination_type, d.name, d.city_name,
       d.country_name, d.country_code, d.canonical_overview,
       d.primary_airport_code, d.latitude, d.longitude,
       s.popularity_rank, s.popularity_score, s.average_rating,
       s.review_count, s.report_count
     FROM destinations d
     LEFT JOIN destination_insight_snapshots s
       ON s.destination_id = d.id
     ${where}
     ORDER BY ${relevance}
     LIMIT ${safeLimit}`,
    parameters,
  );

  return rows.map(mapDestination);
}

export async function findDestinationBySlug(slug) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT
       d.id, d.slug, d.destination_type, d.name, d.city_name,
       d.country_name, d.country_code, d.canonical_overview,
       d.primary_airport_code, d.latitude, d.longitude,
       s.popularity_rank, s.popularity_score, s.average_rating,
       s.review_count, s.report_count
     FROM destinations d
     LEFT JOIN destination_insight_snapshots s
       ON s.destination_id = d.id
     WHERE d.slug = ?
     LIMIT 1`,
    [slug],
  );
  return rows[0] ? mapDestination(rows[0]) : null;
}

export async function getAllDestinationMetrics() {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT
       d.id,
       COALESCE(reviews.review_count, 0) AS review_count,
       COALESCE(reviews.average_rating, 0) AS average_rating,
       COALESCE(reports.report_count, 0) AS report_count,
       COALESCE(trips.saved_trip_count, 0) AS saved_trip_count,
       CASE
         WHEN reviews.latest_review_at IS NULL
          AND reports.latest_report_at IS NULL
          AND trips.latest_trip_at IS NULL
         THEN NULL
         ELSE GREATEST(
           COALESCE(reviews.latest_review_at, '1970-01-02 00:00:00'),
           COALESCE(reports.latest_report_at, '1970-01-02 00:00:00'),
           COALESCE(trips.latest_trip_at, '1970-01-02 00:00:00')
         )
       END AS source_content_updated_at
     FROM destinations d
     LEFT JOIN (
       SELECT
         destination_id,
         COUNT(*) AS review_count,
         AVG(rating) AS average_rating,
         MAX(updated_at) AS latest_review_at
       FROM community_posts
       WHERE post_type = 'place_review'
       GROUP BY destination_id
     ) reviews ON reviews.destination_id = d.id
     LEFT JOIN (
       SELECT
         destination_id,
         COUNT(*) AS report_count,
         MAX(updated_at) AS latest_report_at
       FROM community_posts
       WHERE post_type = 'travel_report'
       GROUP BY destination_id
     ) reports ON reports.destination_id = d.id
     LEFT JOIN (
       SELECT
         destination_id,
         COUNT(*) AS saved_trip_count,
         MAX(updated_at) AS latest_trip_at
       FROM trip_sessions
       WHERE user_id IS NOT NULL
       GROUP BY destination_id
     ) trips ON trips.destination_id = d.id`,
  );

  return rows.map((row) => ({
    destinationId: Number(row.id),
    reviewCount: Number(row.review_count),
    averageRating: Number(row.average_rating),
    reportCount: Number(row.report_count),
    savedTripCount: Number(row.saved_trip_count),
    sourceContentUpdatedAt: row.source_content_updated_at,
  }));
}

export async function listDestinationEvidence(destinationId) {
  const pool = getDatabasePool();
  const [reviewRows] = await pool.execute(
    `SELECT
       p.id, p.title, p.content, p.rating, p.updated_at,
       details.what_to_know, details.what_to_avoid,
       details.positive_tags_json, details.caution_tags_json
     FROM community_posts p
     LEFT JOIN place_review_details details ON details.post_id = p.id
     WHERE p.destination_id = ?
       AND p.post_type = 'place_review'
     ORDER BY p.updated_at DESC
     LIMIT 200`,
    [destinationId],
  );
  const [reportRows] = await pool.execute(
    `SELECT id, title, content, updated_at
     FROM community_posts
     WHERE destination_id = ?
       AND post_type = 'travel_report'
     ORDER BY updated_at DESC
     LIMIT 100`,
    [destinationId],
  );

  return {
    reviews: reviewRows.map((row) => ({
      ...row,
      positive_tags_json: parseJson(row.positive_tags_json),
      caution_tags_json: parseJson(row.caution_tags_json),
    })),
    reports: reportRows,
  };
}

export async function getDestinationInsightSnapshot(destinationId) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT *
     FROM destination_insight_snapshots
     WHERE destination_id = ?
     LIMIT 1`,
    [destinationId],
  );
  if (!rows[0]) return null;
  return {
    ...rows[0],
    what_to_know_json: parseJson(rows[0].what_to_know_json),
    what_to_avoid_json: parseJson(rows[0].what_to_avoid_json),
    evidence_json: parseJson(rows[0].evidence_json, {}),
  };
}

export async function upsertDestinationInsightSnapshot(snapshot) {
  const pool = getDatabasePool();
  await pool.execute(
    `INSERT INTO destination_insight_snapshots
      (destination_id, overview, popularity_score, popularity_rank,
       ranked_destination_count, average_rating, review_count, report_count,
       saved_trip_count, what_to_know_json, what_to_avoid_json, evidence_json,
       algorithm_version, source_content_updated_at, generated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       overview = VALUES(overview),
       popularity_score = VALUES(popularity_score),
       popularity_rank = VALUES(popularity_rank),
       ranked_destination_count = VALUES(ranked_destination_count),
       average_rating = VALUES(average_rating),
       review_count = VALUES(review_count),
       report_count = VALUES(report_count),
       saved_trip_count = VALUES(saved_trip_count),
       what_to_know_json = VALUES(what_to_know_json),
       what_to_avoid_json = VALUES(what_to_avoid_json),
       evidence_json = VALUES(evidence_json),
       algorithm_version = VALUES(algorithm_version),
       source_content_updated_at = VALUES(source_content_updated_at),
       generated_at = CURRENT_TIMESTAMP`,
    [
      snapshot.destinationId,
      snapshot.overview,
      snapshot.popularityScore,
      snapshot.popularityRank,
      snapshot.rankedDestinationCount,
      snapshot.averageRating || null,
      snapshot.reviewCount,
      snapshot.reportCount,
      snapshot.savedTripCount,
      JSON.stringify(snapshot.whatToKnow),
      JSON.stringify(snapshot.whatToAvoid),
      JSON.stringify(snapshot.evidence),
      snapshot.algorithmVersion,
      snapshot.sourceContentUpdatedAt || null,
    ],
  );
}
