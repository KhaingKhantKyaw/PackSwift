import { getDatabasePool } from '../config/database.js';
import { findUserById } from './user-repository.js';
import { getTripsForUser } from './trip-workspace-repository.js';

export async function getProfile(userId) {
  const [user, trips, travelerProfileResult] = await Promise.all([
    findUserById(userId),
    getTripsForUser(userId),
    getDatabasePool().execute(
      `SELECT planning_goal, accommodation_style, food_style, transport_style,
              activity_style, shopping_style, date_flexible, trip_length_flexible,
              must_have_experience, updated_at
       FROM traveler_profiles WHERE user_id = ? LIMIT 1`, [userId]),
  ]);
  return {
    user,
    savedTrips: trips,
    inProgressTrips: trips.filter(trip => trip.status === 'in_progress'),
    readyTrips: trips.filter(trip => trip.status === 'ready'),
    travelPreferences: travelerProfileResult[0][0] || null,
  };
}
