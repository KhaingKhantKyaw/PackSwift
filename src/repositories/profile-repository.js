import { getDatabasePool } from "../config/database.js";
import { findUserById } from "./user-repository.js";
import { listOrders } from "./order-repository.js";

export async function getProfile(userId) {
  const pool = getDatabasePool();
  const [user, tripsResult, readinessTripsResult, orders] = await Promise.all([
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
                 AND readiness.is_completed = TRUE) AS prepared_count,
              (SELECT COUNT(*)
               FROM orders booking
               WHERE booking.trip_session_id = trip_sessions.id
                 AND booking.category IN ('flight', 'accommodation')
                 AND booking.status IN ('confirmed', 'completed')
                 AND booking.payment_status = 'PAID') AS confirmed_booking_count
       FROM trip_sessions
       WHERE user_id = ? AND status <> 'archived'
       ORDER BY start_date IS NULL, start_date, updated_at DESC
       LIMIT 40`,
      [userId],
    ),
    listOrders(userId),
  ]);

  const readinessTrips = readinessTripsResult[0].map((row) => {
    const requiredTotal = Number(row.required_total || 0);
    const preparedCount = Number(row.prepared_count || 0);
    const remainingCount = Math.max(0, requiredTotal - preparedCount);
    const confirmedBookingCount = Number(row.confirmed_booking_count || 0);
    const ready = requiredTotal > 0 && preparedCount === requiredTotal;
    return {
      ...row,
      required_total: requiredTotal,
      prepared_count: preparedCount,
      remaining_count: remainingCount,
      confirmed_booking_count: confirmedBookingCount,
      progress_percentage: requiredTotal
        ? Math.round((preparedCount / requiredTotal) * 100)
        : 0,
      readiness_stage: ready
        ? "ready"
        : confirmedBookingCount > 0
          ? "booked_confirmed"
          : "planned",
    };
  });

  return {
    user,
    savedTrips: tripsResult[0],
    inProgressTrips: readinessTrips.filter(
      (trip) => trip.readiness_stage === "booked_confirmed",
    ),
    readyTrips: readinessTrips.filter(
      (trip) => trip.readiness_stage === "ready",
    ),
    orders,
  };
}
