import { getDatabasePool } from "../config/database.js";

const baseReadinessItems = [
  {
    key: "passport",
    category: "Documents",
    name: "Passport",
    description: "Check passport validity and keep a secure digital copy.",
    smartTag: "Required before departure",
    assistantType: "concierge",
  },
  {
    key: "visa",
    category: "Documents",
    name: "Visa and entry permission",
    description: "Confirm entry rules for the selected origin and destination.",
    smartTag: "Country-specific requirement",
    assistantType: "concierge",
  },
  {
    key: "air-tickets",
    category: "Documents",
    name: "E-Tickets",
    description: "Choose a suitable route and keep the confirmed itinerary ready.",
    smartTag: "Matched to your route",
    assistantType: "concierge",
  },
  {
    key: "accommodation",
    category: "Documents",
    name: "Hotel Vouchers",
    description: "Reserve a stay that fits the trip dates, group, and destination.",
    smartTag: "Matched to your travel dates",
    assistantType: "concierge",
  },
  {
    key: "personal-prescriptions",
    category: "Health & Medication",
    name: "Personal Prescriptions",
    description: "Carry enough prescribed medication in labelled packaging.",
    smartTag: "Keep in hand-carry",
    assistantType: "concierge",
  },
  {
    key: "first-aid-kit",
    category: "Health & Medication",
    name: "First Aid Kit",
    description: "Prepare compact first-aid supplies for common minor injuries.",
    smartTag: "Health essential",
    assistantType: "concierge",
  },
  {
    key: "motion-sickness",
    category: "Health & Medication",
    name: "Motion Sickness Pills",
    description: "Consider suitable medication for flights, boats, or long transfers.",
    smartTag: "Useful for transit",
    assistantType: "concierge",
  },
  {
    key: "clothes",
    category: "Clothing & Gear",
    name: "Weather-appropriate outfits",
    description: "Prepare comfortable layers that match the expected conditions.",
    smartTag: "Weather-matched",
    assistantType: "concierge",
  },
  {
    key: "footwear",
    category: "Clothing & Gear",
    name: "Travel Footwear",
    description: "Pack comfortable shoes suited to the planned activities.",
    smartTag: "Activity-matched",
    assistantType: "concierge",
  },
  {
    key: "swimwear",
    category: "Clothing & Gear",
    name: "Swimwear and quick-dry towel",
    description: "Include water-ready essentials when the itinerary includes pools or beaches.",
    smartTag: "Destination activity",
    assistantType: "concierge",
  },
  {
    key: "luggage-30kg",
    category: "Clothing & Gear",
    name: "30kg Luggage / Hand-Carry",
    description: "Prepare suitable checked and cabin luggage for the trip duration.",
    smartTag: "Trip-duration matched",
    assistantType: "concierge",
  },
  {
    key: "power-adapter",
    category: "Electronics & Tech",
    name: "Universal Power Adapter",
    description: "Check destination plug types before departure.",
    smartTag: "Destination plug check",
    assistantType: "concierge",
  },
  {
    key: "power-bank",
    category: "Electronics & Tech",
    name: "Power Bank",
    description: "Carry a compliant portable charger for navigation and communication.",
    smartTag: "Transit essential",
    assistantType: "concierge",
  },
  {
    key: "charging-cables",
    category: "Electronics & Tech",
    name: "Charging Cables",
    description: "Pack labelled cables for every essential device.",
    smartTag: "Device check",
    assistantType: "concierge",
  },
];

function readinessItemsForTrip(trip) {
  const items = [...baseReadinessItems];
  if (trip.weather?.rain && trip.weather.rain !== "low") {
    items.push({
      key: "rain-protection",
      category: "Clothing & Gear",
      name: "Rain protection",
      description: "Prepare a compact umbrella or lightweight rain shell.",
      smartTag: "Essential for Rainy Season",
      assistantType: "concierge",
    });
  }
  if (Number(trip.travelerBreakdown?.children || 0) > 0) {
    items.push({
      key: "kid-care",
      category: "Special Care",
      name: "Kid Care Essentials",
      description: "Prepare child documents, comfort items, snacks, and age-appropriate care supplies.",
      smartTag: "Required for Kids",
      assistantType: "concierge",
    });
  }
  if (trip.preferences?.travelingWithPets === true) {
    items.push({
      key: "pet-travel-kit",
      category: "Special Care",
      name: "Pet Travel Supplies",
      description: "Prepare vaccination records, carrier, food, medication, and identification.",
      smartTag: "Required for Pets",
      assistantType: "concierge",
    });
  }
  return items;
}

function mapItem(row) {
  return {
    id: row.id,
    key: row.item_key,
    category: row.category,
    name: row.item_name,
    description: row.description,
    smartTag: row.smart_tag,
    assistantType: row.assistant_type,
    required: Boolean(row.is_required),
    completed: Boolean(row.is_completed),
    completionSource: row.completion_source,
    confirmationReference: row.confirmation_reference,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
  };
}

