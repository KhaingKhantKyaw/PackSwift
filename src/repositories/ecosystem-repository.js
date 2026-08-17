import { getDatabasePool } from "../config/database.js";

const imageByCategory = {
  arrival: "/images/packswift2.jpg",
  culture: "/images/activities/bangkok-temples.jpg",
  food: "/images/activities/bangkok-street-food.jpg",
  shopping: "/images/activities/bangkok-shopping.jpg",
  outdoor: "/images/packswift3.jpg",
  default: "/images/packswift1.jpg",
};

async function ownedTripRow(connection, userId, publicId, lock = false) {
  const [rows] = await connection.execute(
    `SELECT trip.*, destination.country_code, destination.country_name
     FROM trip_sessions trip
     LEFT JOIN destinations destination ON destination.id = trip.destination_id
     WHERE trip.public_id = ? AND trip.user_id = ?
     LIMIT 1${lock ? " FOR UPDATE" : ""}`,
    [publicId, userId],
  );
  return rows[0] || null;
}

function timePeriod(startTime, type) {
  const hour = Number(String(startTime || "09:00").slice(0, 2));
  if (hour >= 21 || type === "nightlife") return "nightlife";
  if (hour >= 17) return "evening";
  if (hour >= 12) return "afternoon";
  return "morning";
}

function imageFor(item) {
  const text = `${item.type || ""} ${item.title || ""}`.toLowerCase();
  if (/airport|arrival|transfer|hotel/.test(text)) return imageByCategory.arrival;
  if (/temple|museum|palace|culture|heritage/.test(text)) return imageByCategory.culture;
  if (/food|meal|market|restaurant/.test(text)) return imageByCategory.food;
  if (/shop|mall/.test(text)) return imageByCategory.shopping;
  if (/park|beach|outdoor|island/.test(text)) return imageByCategory.outdoor;
  return imageByCategory.default;
}

