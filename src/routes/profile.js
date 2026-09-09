import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/database.js";
import { getProfile } from "../repositories/profile-repository.js";

export const profileRouter = Router();

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
      },
    });
  } catch (error) {
    next(error);
  }
});
