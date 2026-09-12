import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { body } from "express-validator";
import { validateRequest } from "../middleware/validate.js";
import { createConciergeResponse, normalizeTripContext } from "../services/ai-concierge-service.js";
import {
  askTravelConcierge,
  isTravelDomainMessage,
  OFF_TOPIC_REFUSAL,
} from "../services/geminiService.js";
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
    body("history").optional().isArray({ max: 20 }),
    body("history.*.role").optional().isIn(["user", "model", "assistant"]),
    body("history.*.text")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 1200 }),
    body("history.*.content")
      .optional()
      .isString()
      .trim()
      .isLength({ min: 1, max: 1200 }),
    body("chatHistory").optional().isArray({ max: 20 }),
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
      const chatHistory = suppliedHistory.slice(-20).map((entry) => ({
        role: entry.role === "assistant" ? "model" : entry.role,
        text: cleanMultilineText(entry.text ?? entry.content, 1200),
        content: cleanMultilineText(entry.text ?? entry.content, 1200),
      }));
      const tripContext = normalizeTripContext(request.body.tripContext);
      let result;
      if (!isTravelDomainMessage(message, chatHistory)) {
        result = { text: OFF_TOPIC_REFUSAL, reply: OFF_TOPIC_REFUSAL, source: "domain-guardrail" };
      } else if (process.env.GEMINI_API_KEY) {
        try {
          result = await askTravelConcierge(message, chatHistory, { tripContext });
        } catch (providerError) {
          console.error("PackSwift Gemini provider error:", providerError.message);
          result = await createConciergeResponse(
            { message, chatHistory, tripContext },
            { apiKey: "" },
          );
          result.reply += "\n\nI’m using PackSwift’s built-in travel guidance while the live concierge is temporarily unavailable.";
          result.text = result.reply;
        }
      } else {
        result = await createConciergeResponse({ message, chatHistory, tripContext });
        result.text = result.reply;
      }
      const text = String(result.text || result.reply || "").trim();
      response.json({
        success: true,
        text,
        reply: text,
        ...(result.trip_card ? { trip_card: result.trip_card } : {}),
        ...(result.trip_recommendation ? { trip_recommendation: result.trip_recommendation } : {}),
        source: result.source,
        ...(result.model ? { model: result.model } : {}),
      });
    } catch (error) {
      next(error);
    }
  },
);
