import bcrypt from "bcrypt";
import mysql from "mysql2/promise";
import { localDatabaseSettings } from "./db-settings.mjs";

const connection = await mysql.createConnection(localDatabaseSettings());

async function upsertSampleUser({ fullName, username, email, password }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const [result] = await connection.execute(
    `INSERT INTO users (full_name, username, email, password_hash)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       id = LAST_INSERT_ID(id),
       full_name = VALUES(full_name),
       password_hash = VALUES(password_hash)`,
    [fullName, username, email, passwordHash],
  );
  return result.insertId;
}

try {
  const demoUserId = await upsertSampleUser({
    fullName: "Demo Traveller",
    username: "demo_traveller",
    email: "demo@packswift.local",
    password: "DemoTravel123!",
  });
  const friendUserId = await upsertSampleUser({
    fullName: "Sample Travel Friend",
    username: "travel_friend",
    email: "friend@packswift.local",
    password: "FriendTravel123!",
  });

  await connection.execute(
    `INSERT INTO saved_trips
      (user_id, destination, travel_month, budget, trip_data)
     SELECT ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM saved_trips WHERE user_id = ? AND destination = ?
     )`,
    [
      demoUserId,
      "Tokyo",
      "April",
      2500,
      JSON.stringify({ sample: true, currency: "USD", purpose: "leisure" }),
      demoUserId,
      "Tokyo",
    ],
  );
  await connection.execute(
    `INSERT INTO saved_trips
      (user_id, destination, travel_month, budget, trip_data)
     SELECT ?, ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM saved_trips WHERE user_id = ? AND destination = ?
     )`,
    [
      friendUserId,
      "Tokyo",
      "April",
      2300,
      JSON.stringify({ sample: true, currency: "USD", purpose: "leisure" }),
      friendUserId,
      "Tokyo",
    ],
  );
  await connection.execute(
    `INSERT INTO community_posts
      (user_id, title, content, category, destination, trip_date)
     SELECT ?, ?, ?, 'travel-buddy', ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM community_posts
       WHERE user_id = ? AND category = 'travel-buddy' AND destination = ?
     )`,
    [
      friendUserId,
      "Tokyo in spring",
      "Planning a relaxed week focused on food, neighbourhood walks, and museums.",
      "Tokyo",
      "2027-04-12",
      friendUserId,
      "Tokyo",
    ],
  );

  console.log("Sample seed data created.");
  console.log("Demo login: demo@packswift.local / DemoTravel123!");
  console.log("Friend login: friend@packswift.local / FriendTravel123!");
} catch (error) {
  console.error(`Sample seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
