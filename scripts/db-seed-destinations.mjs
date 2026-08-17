import mysql from "mysql2/promise";
import { localDatabaseSettings } from "./db-settings.mjs";
import { seedDestinations } from "./destination-seed.mjs";

const connection = await mysql.createConnection(localDatabaseSettings());

try {
  const count = await seedDestinations(connection);
  console.log(`${count} PackSwift destinations are ready.`);
} catch (error) {
  console.error(`Destination seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
