import bcrypt from "bcrypt";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { body } from "express-validator";
import { authCookieName, authCookieOptions, issueAuthToken } from "../config/auth.js";
import { isDatabaseConfigured } from "../config/database.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/database.js";
import { validateRequest } from "../middleware/validate.js";
import {
  createUser,
  findUserById,
  findUserForLogin,
  updatePassword,
  updateUser,
} from "../repositories/user-repository.js";
import { cleanText } from "../utils/sanitize.js";

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many sign-in attempts. Please wait and try again." },
});

const accountValidators = [
  body("fullName").trim().isLength({ min: 2, max: 100 }).withMessage("Use 2–100 characters."),
  body("username")
    .trim()
    .isLength({ min: 3, max: 50 })
    .matches(/^[a-zA-Z0-9._-]+$/)
    .withMessage("Use 3–50 letters, numbers, dots, underscores, or hyphens."),
  body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
];

const passwordValidator = body("password")
  .isLength({ min: 10, max: 128 })
  .matches(/[a-z]/)
  .matches(/[A-Z]/)
  .matches(/[0-9]/)
  .matches(/[^A-Za-z0-9]/)
  .withMessage(
    "Use 10+ characters with uppercase, lowercase, a number, and a special character.",
  );

const databaseUnavailableCodes = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "PROTOCOL_CONNECTION_LOST",
  "ER_ACCESS_DENIED_ERROR",
  "ER_BAD_DB_ERROR",
  "ER_NO_SUCH_TABLE",
]);

function sendLoginDatabaseError(response, error) {
  if (!databaseUnavailableCodes.has(error?.code)) return false;
  response.status(503).json({
    success: false,
    message: "Sign-in is temporarily unavailable. Start MySQL in XAMPP and try again.",
  });
  return true;
}

function publicUser(user) {
  return {
    id: user.id,
    fullName: user.full_name,
    username: user.username,
    email: user.email,
    createdAt: user.created_at,
  };
}

authRouter.post(
  "/signup",
  authLimiter,
  requireDatabase,
  [...accountValidators, passwordValidator],
  validateRequest,
  async (request, response, next) => {
    try {
      const passwordHash = await bcrypt.hash(request.body.password, 12);
      const user = await createUser({
        fullName: cleanText(request.body.fullName, 100),
        username: cleanText(request.body.username, 50).toLowerCase(),
        email: request.body.email.toLowerCase(),
        passwordHash,
      });
      response.cookie(authCookieName, issueAuthToken(user), authCookieOptions());
      response.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        response.status(409).json({ error: "That email address or username is already in use." });
        return;
      }
      next(error);
    }
  },
);

authRouter.post(
  "/login",
  authLimiter,
  requireDatabase,
  [
    body("identity").trim().isLength({ min: 3, max: 255 }).withMessage("Enter your email or username."),
    body("password").isLength({ min: 1, max: 128 }).withMessage("Enter your password."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const identity = cleanText(request.body.identity, 255).toLowerCase();
      const user = await findUserForLogin(identity);
      const passwordMatches = user
        ? await bcrypt.compare(request.body.password, user.password_hash)
        : await bcrypt.compare(request.body.password, "$2b$12$KIXQ4Rz9zmz9E5ZpYl0YAeHh5KjnrxKxN4SX7qPHWLxV0wAw1eDLm");

      if (!user || !passwordMatches) {
        response.status(401).json({
          success: false,
          message: "Email or password is incorrect",
        });
        return;
      }
      response.cookie(authCookieName, issueAuthToken(user), authCookieOptions());
      response.json({ user: publicUser(user) });
    } catch (error) {
      if (sendLoginDatabaseError(response, error)) return;
      next(error);
    }
  },
);

authRouter.post("/logout", (request, response) => {
  response.clearCookie(authCookieName, { ...authCookieOptions(), maxAge: undefined });
  response.status(204).end();
});

authRouter.get("/me", optionalAuth, async (request, response, next) => {
  if (!request.auth || !isDatabaseConfigured()) {
    response.json({ user: null });
    return;
  }
  try {
    const user = await findUserById(request.auth.userId);
    response.json({ user: user ? publicUser(user) : null });
  } catch (error) {
    next(error);
  }
});

authRouter.put(
  "/settings",
  requireAuth,
  requireDatabase,
  accountValidators,
  validateRequest,
  async (request, response, next) => {
    try {
      const user = await updateUser(request.auth.userId, {
        fullName: cleanText(request.body.fullName, 100),
        username: cleanText(request.body.username, 50).toLowerCase(),
        email: request.body.email.toLowerCase(),
      });
      response.cookie(authCookieName, issueAuthToken(user), authCookieOptions());
      response.json({ user: publicUser(user) });
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        response.status(409).json({ error: "That email address or username is already in use." });
        return;
      }
      next(error);
    }
  },
);

authRouter.put(
  "/password",
  requireAuth,
  requireDatabase,
  [
    body("currentPassword").isLength({ min: 1, max: 128 }).withMessage("Enter your current password."),
    body("newPassword")
      .isLength({ min: 10, max: 128 })
      .matches(/[a-z]/)
      .matches(/[A-Z]/)
      .matches(/[0-9]/)
      .matches(/[^A-Za-z0-9]/)
      .withMessage(
        "Use 10+ characters with uppercase, lowercase, a number, and a special character.",
      ),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const user = await findUserForLogin(request.auth.email);
      if (!user || !(await bcrypt.compare(request.body.currentPassword, user.password_hash))) {
        response.status(401).json({ error: "The current password doesn’t match this account. Re-enter it and try again." });
        return;
      }
      await updatePassword(request.auth.userId, await bcrypt.hash(request.body.newPassword, 12));
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  },
);