export async function replaceInteractiveItinerary(userId, publicId, timeline) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const trip = await ownedTripRow(connection, userId, publicId, true);
    if (!trip) {
      await connection.rollback();
      return null;
    }
    await connection.execute("DELETE FROM itineraries WHERE trip_session_id = ?", [trip.id]);
    const grouped = new Map();
    for (const item of timeline) {
      if (!grouped.has(item.day)) grouped.set(item.day, []);
      grouped.get(item.day).push(item);
    }
    for (const [day, items] of grouped) {
      const summary = (period) => items.find((item) => timePeriod(item.startTime, item.type) === period)?.title || "Flexible exploration";
      const [result] = await connection.execute(
        `INSERT INTO itineraries
          (trip_session_id, day_number, title, morning_activity, afternoon_activity, evening_activity)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [trip.id, day, `Day ${day} in ${trip.destination_name}`, summary("morning"), summary("afternoon"), summary("evening")],
      );
      let sequence = 1;
      for (const item of items) {
        await connection.execute(
          `INSERT INTO itinerary_activities
            (itinerary_id, sequence_number, time_period, start_time, end_time,
             place_name, category, description, thumbnail_url, duration_minutes,
             estimated_cost, cost_currency, transit_mode, transit_minutes, transit_distance_km)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            result.insertId,
            sequence++,
            timePeriod(item.startTime, item.type),
            item.startTime || null,
            item.endTime || null,
            item.locationName || item.title,
            item.type || "activity",
            item.description || "",
            imageFor(item),
            Number(item.estimatedDurationMinutes) || 60,
            Number(item.estimatedCost) || 0,
            item.costCurrency || trip.budget_currency || "USD",
            item.transitMode || (sequence > 2 ? "Car" : null),
            item.transitMode ? Math.max(5, Math.min(90, Math.round((Number(item.estimatedDurationMinutes) || 30) * 0.3))) : null,
            item.transitMode ? Number((Math.max(1, (Number(item.estimatedDurationMinutes) || 30) * 0.12)).toFixed(1)) : null,
          ],
        );
      }
    }
    await connection.commit();
    return listInteractiveItinerary(userId, publicId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listInteractiveItinerary(userId, publicId) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT itinerary.day_number, itinerary.title AS day_title,
            activity.id, activity.sequence_number, activity.time_period,
            activity.start_time, activity.end_time, activity.place_name,
            activity.category, activity.description, activity.thumbnail_url,
            activity.duration_minutes, activity.estimated_cost, activity.cost_currency,
            activity.transit_mode, activity.transit_minutes, activity.transit_distance_km
     FROM itineraries itinerary
     JOIN trip_sessions trip ON trip.id = itinerary.trip_session_id
     LEFT JOIN itinerary_activities activity ON activity.itinerary_id = itinerary.id
     WHERE trip.public_id = ? AND trip.user_id = ?
     ORDER BY itinerary.day_number, activity.sequence_number`,
    [publicId, userId],
  );
  if (!rows.length) return [];
  const days = new Map();
  for (const row of rows) {
    if (!days.has(row.day_number)) {
      days.set(row.day_number, { day: row.day_number, title: row.day_title, activities: [] });
    }
    if (row.id) {
      days.get(row.day_number).activities.push({
        id: row.id,
        sequence: row.sequence_number,
        period: row.time_period,
        startTime: String(row.start_time || "").slice(0, 5),
        endTime: String(row.end_time || "").slice(0, 5),
        placeName: row.place_name,
        category: row.category,
        description: row.description,
        thumbnailUrl: row.thumbnail_url,
        durationMinutes: Number(row.duration_minutes),
        estimatedCost: Number(row.estimated_cost),
        currency: row.cost_currency,
        transit: row.transit_mode ? {
          mode: row.transit_mode,
          minutes: Number(row.transit_minutes || 0),
          distanceKm: Number(row.transit_distance_km || 0),
        } : null,
      });
    }
  }
  return [...days.values()];
}

export async function addItineraryActivity(userId, publicId, input) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const trip = await ownedTripRow(connection, userId, publicId, true);
    if (!trip) {
      await connection.rollback();
      return null;
    }
    let [days] = await connection.execute(
      "SELECT id FROM itineraries WHERE trip_session_id = ? AND day_number = ? LIMIT 1",
      [trip.id, input.day],
    );
    if (!days[0]) {
      const [created] = await connection.execute(
        `INSERT INTO itineraries (trip_session_id, day_number, title, morning_activity, afternoon_activity, evening_activity)
         VALUES (?, ?, ?, 'Flexible morning', 'Flexible afternoon', 'Flexible evening')`,
        [trip.id, input.day, `Day ${input.day} in ${trip.destination_name}`],
      );
      days = [{ id: created.insertId }];
    }
    const [sequenceRows] = await connection.execute(
      "SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next_sequence FROM itinerary_activities WHERE itinerary_id = ?",
      [days[0].id],
    );
    await connection.execute(
      `INSERT INTO itinerary_activities
        (itinerary_id, sequence_number, time_period, start_time, place_name, category,
         description, thumbnail_url, duration_minutes, estimated_cost, cost_currency,
         transit_mode, transit_minutes, transit_distance_km)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [days[0].id, sequenceRows[0].next_sequence, input.period, input.startTime, input.placeName,
        input.category, input.description || "", input.thumbnailUrl || imageByCategory.default,
        input.durationMinutes, input.estimatedCost, input.currency,
        input.transitMode || null, input.transitMinutes || null, input.transitDistanceKm || null],
    );
    await connection.commit();
    return listInteractiveItinerary(userId, publicId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function countryCode(value) {
  const aliases = { myanmar: "MM", thailand: "TH", japan: "JP", singapore: "SG", china: "CN", france: "FR", indonesia: "ID" };
  const text = String(value || "").trim();
  return text.length === 2 ? text.toUpperCase() : aliases[text.toLowerCase()] || null;
}

export async function getVisaStatus(userId, publicId) {
  const pool = getDatabasePool();
  const trip = await ownedTripRow(pool, userId, publicId);
  if (!trip) return null;
  const originCode = countryCode(trip.origin_country);
  const destinationCode = countryCode(trip.country_code || trip.country_name);
  let rule = null;
  if (originCode && destinationCode) {
    const [rules] = await pool.execute(
      "SELECT * FROM visa_rules WHERE origin_country_code = ? AND destination_country_code = ? LIMIT 1",
      [originCode, destinationCode],
    );
    rule = rules[0] || null;
  }
  if (!rule && originCode && destinationCode && originCode === destinationCode) {
    rule = { status: "visa_free", allowed_days: null, summary: "This is a domestic journey; an international visa is not required.", official_portal_url: null, source_note: "Carry valid local identification." };
  }
  rule ||= { status: "consular_required", allowed_days: null, summary: "PackSwift could not confirm an exemption. Verify requirements with the destination embassy before booking.", official_portal_url: null, source_note: "Travel rules change frequently; official confirmation is required." };
  return {
    tripId: publicId,
    origin: { name: trip.origin_country || trip.origin_name || "Origin", code: originCode },
    destination: { name: trip.country_name || trip.destination_name, code: destinationCode },
    status: rule.status,
    allowedDays: rule.allowed_days,
    summary: rule.summary,
    officialPortalUrl: rule.official_portal_url,
    sourceNote: rule.source_note,
    checkedAt: rule.checked_at || null,
    tripCurrency: trip.budget_currency || "USD",
  };
}

export async function ensureWeatherReadinessItem(userId, publicId, alert) {
  if (!alert) return;
  const pool = getDatabasePool();
  const trip = await ownedTripRow(pool, userId, publicId);
  if (!trip) return;
  const item = alert.type === "rain"
    ? ["rain-protection", "Clothing & Gear", "Raincoat or compact umbrella", "Rain is predicted during this trip.", "Essential for Rainy Weather", "shopping"]
    : ["sun-protection", "Health & Medication", "Hydration and sun protection", "High temperatures are predicted during this trip.", "Essential for Extreme Heat", "shopping"];
  await pool.execute(
    `INSERT INTO trip_readiness_items
      (trip_session_id, item_key, category, item_name, description, smart_tag, assistant_type)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE smart_tag = VALUES(smart_tag), description = VALUES(description)`,
    [trip.id, ...item],
  );
}

function expensePayload(rows, trip) {
  const expenses = [];
  const expenseMap = new Map();
  for (const row of rows) {
    if (!expenseMap.has(row.id)) {
      const expense = {
        id: row.id,
        title: row.title,
        paidBy: row.paid_by,
        category: row.category,
        amount: Number(row.amount),
        currency: row.currency,
        date: row.expense_date,
        notes: row.notes,
        splits: [],
      };
      expenseMap.set(row.id, expense);
      expenses.push(expense);
    }
    if (row.split_id) expenseMap.get(row.id).splits.push({
      id: row.split_id,
      participant: row.participant_name,
      amount: Number(row.share_amount),
      settled: Boolean(row.is_settled),
    });
  }
  const balances = new Map();
  for (const expense of expenses) {
    balances.set(expense.paidBy, (balances.get(expense.paidBy) || 0) + expense.amount);
    for (const split of expense.splits) {
      balances.set(split.participant, (balances.get(split.participant) || 0) - split.amount);
    }
  }
  const debtors = [...balances].filter(([, amount]) => amount < -0.005).map(([name, amount]) => ({ name, amount: -amount }));
  const creditors = [...balances].filter(([, amount]) => amount > 0.005).map(([name, amount]) => ({ name, amount }));
  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;
  while (debtors[debtorIndex] && creditors[creditorIndex]) {
    const amount = Math.min(debtors[debtorIndex].amount, creditors[creditorIndex].amount);
    settlements.push({ from: debtors[debtorIndex].name, to: creditors[creditorIndex].name, amount: Number(amount.toFixed(2)), currency: trip.budget_currency });
    debtors[debtorIndex].amount -= amount;
    creditors[creditorIndex].amount -= amount;
    if (debtors[debtorIndex].amount < 0.005) debtorIndex++;
    if (creditors[creditorIndex].amount < 0.005) creditorIndex++;
  }
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return {
    trip: { id: trip.public_id, destination: trip.destination_name, budget: Number(trip.budget_amount), currency: trip.budget_currency, travelers: Number(trip.travelers) || 1 },
    expenses,
    summary: { total, variance: Number(trip.budget_amount) - total, perPerson: total / (Number(trip.travelers) || 1), settlements },
  };
}

export async function listTripExpenses(userId, publicId) {
  const pool = getDatabasePool();
  const trip = await ownedTripRow(pool, userId, publicId);
  if (!trip) return null;
  const [rows] = await pool.execute(
    `SELECT expense.*, split.id AS split_id, split.participant_name, split.share_amount, split.is_settled
     FROM trip_expenses expense
     LEFT JOIN expense_splits split ON split.expense_id = expense.id
     WHERE expense.trip_session_id = ?
     ORDER BY expense.expense_date DESC, expense.created_at DESC, split.id`,
    [trip.id],
  );
  return expensePayload(rows, trip);
}

export async function logTripExpense(userId, publicId, input) {
  const pool = getDatabasePool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const trip = await ownedTripRow(connection, userId, publicId, true);
    if (!trip) {
      await connection.rollback();
      return null;
    }
    const [result] = await connection.execute(
      `INSERT INTO trip_expenses
        (trip_session_id, paid_by, title, category, amount, currency, expense_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [trip.id, input.paidBy, input.title, input.category, input.amount, input.currency, input.date, input.notes || null],
    );
    const share = Number((input.amount / input.participants.length).toFixed(2));
    let assigned = 0;
    for (const [index, participant] of input.participants.entries()) {
      const participantShare = index === input.participants.length - 1 ? Number((input.amount - assigned).toFixed(2)) : share;
      assigned += participantShare;
      await connection.execute(
        "INSERT INTO expense_splits (expense_id, participant_name, share_amount) VALUES (?, ?, ?)",
        [result.insertId, participant, participantShare],
      );
    }
    await connection.commit();
    return listTripExpenses(userId, publicId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
