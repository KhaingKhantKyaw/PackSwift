import { getDatabasePool } from "../config/database.js";
import { normalizePlannerActivity } from "../services/live-trip-recommendation.js";

export async function findPlannerActivities(cityId) {
  const pool = getDatabasePool();
  if (!pool) return [];
  const [rows] = await pool.execute(
    `SELECT city_id AS cityId, city_name AS cityName, slug, title, category,
            description, cost_usd AS costUsd, image_url AS imageUrl,
            image_alt AS imageAlt, image_credit AS imageCredit,
            image_source_url AS imageSourceUrl,
            suitable_groups AS suitableGroups, purpose_tags AS purposeTags,
            budget_tier AS budgetTier, pace_level AS paceLevel,
            experience_tags AS experienceTags, sort_order AS sortOrder
       FROM planner_activities
      WHERE city_id = ? AND is_active = TRUE
      ORDER BY sort_order ASC, id ASC`,
    [cityId],
  );
  return rows.map(normalizePlannerActivity);
}
