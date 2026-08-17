import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { body } from "express-validator";
import { requireDatabase } from "../middleware/database.js";
import { validateRequest } from "../middleware/validate.js";
import { saveContactMessage } from "../repositories/contact-repository.js";
import { cleanMultilineText, cleanText } from "../utils/sanitize.js";

export const contactRouter = Router();

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many messages were submitted. Please try again later." },
});

contactRouter.post(
  "/feedback",
  contactLimiter,
  requireDatabase,
  [body("message").trim().isLength({ min: 10, max: 500 }).withMessage("Share 10–500 characters of feedback.")],
  validateRequest,
  async (request, response, next) => {
    try {
      const result = await saveContactMessage({
        fullName: "Website visitor",
        email: "feedback@packswift.local",
        subject: "Homepage feedback",
        message: cleanMultilineText(request.body.message, 500),
      });
      response.status(201).json({ message: "Thanks — your feedback has been received.", id: result.id });
    } catch (error) {
      next(error);
    }
  },
);

contactRouter.post(
  "/",
  contactLimiter,
  requireDatabase,
  [
    body("fullName").trim().isLength({ min: 2, max: 100 }).withMessage("Use 2–100 characters."),
    body("email").trim().isEmail().withMessage("Enter a valid email address.").normalizeEmail(),
    body("subject").trim().isLength({ min: 3, max: 255 }).withMessage("Use 3–255 characters."),
    body("message").trim().isLength({ min: 10, max: 5000 }).withMessage("Use 10–5,000 characters."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      const result = await saveContactMessage({
        fullName: cleanText(request.body.fullName, 100),
        email: request.body.email.toLowerCase(),
        subject: cleanText(request.body.subject, 255),
        message: cleanMultilineText(request.body.message, 5000),
      });
      response.status(201).json({ message: "Thanks — your message has been received.", id: result.id });
    } catch (error) {
      next(error);
    }
  },
);
