import crypto from "node:crypto";
import jwt from "jsonwebtoken";

export const authCookieName = "packswift_session";
const isProduction = process.env.NODE_ENV === "production";
const generatedDevelopmentSecret = crypto.randomBytes(48).toString("hex");

export function getJwtSecret() {
  if (
    process.env.JWT_SECRET &&
    process.env.JWT_SECRET !== "YOUR_SECRET" &&
    process.env.JWT_SECRET.length >= 32
  ) {
    return process.env.JWT_SECRET;
  }
  if (isProduction) {
    throw new Error(
      "JWT_SECRET must be configured with at least 32 characters when NODE_ENV is production.",
    );
  }
  return generatedDevelopmentSecret;
}

export function issueAuthToken(user) {
  return jwt.sign(
    { sub: String(user.id), username: user.username, email: user.email },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: "7d", issuer: "packswift", audience: "packswift-web" },
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    algorithms: ["HS256"],
    issuer: "packswift",
    audience: "packswift-web",
  });
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}
