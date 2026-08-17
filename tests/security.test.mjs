import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import bcrypt from "bcrypt";
import { cleanMultilineText, cleanText } from "../src/utils/sanitize.js";

test("bcrypt creates a one-way password hash", async () => {
  const password = "PackSwiftSecure123";
  const hash = await bcrypt.hash(password, 4);
  assert.notEqual(hash, password);
  assert.match(hash, /^\$2[aby]\$/);
  assert.equal(await bcrypt.compare(password, hash), true);
});

test("text sanitization removes executable markup", () => {
  assert.equal(cleanText('Hello <script>alert("x")</script> traveller', 100), "Hello traveller");
  assert.equal(cleanMultilineText("First\n\n\n\nSecond", 100), "First\n\nSecond");
});

test("JWT authentication round-trips an account identity", async () => {
  process.env.JWT_SECRET = "test-secret-with-more-than-enough-entropy-for-packswift";
  const { issueAuthToken, verifyAuthToken } = await import("../src/config/auth.js");
  const token = issueAuthToken({ id: 42, username: "traveller", email: "traveller@example.com" });
  const payload = verifyAuthToken(token);
  assert.equal(payload.sub, "42");
  assert.equal(payload.username, "traveller");
});

test("schema contains the complete account and community model", async () => {
  const schema = await readFile(new URL("../database/schema.sql", import.meta.url), "utf8");
  for (const table of [
    "users",
    "contact_messages",
    "community_posts",
    "community_comments",
    "community_likes",
    "saved_trips",
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(schema, /password_hash VARCHAR\(255\) NOT NULL/);
  assert.doesNotMatch(schema, /\bpassword\s+VARCHAR/i);
});

test("schema and migration contain the Part 1 trip-planning model", async () => {
  const [schema, migration] = await Promise.all([
    readFile(new URL("../database/schema.sql", import.meta.url), "utf8"),
    readFile(
      new URL(
        "../database/migrations/004_trip_planning_upgrade.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const table of [
    "destinations",
    "place_review_details",
    "destination_insight_snapshots",
    "itinerary_timeline_items",
  ]) {
    assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
    assert.match(migration, new RegExp(`CREATE TABLE ${table}`));
  }

  assert.match(schema, /post_type ENUM\('community', 'travel_report', 'place_review'\)/);
  assert.match(schema, /primary_airport_code VARCHAR\(10\)/);
  assert.match(schema, /arrival_airport_code VARCHAR\(10\)/);
  assert.match(schema, /'airport-transfer'/);
  assert.match(schema, /FOREIGN KEY \(trip_session_id\) REFERENCES trip_sessions\(id\)/);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|DATABASE)\b/i);
});
