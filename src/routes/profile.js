import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/database.js";
import { getProfile } from "../repositories/profile-repository.js";
import { getDatabasePool } from "../config/database.js";

export const profileRouter = Router();

profileRouter.get("/preferences", requireAuth, requireDatabase, async (request, response, next) => {
  try {
    const [rows] = await getDatabasePool().execute("SELECT preferences FROM user_profile_preferences WHERE user_id = ?", [request.auth.userId]);
    const value = rows[0]?.preferences;
    response.set("Cache-Control", "no-store").json({preferences: typeof value === "string" ? JSON.parse(value) : value || {}});
  } catch (error) { next(error); }
});

profileRouter.put("/preferences", requireAuth, requireDatabase, async (request, response, next) => {
  try {
    const data = request.body;
    if (!data || typeof data !== "object" || Array.isArray(data)) return response.status(400).json({error:"Invalid preferences."});
    const preferences = {};
    for (const key of ["homeCity","currency","language","travelStyle","transportation","luggage","laundry","packingExclusions","nationality","companions","accessibility","pets","dailyPace","dayStart","dayEnd","walking","crowds","spendingPriority","stayPreference","diet","avoid","travelMinutes","restBreaks","weatherFlexibility","guidance"]) {
      if (data[key] === undefined) continue;
      if (data[key] !== undefined && (typeof data[key] !== "string" || data[key].length > 500)) return response.status(400).json({error:"Invalid " + key});
      preferences[key] = (data[key] || "").trim();
    }
    for (const key of ["interests","packingItems"]) {
      if (data[key] === undefined) continue;
      const values = data[key] || [];
      if (!Array.isArray(values) || values.length > 50 || values.some(v=>typeof v !== "string" || v.length > 100)) return response.status(400).json({error:"Invalid " + key});
      preferences[key] = [...new Set(values.map(v=>v.trim()).filter(Boolean))];
    }
    for (const key of ["wishlist","packingPresets"]) {
      if(data[key] === undefined) continue;
      const values=data[key];
      if(!Array.isArray(values)||values.length>50||values.some(v=>!v||typeof v!=="object"||typeof v.name!=="string"||v.name.length>120||typeof v.detail!=="string"||v.detail.length>1000)) return response.status(400).json({error:"Invalid "+key});
      preferences[key]=values.map(v=>({name:v.name.trim(),detail:v.detail.trim()})).filter(v=>v.name);
    }
    await getDatabasePool().execute("INSERT INTO user_profile_preferences (user_id, preferences) VALUES (?, ?) ON DUPLICATE KEY UPDATE preferences = JSON_MERGE_PATCH(preferences, VALUES(preferences))", [request.auth.userId, JSON.stringify(preferences)]);
    response.json({preferences});
  } catch (error) { next(error); }
});

profileRouter.put("/picture", requireAuth, requireDatabase, async (request, response, next) => {
  try {
    const picture = request.body?.picture;
    if (picture !== null) {
      if (typeof picture !== "string" || picture.length > 100000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(picture)) return response.status(422).json({error:"Choose a JPG, PNG or WebP photo under 5 MB."});
      const bytes = Buffer.from(picture.split(",")[1], "base64");
      if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216 || bytes.at(-2) !== 255 || bytes.at(-1) !== 217) return response.status(422).json({error:"Invalid profile photo."});
    }
    await getDatabasePool().execute("INSERT INTO user_profile_preferences (user_id, preferences) VALUES (?, ?) ON DUPLICATE KEY UPDATE preferences = JSON_SET(preferences, '$.picture', ?)", [request.auth.userId, JSON.stringify({picture}), picture]);
    response.json({picture});
  } catch (error) { next(error); }
});

profileRouter.get("/", requireAuth, requireDatabase, async (request, response, next) => {
  try {
    response.set("Cache-Control", "no-store, max-age=0");
    const profile = await getProfile(request.auth.userId);
    if (!profile.user) {
      response.status(404).json({ error: "Profile not found." });
      return;
    }
    response.json({
      profile: {
        user: {
          id: profile.user.id,
          fullName: profile.user.full_name,
          username: profile.user.username,
          email: profile.user.email,
          createdAt: profile.user.created_at,
        },
        savedTrips: profile.savedTrips,
        inProgressTrips: profile.inProgressTrips,
        readyTrips: profile.readyTrips,
        travelPreferences: profile.travelPreferences,
      },
    });
  } catch (error) {
    next(error);
  }
});
