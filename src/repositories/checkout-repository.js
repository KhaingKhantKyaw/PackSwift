import { randomBytes } from "node:crypto";
import { getDatabasePool } from "../config/database.js";

const orderConfiguration = {
  FLIGHT: { category: "flight", assistantType: "flight", status: "confirmed" },
  HOTEL: {
    category: "accommodation",
    assistantType: "accommodation",
    status: "confirmed",
  },
  GEAR: { category: "travel_gear", assistantType: "shopping", status: "in_transit" },
  INSURANCE: { category: "insurance", assistantType: "manual", status: "confirmed" },
};

function publicCode(prefix, bytes = 5) {
  return `${prefix}-${new Date().getUTCFullYear()}-${randomBytes(bytes)
    .toString("hex")
    .toUpperCase()}`;
}

function pnrCode() {
  return `PS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function checkoutError(message, status = 422) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requireText(value, label, maxLength) {
  const text = String(value || "").trim();
  if (!text || text.length > maxLength) {
    throw checkoutError(`${label} is required and must be ${maxLength} characters or fewer.`);
  }
  return text;
}

function validDate(value, label) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw checkoutError(`${label} must use YYYY-MM-DD format.`);
  }
  return text;
}

function normalizePassengers(passengers) {
  if (!Array.isArray(passengers) || !passengers.length || passengers.length > 20) {
    throw checkoutError("Provide between 1 and 20 passengers.");
  }
  return passengers.map((passenger) => ({
    givenNames: requireText(passenger?.givenNames, "Passenger given names", 80),
    surname: requireText(passenger?.surname, "Passenger surname", 80),
    passportExpiry: validDate(passenger?.passportExpiry, "Passport expiry"),
  }));
}

function normalizedPurchase(orderType, details) {
  if (orderType === "FLIGHT") {
    const passengers = normalizePassengers(details.passengers);
    const route = requireText(details.route, "Flight route", 180);
    const classType = requireText(details.classType, "Flight class", 50);
    return {
      title: route,
      quantity: passengers.length,
      booking: {
        route,
        classType,
        passengers,
        departureDate: details.departureDate ? validDate(details.departureDate, "Departure date") : null,
        returnDate: details.returnDate ? validDate(details.returnDate, "Return date") : null,
        itinerary: details.itinerary && typeof details.itinerary === "object" ? details.itinerary : {},
      },
    };
  }

  if (orderType === "HOTEL") {
    const hotelName = requireText(details.hotelName, "Hotel name", 255);
    const roomType = requireText(details.roomType, "Room type", 100);
    const checkIn = validDate(details.checkIn, "Check-in date");
    const checkOut = validDate(details.checkOut, "Check-out date");
    if (checkOut <= checkIn) throw checkoutError("Check-out must be after check-in.");
    return {
      title: hotelName,
      quantity: Math.max(1, Math.min(99, Number(details.rooms) || 1)),
      booking: {
        hotelName,
        roomType,
        checkIn,
        checkOut,
        guests: details.guests && typeof details.guests === "object" ? details.guests : {},
      },
    };
  }

  if (orderType === "INSURANCE") {
    const planName = requireText(details.planName, "Insurance plan", 180);
    return {
      title: planName,
      quantity: 1,
      booking: {
        planName,
        tier: requireText(details.tier || planName, "Insurance tier", 80),
        coverage: details.coverage && typeof details.coverage === "object"
          ? details.coverage
          : {},
      },
    };
  }

  const itemName = requireText(details.itemName, "Travel gear item", 255);
  const quantity = Number(details.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    throw checkoutError("Gear quantity must be between 1 and 99.");
  }
  return {
    title: itemName,
    quantity,
    booking: {
      itemName,
      quantity,
      itemDetails: details.itemDetails && typeof details.itemDetails === "object"
        ? details.itemDetails
        : {},
    },
  };
}

async function updateTripReadiness(connection, tripSessionId) {
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
  const [bookingRows] = await connection.execute(
    `SELECT COUNT(*) AS confirmed_bookings
     FROM orders
     WHERE trip_session_id = ?
       AND category IN ('flight', 'accommodation')
       AND status IN ('confirmed', 'completed')
       AND payment_status = 'PAID'`,
    [tripSessionId],
  );
  const confirmedBookings = Number(bookingRows[0]?.confirmed_bookings || 0);
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
    confirmedBookings,
    stage: ready
      ? "ready"
      : confirmedBookings > 0
        ? "booked_confirmed"
        : "planned",
  };
}

export async function processCheckout(userId, input) {
  const configuration = orderConfiguration[input.orderType];
  if (!configuration) throw checkoutError("Choose a supported order type.");
  const purchase = normalizedPurchase(input.orderType, input.details);
  const orderId = publicCode("ORD");
  const generatedPnr = input.orderType === "FLIGHT" ? pnrCode() : null;
  const paymentReference = publicCode("PAY", 6);
  const pool = getDatabasePool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [tripRows] = await connection.execute(
      `SELECT id, public_id, destination_name, start_date, end_date
       FROM trip_sessions
       WHERE public_id = ? AND user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [input.tripId, userId],
    );
    const trip = tripRows[0];
    if (!trip) throw checkoutError("Trip not found.", 404);

    const [checklistRows] = await connection.execute(
      `SELECT id, item_key, item_name, assistant_type
       FROM trip_readiness_items
       WHERE trip_session_id = ? AND item_key = ?
       LIMIT 1
       FOR UPDATE`,
      [trip.id, input.checklistItemKey],
    );
    const checklistItem = checklistRows[0];
    if (!checklistItem) throw checkoutError("Checklist item not found.", 404);
    if (checklistItem.assistant_type !== configuration.assistantType) {
      throw checkoutError("The selected purchase does not match this checklist item.");
    }

    const detailsForOrder = {
      ...input.details,
      checklistItemKey: checklistItem.item_key,
      destination: trip.destination_name,
    };
    await connection.execute(
      `INSERT INTO orders
        (order_number, user_id, trip_session_id, category, order_type, status,
         payment_method, payment_status, card_brand, card_last4, payment_reference,
         title, quantity, total_amount, currency, details_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'PAID', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        userId,
        trip.id,
        configuration.category,
        input.orderType,
        configuration.status,
        input.paymentMethod,
        input.payment.brand,
        input.payment.last4,
        paymentReference,
        purchase.title,
        purchase.quantity,
        input.totalAmount,
        input.currency,
        JSON.stringify(detailsForOrder),
      ],
    );

    if (input.orderType === "FLIGHT") {
      await connection.execute(
        `INSERT INTO flight_bookings
          (order_id, pnr_code, route, departure_date, return_date, class_type,
           passenger_details, itinerary_details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          generatedPnr,
          purchase.booking.route,
          purchase.booking.departureDate,
          purchase.booking.returnDate,
          purchase.booking.classType,
          JSON.stringify(purchase.booking.passengers),
          JSON.stringify(purchase.booking.itinerary),
        ],
      );
    } else if (input.orderType === "HOTEL") {
      await connection.execute(
        `INSERT INTO hotel_bookings
          (order_id, hotel_name, room_type, check_in, check_out, guest_details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          purchase.booking.hotelName,
          purchase.booking.roomType,
          purchase.booking.checkIn,
          purchase.booking.checkOut,
          JSON.stringify(purchase.booking.guests),
        ],
      );
    } else if (input.orderType === "GEAR") {
      await connection.execute(
        `INSERT INTO gear_purchases
          (order_id, item_name, quantity, item_details)
         VALUES (?, ?, ?, ?)`,
        [
          orderId,
          purchase.booking.itemName,
          purchase.booking.quantity,
          JSON.stringify(purchase.booking.itemDetails),
        ],
      );
    }

    await connection.execute(
      `UPDATE trip_readiness_items
       SET is_completed = TRUE,
           completion_source = 'assistant',
           confirmation_reference = ?,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [generatedPnr || orderId, checklistItem.id],
    );
    const progress = await updateTripReadiness(connection, trip.id);
    await connection.commit();

    return {
      brand: "PackSwift",
      orderId,
      pnrCode: generatedPnr,
      transactionStatus: "PAID",
      paymentMethod: input.paymentMethod,
      payment: {
        brand: input.payment.brand,
        last4: input.payment.last4,
        reference: paymentReference,
      },
      orderType: input.orderType,
      tripId: trip.public_id,
      destination: trip.destination_name,
      itinerary: input.orderType === "FLIGHT" ? purchase.booking.itinerary : null,
      passengers: input.orderType === "FLIGHT" ? purchase.booking.passengers : [],
      booking: purchase.booking,
      total: { amount: Number(input.totalAmount), currency: input.currency },
      checklist: {
        itemKey: checklistItem.item_key,
        prepared: true,
        progress,
      },
      confirmedAt: new Date().toISOString(),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
