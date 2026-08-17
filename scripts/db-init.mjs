import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";
import { localDatabaseSettings } from "./db-settings.mjs";
import { seedDestinations } from "./destination-seed.mjs";
import { seedPlannerActivities } from "./planner-activity-seed.mjs";

const schema = await readFile(
  new URL("../database/schema.sql", import.meta.url),
  "utf8",
);
const databaseName = process.env.DB_NAME || "packswift";
if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error("DB_NAME may contain only letters, numbers, and underscores.");
}
const portableSchema = schema
  .replace(
    /CREATE DATABASE IF NOT EXISTS packswift[\s\S]*?COLLATE utf8mb4_unicode_ci;/,
    `CREATE DATABASE IF NOT EXISTS \`${databaseName}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;`,
  )
  .replace(/USE packswift;/, `USE \`${databaseName}\`;`);
const connection = await mysql.createConnection({
  ...localDatabaseSettings({ includeDatabase: false }),
  multipleStatements: true,
});

try {
  await connection.query(portableSchema);
  const [orderColumns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'orders'`,
    [databaseName],
  );
  const existingOrderColumns = new Set(orderColumns.map((column) => column.COLUMN_NAME));
  if (!existingOrderColumns.has("order_type")) {
    await connection.query(
      "ALTER TABLE orders ADD COLUMN order_type ENUM('FLIGHT', 'HOTEL', 'GEAR') NULL AFTER category",
    );
    await connection.query(
      `UPDATE orders SET order_type = CASE category
         WHEN 'flight' THEN 'FLIGHT'
         WHEN 'accommodation' THEN 'HOTEL'
         ELSE 'GEAR'
       END`,
    );
    await connection.query(
      "ALTER TABLE orders MODIFY order_type ENUM('FLIGHT', 'HOTEL', 'GEAR') NOT NULL",
    );
  }
  if (!existingOrderColumns.has("payment_method")) {
    await connection.query(
      "ALTER TABLE orders ADD COLUMN payment_method ENUM('VISA', 'MASTERCARD', 'CREDIT_CARD') NOT NULL DEFAULT 'CREDIT_CARD' AFTER status",
    );
  }
  if (!existingOrderColumns.has("payment_status")) {
    await connection.query(
      "ALTER TABLE orders ADD COLUMN payment_status ENUM('PAID', 'FAILED') NOT NULL DEFAULT 'PAID' AFTER payment_method",
    );
  }
  if (!existingOrderColumns.has("card_brand")) {
    await connection.query(
      "ALTER TABLE orders ADD COLUMN card_brand ENUM('VISA', 'MASTERCARD') NULL AFTER payment_status",
    );
  }
  if (!existingOrderColumns.has("card_last4")) {
    await connection.query(
      "ALTER TABLE orders ADD COLUMN card_last4 CHAR(4) NULL AFTER card_brand",
    );
  }
  if (!existingOrderColumns.has("payment_reference")) {
    await connection.query(
      "ALTER TABLE orders ADD COLUMN payment_reference VARCHAR(60) NULL AFTER card_last4",
    );
    await connection.query(
      "UPDATE orders SET payment_reference = CONCAT('PAY-LEGACY-', id) WHERE payment_reference IS NULL",
    );
    await connection.query(
      "ALTER TABLE orders MODIFY payment_reference VARCHAR(60) NOT NULL, ADD UNIQUE KEY uq_orders_payment_reference (payment_reference)",
    );
  }
  await connection.query(
    "ALTER TABLE orders MODIFY category ENUM('flight', 'accommodation', 'travel_gear', 'insurance') NOT NULL",
  );
  await connection.query(
    "ALTER TABLE orders MODIFY order_type ENUM('FLIGHT', 'HOTEL', 'GEAR', 'INSURANCE') NOT NULL",
  );
  const [readinessColumns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'trip_readiness_items'`,
    [databaseName],
  );
  const existingReadinessColumns = new Set(
    readinessColumns.map((column) => column.COLUMN_NAME),
  );
  if (!existingReadinessColumns.has("smart_tag")) {
    await connection.query(
      "ALTER TABLE trip_readiness_items ADD COLUMN smart_tag VARCHAR(160) NULL AFTER description",
    );
  }
  if (!existingReadinessColumns.has("is_required")) {
    await connection.query(
      "ALTER TABLE trip_readiness_items ADD COLUMN is_required BOOLEAN NOT NULL DEFAULT TRUE AFTER assistant_type",
    );
  }
  const [tripColumns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'trip_sessions'`,
    [databaseName],
  );
  const existingTripColumns = new Set(tripColumns.map((column) => column.COLUMN_NAME));
  const tripColumnUpdates = [
    ["trip_scope", "ALTER TABLE trip_sessions ADD COLUMN trip_scope ENUM('domestic', 'international') NOT NULL DEFAULT 'international' AFTER destination_name"],
    ["origin_name", "ALTER TABLE trip_sessions ADD COLUMN origin_name VARCHAR(160) NULL AFTER trip_scope"],
    ["origin_country", "ALTER TABLE trip_sessions ADD COLUMN origin_country VARCHAR(120) NULL AFTER origin_name"],
    ["origin_airport_code", "ALTER TABLE trip_sessions ADD COLUMN origin_airport_code VARCHAR(10) NULL AFTER origin_country"],
    ["adult_count", "ALTER TABLE trip_sessions ADD COLUMN adult_count SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER travelers"],
    ["child_count", "ALTER TABLE trip_sessions ADD COLUMN child_count SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER adult_count"],
  ];
  for (const [column, statement] of tripColumnUpdates) {
    if (!existingTripColumns.has(column)) await connection.query(statement);
  }
  if (!existingTripColumns.has("adult_count")) {
    await connection.query(
      "UPDATE trip_sessions SET adult_count = GREATEST(travelers, 1), child_count = 0",
    );
  }
  const [savedTripColumns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'saved_trips'`,
    [databaseName],
  );
  if (!new Set(savedTripColumns.map((column) => column.COLUMN_NAME)).has("updated_at")) {
    await connection.query(
      "ALTER TABLE saved_trips ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at, ADD INDEX idx_saved_trips_user_updated (user_id, updated_at)",
    );
  }
  const [placeCacheColumns] = await connection.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'destination_places_cache'`,
    [databaseName],
  );
  const existingPlaceCacheColumns = new Set(
    placeCacheColumns.map((column) => column.COLUMN_NAME),
  );
  const placeCacheUpdates = [
    ["destination_name", "ALTER TABLE destination_places_cache ADD COLUMN destination_name VARCHAR(160) NOT NULL DEFAULT '' AFTER destination_key"],
    ["destination_scope", "ALTER TABLE destination_places_cache ADD COLUMN destination_scope ENUM('country', 'city') NOT NULL DEFAULT 'city' AFTER destination_name"],
    ["country_name", "ALTER TABLE destination_places_cache ADD COLUMN country_name VARCHAR(160) NULL AFTER destination_scope"],
    ["search_query", "ALTER TABLE destination_places_cache ADD COLUMN search_query VARCHAR(500) NOT NULL DEFAULT '' AFTER request_category"],
    ["category_tags", "ALTER TABLE destination_places_cache ADD COLUMN category_tags JSON NULL AFTER search_query"],
  ];
  for (const [column, statement] of placeCacheUpdates) {
    if (!existingPlaceCacheColumns.has(column)) await connection.query(statement);
  }
  await connection.query(
    "ALTER TABLE destination_places_cache MODIFY request_category VARCHAR(80) NOT NULL",
  );
  await connection.query(
    `UPDATE destination_places_cache
     SET destination_name = CASE WHEN destination_name = '' THEN destination_key ELSE destination_name END,
         category_tags = COALESCE(category_tags, JSON_ARRAY(request_category))`,
  );
  await connection.query(
    "ALTER TABLE destination_places_cache MODIFY category_tags JSON NOT NULL",
  );
  const destinationCount = await seedDestinations(connection);
  const plannerActivityCount = await seedPlannerActivities(connection);
  console.log("PackSwift database and tables are ready.");
  console.log(`${destinationCount} canonical destinations are ready.`);
  console.log(`${plannerActivityCount} live planner activities are ready.`);
  console.log("Optional sample data: npm run db:seed");
} catch (error) {
  console.error(`Database initialization failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
