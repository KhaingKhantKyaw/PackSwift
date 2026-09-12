import { getDatabasePool, isDatabaseConfigured } from "../config/database.js";
import { buildDetailedTimeline } from "../services/itinerary-timeline-service.js";

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mysqlDateTime(value) {
  if (!value) return null;
  const localParts = String(value).match(
    /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/,
  );
  if (localParts) {
    return `${localParts[1]} ${localParts[2]}:${localParts[3] || "00"}`;
  }
  return new Date(value).toISOString().slice(0, 19).replace("T", " ");
}

async function findDestination(connection, slug) {
  const [rows] = await connection.execute(
    `SELECT id, slug, name, country_name, primary_airport_code
     FROM destinations
     WHERE slug = ?
     LIMIT 1`,
    [slug],
  );
  return rows[0] || null;
}

async function insertTimeline(connection, tripSessionId, timeline) {
  for (const entry of timeline) {
    await connection.execute(
      `INSERT INTO itinerary_timeline_items
        (trip_session_id, day_number, sequence_number, start_time, end_time,
         item_type, title, description, location_name, transit_mode,
         estimated_duration_minutes, estimated_cost, cost_currency,
         safety_note, source_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tripSessionId,
        entry.day,
        entry.sequence,
        entry.startTime || null,
        entry.endTime || null,
        entry.type,
        entry.title,
        entry.description,
        entry.locationName || null,
        entry.transitMode || null,
        entry.estimatedDurationMinutes || null,
        entry.estimatedCost || null,
        entry.costCurrency || null,
        entry.safetyNote || null,
        JSON.stringify({
          generator: "PackSwift rule-based timeline",
          version: "1",
        }),
      ],
    );
  }
}

async function insertPackingItems(connection, tripSessionId, packingList) {
  for (const [category, items] of Object.entries(packingList)) {
    for (const itemName of items) {
      await connection.execute(
        `INSERT INTO packing_lists
          (trip_session_id, traveler_group, category, item_name, quantity,
           is_completed, reason_text)
         VALUES (?, 'general', ?, ?, 1, FALSE, ?)`,
        [
          tripSessionId,
          category,
          itemName,
          "Generated from the saved trip context.",
        ],
      );
    }
  }
}

export async function saveTrip(plan, userId = null) {
  if (!userId) {
    return { saved: false, reason: "authentication_required" };
  }

  if (!isDatabaseConfigured()) {
    return { saved: false, reason: "database_not_configured" };
  }

  const pool = getDatabasePool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const destination = await findDestination(
      connection,
      plan.destination.slug,
    );
    const preferences = {
      preferredClimate: plan.input.preferredClimate,
      actualClimate: plan.weather.climate,
      travelerDemographic: plan.input.travelerDemographic,
      travelingWithPets: plan.input.travelingWithPets,
      interests: plan.input.interests,
      smartPace: plan.input.smartPace || {
        lateRiser: false,
        middayRest: false,
        clusterNearby: false,
      },
      route: plan.input.route || null,
      travelerBreakdown: {
        adults: plan.input.adults || plan.input.travelers || 1,
        children: plan.input.children || 0,
      },
      planningGoal: plan.input.planningGoal || "best-value",
      accommodationStyle: plan.input.accommodationStyle || "comfortable",
      foodStyle: plan.input.foodStyle || "mixed",
      transportStyle: plan.input.transportStyle || "mixed",
      activityStyle: plan.input.activityStyle || "balanced",
      shoppingStyle: plan.input.shoppingStyle || "light",
      dateFlexible: plan.input.dateFlexible === true,
      tripLengthFlexible: plan.input.tripLengthFlexible === true,
      mustHaveExperience: plan.input.mustHaveExperience || "",
    };
    const timeline = buildDetailedTimeline(plan, {
      slug: destination?.slug || plan.destination.slug,
      name: destination?.name || plan.destination.name,
      countryName:
        destination?.country_name || plan.destination.country,
      primaryAirportCode:
        destination?.primary_airport_code || plan.destination.code,
      arrivalAt: plan.input.arrivalAt || null,
      hotelName: plan.input.hotelName || null,
    });

    await connection.execute(
      `INSERT INTO traveler_profiles
        (user_id, planning_goal, accommodation_style, food_style,
         transport_style, activity_style, shopping_style, date_flexible,
         trip_length_flexible, must_have_experience)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         planning_goal = VALUES(planning_goal),
         accommodation_style = VALUES(accommodation_style),
         food_style = VALUES(food_style),
         transport_style = VALUES(transport_style),
         activity_style = VALUES(activity_style),
         shopping_style = VALUES(shopping_style),
         date_flexible = VALUES(date_flexible),
         trip_length_flexible = VALUES(trip_length_flexible),
         must_have_experience = VALUES(must_have_experience)`,
      [
        userId,
        preferences.planningGoal,
        preferences.accommodationStyle,
        preferences.foodStyle,
        preferences.transportStyle,
        preferences.activityStyle,
        preferences.shoppingStyle,
        preferences.dateFlexible,
        preferences.tripLengthFlexible,
        preferences.mustHaveExperience || null,
      ],
    );

    const [tripResult] = await connection.execute(
      `INSERT INTO trip_sessions
        (public_id, user_id, destination_id, destination_slug, destination_name,
         trip_scope, origin_name, origin_country, origin_airport_code,
         arrival_airport_code, arrival_at, hotel_name, hotel_address,
         start_date, end_date, budget_amount, budget_currency, travelers,
         adult_count, child_count,
         trip_purpose, pace, interests_json, preferences_json,
         recommendation_score, summary, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        plan.id,
        userId,
        destination?.id || null,
        plan.destination.slug,
        plan.destination.name,
        plan.input.tripScope || plan.input.route?.scope || "international",
        plan.input.route?.origin?.name || plan.input.origin || null,
        plan.input.route?.origin?.country || null,
        plan.input.route?.origin?.code || null,
        destination?.primary_airport_code || plan.destination.code || null,
        mysqlDateTime(plan.input.arrivalAt),
        plan.input.hotelName || null,
        plan.input.hotelAddress || null,
        plan.input.startDate || null,
        plan.input.endDate || null,
        plan.input.budget,
        plan.input.currency,
        plan.input.travelers,
        plan.input.adults || plan.input.travelers || 1,
        plan.input.children || 0,
        plan.input.tripPurpose,
        plan.input.pace,
        JSON.stringify(plan.input.interests),
        JSON.stringify(preferences),
        plan.destination.score,
        plan.summary,
      ],
    );

    await connection.execute(
      `INSERT INTO weather_snapshots
        (trip_session_id, average_low_c, average_high_c, rainfall_level,
         climate_summary, source_name, observed_at)
       VALUES (?, ?, ?, ?, ?, 'PackSwift rule-based climate analysis', CURRENT_TIMESTAMP)`,
      [
        tripResult.insertId,
        plan.weather.low,
        plan.weather.high,
        plan.weather.rain,
        plan.weather.note,
      ],
    );

    for (const day of plan.itinerary) {
      await connection.execute(
        `INSERT INTO itineraries
          (trip_session_id, day_number, title, morning_activity,
           afternoon_activity, evening_activity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          tripResult.insertId,
          day.day,
          day.title,
          day.morning,
          day.afternoon,
          day.evening,
        ],
      );
    }

    await insertTimeline(connection, tripResult.insertId, timeline);
    await insertPackingItems(
      connection,
      tripResult.insertId,
      plan.packingList,
    );
    await connection.commit();
    return {
      saved: true,
      tripId: plan.id,
      databaseId: tripResult.insertId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getOwnedTrip(userId, publicId) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT
       ts.id, ts.public_id, ts.user_id, ts.destination_id,
       ts.destination_slug, ts.destination_name,
       ts.trip_scope, ts.origin_name, ts.origin_country, ts.origin_airport_code,
       ts.arrival_airport_code, ts.arrival_at, ts.hotel_name,
       ts.hotel_address, ts.start_date, ts.end_date,
       ts.budget_amount, ts.budget_currency, ts.travelers,
       ts.adult_count, ts.child_count,
       ts.trip_purpose, ts.pace, ts.interests_json, ts.preferences_json,
       ts.recommendation_score, ts.summary, ts.status,
       ts.created_at, ts.updated_at,
       d.city_name, d.country_name, d.country_code,
       d.primary_airport_code,
       weather.average_low_c, weather.average_high_c,
       weather.rainfall_level, weather.climate_summary
     FROM trip_sessions ts
     LEFT JOIN destinations d ON d.id = ts.destination_id
     LEFT JOIN weather_snapshots weather
       ON weather.id = (
         SELECT MAX(latest_weather.id)
         FROM weather_snapshots latest_weather
         WHERE latest_weather.trip_session_id = ts.id
       )
     WHERE ts.public_id = ?
       AND ts.user_id = ?
     LIMIT 1`,
    [publicId, userId],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  const preferences = parseJson(row.preferences_json, {});
  return {
    id: row.id,
    tripId: row.public_id,
    userId: row.user_id,
    destinationId: row.destination_id,
    destination: {
      slug: row.destination_slug,
      name: row.destination_name,
      cityName: row.city_name || row.destination_name,
      countryName: row.country_name || "",
      countryCode: row.country_code || null,
      displayName:
        row.country_name &&
        !row.destination_name
          .toLocaleLowerCase()
          .includes(row.country_name.toLocaleLowerCase())
          ? `${row.destination_name}, ${row.country_name}`
          : row.destination_name,
      primaryAirportCode:
        row.primary_airport_code ||
        row.arrival_airport_code ||
        null,
    },
    arrival: {
      airportCode:
        row.arrival_airport_code ||
        row.primary_airport_code ||
        null,
      arrivalAt: row.arrival_at,
      hotelName: row.hotel_name,
      hotelAddress: row.hotel_address,
    },
    dates: {
      start: row.start_date,
      end: row.end_date,
    },
    budget: {
      amount: row.budget_amount,
      currency: row.budget_currency,
    },
    travelers: row.travelers,
    travelerBreakdown: {
      adults: Number(row.adult_count) || Number(row.travelers) || 1,
      children: Number(row.child_count) || 0,
    },
    route: {
      scope: row.trip_scope || preferences.route?.scope || "international",
      origin: {
        name: row.origin_name || preferences.route?.origin?.name || "Yangon",
        country: row.origin_country || preferences.route?.origin?.country || "Myanmar",
        code: row.origin_airport_code || preferences.route?.origin?.code || "RGN",
      },
      destination: {
        name: row.destination_name,
        country: row.country_name || preferences.route?.destination?.country || "",
        code: row.primary_airport_code || row.arrival_airport_code || preferences.route?.destination?.code || null,
      },
      estimatedTransitCostUsd: preferences.route?.estimatedTransitCostUsd || null,
    },
    tripPurpose: row.trip_purpose || "leisure",
    pace: row.pace || "balanced",
    interests: parseJson(row.interests_json, []),
    preferences,
    weather: {
      low: row.average_low_c,
      high: row.average_high_c,
      rain: row.rainfall_level || "moderate",
      note: row.climate_summary || "",
      climate: preferences.actualClimate || preferences.preferredClimate || "mild",
    },
    recommendationScore: row.recommendation_score,
    summary: row.summary,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTripTimeline(userId, publicId) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT
       timeline.id, timeline.day_number, timeline.sequence_number,
       timeline.start_time, timeline.end_time, timeline.item_type,
       timeline.title, timeline.description, timeline.location_name,
       timeline.transit_mode, timeline.estimated_duration_minutes,
       timeline.estimated_cost, timeline.cost_currency,
       timeline.safety_note
     FROM itinerary_timeline_items timeline
     JOIN trip_sessions trip ON trip.id = timeline.trip_session_id
     WHERE trip.public_id = ?
       AND trip.user_id = ?
     ORDER BY timeline.day_number, timeline.sequence_number`,
    [publicId, userId],
  );
  return rows.map((row) => ({
    id: row.id,
    day: row.day_number,
    sequence: row.sequence_number,
    startTime: String(row.start_time || "").slice(0, 5) || null,
    endTime: String(row.end_time || "").slice(0, 5) || null,
    type: row.item_type,
    title: row.title,
    description: row.description,
    locationName: row.location_name,
    transitMode: row.transit_mode,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    estimatedCost: row.estimated_cost,
    costCurrency: row.cost_currency,
    safetyNote: row.safety_note,
  }));
}

export async function replaceTripTimeline(userId, publicId, timeline) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [trips] = await connection.execute(
      `SELECT id
       FROM trip_sessions
       WHERE public_id = ? AND user_id = ?
       FOR UPDATE`,
      [publicId, userId],
    );
    if (!trips[0]) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      "DELETE FROM itinerary_timeline_items WHERE trip_session_id = ?",
      [trips[0].id],
    );
    await insertTimeline(connection, trips[0].id, timeline);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function getPackingContext(userId, publicId) {
  const trip = await getOwnedTrip(userId, publicId);
  if (!trip) return null;
  const start = trip.dates.start
    ? new Date(`${trip.dates.start}T00:00:00Z`)
    : null;
  const end = trip.dates.end
    ? new Date(`${trip.dates.end}T00:00:00Z`)
    : null;
  const days =
    start &&
    end &&
    !Number.isNaN(start.valueOf()) &&
    !Number.isNaN(end.valueOf())
      ? Math.max(1, Math.round((end - start) / 86400000) + 1)
      : 1;
  return {
    tripId: trip.tripId,
    destination: trip.destination,
    dates: { ...trip.dates, days },
    weather: trip.weather,
    tripPurpose: trip.tripPurpose,
    pace: trip.pace,
    smartPace: trip.preferences.smartPace || {
      lateRiser: false,
      middayRest: false,
      clusterNearby: false,
    },
    travelers: trip.travelers,
    travelerBreakdown: trip.travelerBreakdown,
    route: trip.route,
    travelerDemographic:
      trip.preferences.travelerDemographic || "adults",
    travelingWithPets:
      trip.preferences.travelingWithPets === true,
    interests: trip.interests,
  };
}

export async function listPackingItems(userId, publicId) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT
       packing.id, packing.traveler_group, packing.category,
       packing.item_name, packing.quantity, packing.is_completed,
       packing.reason_text, packing.updated_at
     FROM packing_lists packing
     JOIN trip_sessions trip ON trip.id = packing.trip_session_id
     WHERE trip.public_id = ?
       AND trip.user_id = ?
     ORDER BY packing.category, packing.id`,
    [publicId, userId],
  );
  return rows.map((row) => ({
    id: row.id,
    travelerGroup: row.traveler_group,
    category: row.category,
    itemName: row.item_name,
    quantity: row.quantity,
    completed: Boolean(row.is_completed),
    reason: row.reason_text,
    updatedAt: row.updated_at,
  }));
}

export async function replacePackingItems(
  userId,
  publicId,
  packingList,
) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [trips] = await connection.execute(
      `SELECT id
       FROM trip_sessions
       WHERE public_id = ? AND user_id = ?
       FOR UPDATE`,
      [publicId, userId],
    );
    if (!trips[0]) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      "DELETE FROM packing_lists WHERE trip_session_id = ?",
      [trips[0].id],
    );
    await insertPackingItems(connection, trips[0].id, packingList);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function updatePackingItem(
  userId,
  publicId,
  itemId,
  completed,
) {
  const pool = getDatabasePool();
  const [result] = await pool.execute(
    `UPDATE packing_lists packing
     JOIN trip_sessions trip ON trip.id = packing.trip_session_id
     SET packing.is_completed = ?
     WHERE packing.id = ?
       AND trip.public_id = ?
       AND trip.user_id = ?`,
    [completed, itemId, publicId, userId],
  );
  return result.affectedRows > 0;
}
