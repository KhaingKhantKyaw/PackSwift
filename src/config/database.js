import mysql from "mysql2/promise";

const isProduction = process.env.NODE_ENV === "production";

const databaseSettings = {
  host:
    process.env.DB_HOST ||
    process.env.MYSQL_HOST ||
    (isProduction ? undefined : "127.0.0.1"),
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT) || 3306,
  user:
    process.env.DB_USER ||
    process.env.MYSQL_USER ||
    (isProduction ? undefined : "root"),
  password:
    process.env.DB_PASSWORD ??
    process.env.MYSQL_PASSWORD ??
    (isProduction ? undefined : ""),
  database:
    process.env.DB_NAME ||
    process.env.MYSQL_DATABASE ||
    (isProduction ? undefined : "packswift"),
  connectionLimit:
    Number(process.env.DB_CONNECTION_LIMIT || process.env.MYSQL_CONNECTION_LIMIT) ||
    10,
};

const databaseConfigured = Boolean(
  databaseSettings.host &&
    databaseSettings.user &&
    databaseSettings.database,
);

let pool;

export function isDatabaseConfigured() {
  return databaseConfigured;
}

export function getDatabaseSettings() {
  return { ...databaseSettings, password: databaseSettings.password ? "configured" : "" };
}

export function getDatabasePool() {
  if (!databaseConfigured) return null;

  pool ??= mysql.createPool({
    ...databaseSettings,
    waitForConnections: true,
    enableKeepAlive: true,
    timezone: "Z",
    dateStrings: true,
    decimalNumbers: true,
  });

  return pool;
}

export async function verifyDatabaseConnection() {
  const databasePool = getDatabasePool();
  if (!databasePool) return false;
  await databasePool.query("SELECT 1");
  return true;
}
