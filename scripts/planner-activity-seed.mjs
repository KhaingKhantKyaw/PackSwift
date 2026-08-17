import { readFile } from "node:fs/promises";

export async function seedPlannerActivities(connection) {
  const activities = JSON.parse(await readFile(
    new URL("../public/data/planner-activities.json", import.meta.url),
    "utf8",
  ));
  for (const activity of activities) {
    await connection.execute(
      `INSERT INTO planner_activities
        (city_id, city_name, slug, title, category, description, cost_usd,
         image_url, image_alt, image_credit, image_source_url, suitable_groups,
         purpose_tags, budget_tier, pace_level, experience_tags, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         city_name = VALUES(city_name), title = VALUES(title),
         category = VALUES(category), description = VALUES(description),
         cost_usd = VALUES(cost_usd), image_url = VALUES(image_url),
         image_alt = VALUES(image_alt), image_credit = VALUES(image_credit),
         image_source_url = VALUES(image_source_url),
         suitable_groups = VALUES(suitable_groups), purpose_tags = VALUES(purpose_tags),
         budget_tier = VALUES(budget_tier), pace_level = VALUES(pace_level),
         experience_tags = VALUES(experience_tags), sort_order = VALUES(sort_order),
         is_active = TRUE`,
      [
        activity.cityId, activity.cityName, activity.slug, activity.title,
        activity.category, activity.description, activity.costUsd,
        activity.imageUrl, activity.imageAlt, activity.imageCredit,
        activity.imageSourceUrl, JSON.stringify(activity.suitableGroups),
        JSON.stringify(activity.purposeTags), activity.budgetTier,
        activity.paceLevel, JSON.stringify(activity.experienceTags),
        activity.sortOrder,
      ],
    );
  }
  return activities.length;
}
