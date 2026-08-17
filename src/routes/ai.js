import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { createConciergeResponse, normalizeTripContext } from "../services/ai-concierge-service.js";
import { generateTravelAdvice } from "../services/geminiService.js";
import { cleanMultilineText } from "../utils/sanitize.js";

export const aiRouter = Router();

const conciergeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "The Concierge is receiving many messages. Please wait a moment and try again." },
});

aiRouter.post(
  "/chat",
  conciergeLimiter,
  [
    body("message")
      .isString()
      .trim()
      .isLength({ min: 1, max: 1200 })
      .withMessage("Enter a message of up to 1,200 characters."),
    body("tripContext").optional({ nullable: true }).isObject(),
    body("history").optional().isArray({ max: 12 }),
    body("history.*.role").optional().isIn(["user", "assistant"]),
    body("history.*.content")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 1200 }),
    body("chatHistory").optional().isArray({ max: 12 }),
    body("chatHistory.*.role").optional().isIn(["user", "assistant"]),
    body("chatHistory.*.content")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 1200 }),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const message = cleanMultilineText(request.body.message, 1200);
      const suppliedHistory = request.body.history || request.body.chatHistory || [];
      const chatHistory = suppliedHistory.slice(-12).map((entry) => ({
        role: entry.role,
        content: cleanMultilineText(entry.content, 1200),
      }));
      const tripContext = normalizeTripContext(request.body.tripContext);
      let result;
      if (process.env.GEMINI_API_KEY) {
        try {
          result = await generateTravelAdvice(message, chatHistory);
        } catch (providerError) {
          console.error("PackSwift Gemini provider error:", providerError.message);
          result = await createConciergeResponse(
            { message, chatHistory, tripContext },
            { apiKey: "" },
          );
          result.reply += "\n\nI’m using PackSwift’s built-in guidance while the live AI service is temporarily unavailable.";
        }
      } else {
        result = await createConciergeResponse({ message, chatHistory, tripContext });
      }
      response.json(result);
    } catch (error) {
      next(error);
    }
  },
);
