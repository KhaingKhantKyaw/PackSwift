import { getDatabasePool } from "../config/database.js";
import { findUserById } from "./user-repository.js";

export async function getProfile(userId) {
  const pool = getDatabasePool();
  const [user, tripsResult, readinessTripsResult] = await Promise.all([
    findUserById(userId),
    pool.execute(
      `SELECT id, destination, travel_month, budget, trip_data, created_at, updated_at
       FROM saved_trips
       WHERE user_id = ?
       ORDER BY updated_at DESC, id DESC
       LIMIT 20`,
      [userId],
    ),
    pool.execute(
      `SELECT public_id AS trip_id, destination_name AS destination,
              start_date, end_date, budget_amount, budget_currency,
              status, updated_at,
              (SELECT COUNT(*)
               FROM trip_readiness_items readiness
               WHERE readiness.trip_session_id = trip_sessions.id
                 AND readiness.is_required = TRUE) AS required_total,
              (SELECT COUNT(*)
               FROM trip_readiness_items readiness
               WHERE readiness.trip_session_id = trip_sessions.id
                 AND readiness.is_required = TRUE
                 AND readiness.is_completed = TRUE) AS prepared_count
       FROM trip_sessions
       WHERE user_id = ? AND status <> 'archived'
       ORDER BY start_date IS NULL, start_date, updated_at DESC
       LIMIT 40`,
      [userId],
    ),
  ]);

  const readinessTrips = readinessTripsResult[0].map((row) => {
    const requiredTotal = Number(row.required_total || 0);
    const preparedCount = Number(row.prepared_count || 0);
    const remainingCount = Math.max(0, requiredTotal - preparedCount);
    const ready = requiredTotal > 0 && preparedCount === requiredTotal;
    return {
      ...row,
      required_total: requiredTotal,
      prepared_count: preparedCount,
      remaining_count: remainingCount,
      progress_percentage: requiredTotal
        ? Math.round((preparedCount / requiredTotal) * 100)
        : 0,
      readiness_stage: ready ? "ready" : "planned",
    };
  });

  return {
    user,
    savedTrips: tripsResult[0],
    inProgressTrips: readinessTrips.filter(
      (trip) => trip.readiness_stage === "planned" && trip.required_total > 0,
    ),
    readyTrips: readinessTrips.filter(
      (trip) => trip.readiness_stage === "ready",
    ),
  };
}