async function findOwnedTripDatabaseId(connection, userId, publicId) {
  const [rows] = await connection.execute(
    `SELECT id
     FROM trip_sessions
     WHERE public_id = ? AND user_id = ?
     LIMIT 1`,
    [publicId, userId],
  );
  return rows[0]?.id || null;
}

async function updateTripStatus(connection, tripSessionId) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS required_total,
            SUM(CASE WHEN is_completed = TRUE THEN 1 ELSE 0 END) AS prepared,
            SUM(CASE WHEN is_completed = FALSE THEN 1 ELSE 0 END) AS remaining
     FROM trip_readiness_items
     WHERE trip_session_id = ? AND is_required = TRUE`,
    [tripSessionId],
  );
  const total = Number(rows[0]?.required_total || 0);
  const completed = Number(rows[0]?.prepared || 0);
  const remaining = Number(rows[0]?.remaining || 0);
  const ready = total > 0 && completed === total;
  await connection.execute(
    "UPDATE trip_sessions SET status = ? WHERE id = ?",
    [ready ? "ready" : "planned", tripSessionId],
  );
  return {
    total,
    requiredTotal: total,
    completed,
    remaining,
    percentage: total ? Math.round((completed / total) * 100) : 0,
    ready,
    stage: ready ? "ready" : "planned",
  };
}

export async function markTripReady(userId, publicId) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tripSessionId = await findOwnedTripDatabaseId(
      connection,
      userId,
      publicId,
    );
    if (!tripSessionId) {
      await connection.rollback();
      return null;
    }
    const progress = await updateTripStatus(connection, tripSessionId);
    if (!progress.total || progress.remaining > 0) {
      await connection.rollback();
      return progress;
    }
    await connection.execute(
      "UPDATE trip_sessions SET status = 'ready' WHERE id = ?",
      [tripSessionId],
    );
    await connection.commit();
    return progress;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function cancelReadyTrip(userId, publicId) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tripSessionId = await findOwnedTripDatabaseId(
      connection,
      userId,
      publicId,
    );
    if (!tripSessionId) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      `UPDATE trip_readiness_items
       SET is_completed = FALSE,
           completion_source = NULL,
           confirmation_reference = NULL,
           completed_at = NULL
       WHERE trip_session_id = ?`,
      [tripSessionId],
    );
    await connection.execute(
      "UPDATE trip_sessions SET status = 'planned' WHERE id = ?",
      [tripSessionId],
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function ensureReadinessItems(userId, publicId, trip) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tripSessionId = await findOwnedTripDatabaseId(
      connection,
      userId,
      publicId,
    );
    if (!tripSessionId) {
      await connection.rollback();
      return null;
    }
    for (const item of readinessItemsForTrip(trip)) {
      await connection.execute(
        `INSERT INTO trip_readiness_items
          (trip_session_id, item_key, category, item_name, description,
           smart_tag, assistant_type, is_required)
         VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE
           category = VALUES(category),
           item_name = VALUES(item_name),
           description = VALUES(description),
           smart_tag = VALUES(smart_tag),
           assistant_type = VALUES(assistant_type),
           is_required = TRUE`,
        [
          tripSessionId,
          item.key,
          item.category,
          item.name,
          item.description,
          item.smartTag || null,
          item.assistantType,
        ],
      );
    }
    await connection.execute(
      `UPDATE trip_sessions
       SET status = CASE WHEN status = 'draft' THEN 'planned' ELSE status END
       WHERE id = ?`,
      [tripSessionId],
    );
    await connection.commit();
    return tripSessionId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listReadinessItems(userId, publicId) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT readiness.id, readiness.item_key, readiness.category,
            readiness.item_name, readiness.description, readiness.smart_tag,
            readiness.assistant_type, readiness.is_required, readiness.is_completed,
            readiness.completion_source, readiness.confirmation_reference,
            readiness.completed_at, readiness.updated_at
     FROM trip_readiness_items readiness
     JOIN trip_sessions trip ON trip.id = readiness.trip_session_id
     WHERE trip.public_id = ? AND trip.user_id = ?
     ORDER BY readiness.id`,
    [publicId, userId],
  );
  return rows.map(mapItem);
}

export async function updateReadinessItem(
  userId,
  publicId,
  itemId,
  completed,
) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const tripSessionId = await findOwnedTripDatabaseId(
      connection,
      userId,
      publicId,
    );
    if (!tripSessionId) {
      await connection.rollback();
      return null;
    }
    const [result] = await connection.execute(
      `UPDATE trip_readiness_items
       SET is_completed = ?,
           completion_source = ?,
           confirmation_reference = CASE WHEN ? = FALSE THEN NULL ELSE confirmation_reference END,
           completed_at = CASE WHEN ? = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE id = ? AND trip_session_id = ?`,
      [completed, completed ? "manual" : null, completed, completed, itemId, tripSessionId],
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return null;
    }
    const progress = await updateTripStatus(connection, tripSessionId);
    await connection.commit();
    return progress;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
