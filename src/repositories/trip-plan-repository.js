import { getDatabasePool, isDatabaseConfigured } from "../config/database.js";

export async function listSavedTripPlaceIds(userId, tripPublicId) {
  if (!userId || !tripPublicId || !isDatabaseConfigured()) return [];
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT item.provider, item.place_id
     FROM trip_itinerary_items item
     JOIN trip_sessions trip ON trip.id = item.trip_session_id
     WHERE trip.public_id = ? AND trip.user_id = ?
     ORDER BY item.position ASC, item.id ASC`,
    [tripPublicId, userId],
  );
  return rows.map((row) => row.place_id);
}

export async function addPlaceToTrip(userId, { tripId, placeId, provider }) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [trips] = await connection.execute(
      `SELECT id
       FROM trip_sessions
       WHERE public_id = ? AND user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [tripId, userId],
    );
    const trip = trips[0];
    if (!trip) {
      await connection.rollback();
      return null;
    }
    const [existing] = await connection.execute(
      `SELECT id, position
       FROM trip_itinerary_items
       WHERE trip_session_id = ? AND provider = ? AND place_id = ?
       LIMIT 1`,
      [trip.id, provider, placeId],
    );
    if (existing[0]) {
      await connection.commit();
      return { id: existing[0].id, position: existing[0].position, alreadySaved: true };
    }
    const [positions] = await connection.execute(
      `SELECT COALESCE(MAX(position), 0) + 1 AS next_position
       FROM trip_itinerary_items
       WHERE trip_session_id = ?`,
      [trip.id],
    );
    const position = Number(positions[0]?.next_position || 1);
    const [result] = await connection.execute(
      `INSERT INTO trip_itinerary_items
        (trip_session_id, provider, place_id, position)
       VALUES (?, ?, ?, ?)`,
      [trip.id, provider, placeId, position],
    );
    await connection.commit();
    return { id: result.insertId, position, alreadySaved: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
