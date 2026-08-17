import { isDatabaseConfigured } from "../config/database.js";

export function requireDatabase(request, response, next) {
  if (!isDatabaseConfigured()) {
    response.status(503).json({
      error: "The database connection is not configured on this environment.",
    });
    return;
  }
  next();
}
