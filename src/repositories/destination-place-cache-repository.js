import { getDatabasePool } from "../config/database.js";

export async function rememberDestinationPlaceReferences({
  destinationKey,
  destinationName,
  destinationScope,
  countryName,
  requestCategory,
  searchQuery,
  categoryTags,
  places,
}) {
  const pool = getDatabasePool();
  if (!pool || !places.length) return 0;
  let remembered = 0;
  for (const place of places) {
    if (!place.providerPlaceId) continue;
    const [result] = await pool.execute(
      `INSERT INTO destination_places_cache
        (provider, provider_place_id, destination_key, destination_name,
         destination_scope, country_name, request_category, search_query,
         category_tags, last_seen_at)
       VALUES ('google_places', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         destination_name = VALUES(destination_name),
         destination_scope = VALUES(destination_scope),
         country_name = VALUES(country_name),
         request_category = VALUES(request_category),
         search_query = VALUES(search_query),
         category_tags = VALUES(category_tags),
         last_seen_at = CURRENT_TIMESTAMP`,
      [
        place.providerPlaceId,
        destinationKey,
        destinationName,
        destinationScope,
        countryName || null,
        requestCategory,
        searchQuery,
        JSON.stringify(categoryTags || []),
      ],
    );
    remembered += Number(result.affectedRows > 0);
  }
  return remembered;
}

export async function findDestinationPlaceReferences({
  destinationKey,
  requestCategory,
  limit = 16,
}) {
  const pool = getDatabasePool();
  if (!pool) return [];
  const safeLimit = Math.max(4, Math.min(20, Number(limit) || 16));
  const [rows] = await pool.execute(
    `SELECT provider_place_id, destination_name, destination_scope,
            country_name, search_query, category_tags, last_seen_at
     FROM destination_places_cache
     WHERE provider = 'google_places'
       AND destination_key = ?
       AND request_category = ?
       AND last_seen_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
     ORDER BY last_seen_at DESC
     LIMIT ${safeLimit}`,
    [destinationKey, requestCategory],
  );
  return rows.map((row) => ({
    providerPlaceId: row.provider_place_id,
    destinationName: row.destination_name,
    destinationScope: row.destination_scope,
    countryName: row.country_name,
    searchQuery: row.search_query,
    categoryTags: typeof row.category_tags === "string"
      ? JSON.parse(row.category_tags)
      : row.category_tags || [],
    lastSeenAt: row.last_seen_at,
  }));
}
