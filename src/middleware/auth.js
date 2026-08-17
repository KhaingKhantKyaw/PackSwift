import { authCookieName, verifyAuthToken } from "../config/auth.js";

function readToken(request) {
  const cookieToken = request.cookies?.[authCookieName];
  if (cookieToken) return cookieToken;

  const authorization = request.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  return null;
}

export function optionalAuth(request, response, next) {
  const token = readToken(request);
  if (!token) {
    request.auth = null;
    next();
    return;
  }

  try {
    const payload = verifyAuthToken(token);
    request.auth = { userId: Number(payload.sub), username: payload.username, email: payload.email };
  } catch {
    request.auth = null;
  }
  next();
}

export function requireAuth(request, response, next) {
  optionalAuth(request, response, () => {
    if (!request.auth) {
      response.status(401).json({ error: "Sign in to continue." });
      return;
    }
    next();
  });
}
