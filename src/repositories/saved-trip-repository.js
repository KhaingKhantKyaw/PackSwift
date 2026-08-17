import { getDatabasePool } from "../config/database.js";

function parseTripData(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

export async function createSavedTrip(userId, plan) {
  const pool = getDatabasePool();
  const [existingRows] = await pool.execute(
    `SELECT id
     FROM saved_trips
     WHERE user_id = ?
       AND JSON_UNQUOTE(JSON_EXTRACT(trip_data, '$.id')) = ?
     LIMIT 1`,
    [userId, plan.id],
  );
  if (existingRows[0]) {
    await pool.execute(
      `UPDATE saved_trips
       SET destination = ?, travel_month = ?, budget = ?, trip_data = ?
       WHERE id = ? AND user_id = ?`,
      [
        plan.destination.name,
        plan.travelMonth,
        plan.input.budgetUsd,
        JSON.stringify(plan),
        existingRows[0].id,
        userId,
      ],
    );
    return existingRows[0].id;
  }
  const [result] = await pool.execute(
    `INSERT INTO saved_trips
      (user_id, destination, travel_month, budget, trip_data)
     VALUES (?, ?, ?, ?, ?)`,
    [
      userId,
      plan.destination.name,
      plan.travelMonth,
      plan.input.budgetUsd,
      JSON.stringify(plan),
    ],
  );
  return result.insertId;
}

export async function listSavedTrips(userId) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT id, destination, travel_month, budget, trip_data, created_at, updated_at
     FROM saved_trips
     WHERE user_id = ?
     ORDER BY updated_at DESC, id DESC`,
    [userId],
  );
  return rows.map((row) => ({ ...row, trip_data: parseTripData(row.trip_data) }));
}

export async function updateSavedTrip(userId, savedTripId, plan) {
  const pool = getDatabasePool();
  const [result] = await pool.execute(
    `UPDATE saved_trips
     SET destination = ?, travel_month = ?, budget = ?, trip_data = ?
     WHERE id = ? AND user_id = ?`,
    [
      plan.destination.name,
      plan.travelMonth,
      plan.input.budgetUsd,
      JSON.stringify(plan),
      savedTripId,
      userId,
    ],
  );
  return result.affectedRows > 0;
}

export async function deleteSavedTrip(userId, savedTripId) {
  const pool = getDatabasePool();
  const [result] = await pool.execute(
    "DELETE FROM saved_trips WHERE id = ? AND user_id = ?",
    [savedTripId, userId],
  );
  return result.affectedRows > 0;
}
