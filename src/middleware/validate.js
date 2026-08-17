import { validationResult } from "express-validator";

export function validateRequest(request, response, next) {
  const result = validationResult(request);
  if (!result.isEmpty()) {
    response.status(422).json({
      error: "Please review the highlighted information.",
      fields: result.array({ onlyFirstError: true }).map(({ path, msg }) => ({ field: path, message: msg })),
    });
    return;
  }
  next();
}
