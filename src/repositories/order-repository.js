import { getDatabasePool } from "../config/database.js";

function mapOrder(row) {
  let details = row.details_json || {};
  if (typeof details === "string") {
    try {
      details = JSON.parse(details);
    } catch {
      details = {};
    }
  }
  return {
    id: row.id,
    orderNumber: row.order_number,
    tripId: row.trip_id,
    category: row.category,
    orderType: row.order_type,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    payment: {
      method: row.payment_method,
      brand: row.card_brand || null,
      last4: row.card_last4 || null,
      reference: row.payment_reference || null,
    },
    title: row.title,
    quantity: Number(row.quantity),
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    details,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listOrders(userId, category = null) {
  const pool = getDatabasePool();
  const values = [userId];
  let categoryFilter = "";
  if (category) {
    categoryFilter = " AND orders.category = ?";
    values.push(category);
  }
  const [rows] = await pool.execute(
    `SELECT orders.id, orders.order_number, trip.public_id AS trip_id,
            orders.category, orders.order_type, orders.status,
            orders.payment_method, orders.payment_status, orders.card_brand,
            orders.card_last4, orders.payment_reference,
            orders.title, orders.quantity,
            orders.total_amount, orders.currency, orders.details_json,
            orders.created_at, orders.updated_at
     FROM orders
     JOIN trip_sessions trip ON trip.id = orders.trip_session_id
     WHERE orders.user_id = ?${categoryFilter}
     ORDER BY orders.created_at DESC
     LIMIT 100`,
    values,
  );
  return rows.map(mapOrder);
}

export async function findOrder(userId, orderNumber) {
  const pool = getDatabasePool();
  const [rows] = await pool.execute(
    `SELECT orders.id, orders.order_number, trip.public_id AS trip_id,
            orders.category, orders.order_type, orders.status,
            orders.payment_method, orders.payment_status, orders.card_brand,
            orders.card_last4, orders.payment_reference,
            orders.title, orders.quantity,
            orders.total_amount, orders.currency, orders.details_json,
            orders.created_at, orders.updated_at
     FROM orders
     JOIN trip_sessions trip ON trip.id = orders.trip_session_id
     WHERE orders.user_id = ? AND orders.order_number = ?
     LIMIT 1`,
    [userId, orderNumber],
  );
  return rows[0] ? mapOrder(rows[0]) : null;
}
