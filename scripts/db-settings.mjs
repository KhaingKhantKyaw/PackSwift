import "dotenv/config";

export function localDatabaseSettings({ includeDatabase = true } = {}) {
  const settings = {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD === "YOUR_PASSWORD"
      ? ""
      : process.env.DB_PASSWORD || "",
  };

  if (includeDatabase) settings.database = process.env.DB_NAME || "packswift";
  return settings;
}
