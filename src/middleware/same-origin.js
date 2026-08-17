const protectedMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function requireSameOrigin(request, response, next) {
  if (!protectedMethods.has(request.method)) {
    next();
    return;
  }

  const origin = request.get("origin");
  if (!origin) {
    next();
    return;
  }

  try {
    const expectedOrigin = `${request.protocol}://${request.get("host")}`;
    if (new URL(origin).origin !== expectedOrigin) {
      response.status(403).json({ error: "Cross-origin request rejected." });
      return;
    }
  } catch {
    response.status(403).json({ error: "Invalid request origin." });
    return;
  }
  next();
}
