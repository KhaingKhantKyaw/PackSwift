import { Router } from "express";
import { body } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/database.js";
import { validateRequest } from "../middleware/validate.js";
import { processCheckout } from "../repositories/checkout-repository.js";
import { validateCardPayment } from "../services/card-payment-service.js";

export const checkoutRouter = Router();

checkoutRouter.use(requireAuth, requireDatabase);

function containsCardSecret(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nestedValue]) =>
    /^(card_?number|cvv|cvc|security_?code)$/i.test(key) || containsCardSecret(nestedValue),
  );
}

checkoutRouter.post(
  "/process",
  [
    body("tripId").isUUID(4).withMessage("Choose a valid trip."),
    body("checklistItemKey")
      .matches(/^[a-z0-9-]{2,60}$/)
      .withMessage("Choose a valid checklist item."),
    body("orderType")
      .isIn(["FLIGHT", "HOTEL", "GEAR", "INSURANCE"])
      .withMessage("Choose Flight, Hotel, Gear, or Insurance."),
    body("totalAmount")
      .isFloat({ min: 0.01, max: 10000000 })
      .withMessage("Enter a valid purchase total."),
    body("currency")
      .matches(/^[A-Z]{3}$/)
      .withMessage("Choose a valid three-letter currency."),
    body("paymentMethod")
      .isIn(["VISA", "MASTERCARD", "CREDIT_CARD"])
      .withMessage("Payment method must be Visa, Mastercard, or Credit Card."),
    body("payment").optional().isObject().withMessage("Enter valid card payment details."),
    body("details").isObject().withMessage("Purchase details are required."),
  ],
  validateRequest,
  async (request, response, next) => {
    try {
      if (JSON.stringify(request.body.details).length > 16000) {
        response.status(413).json({ error: "Purchase details are too large." });
        return;
      }
      if (containsCardSecret(request.body.details)) {
        response.status(422).json({
          error: "Do not send card numbers or security codes. Select only a supported payment method.",
        });
        return;
      }
      if (request.body.orderType === "FLIGHT" && !request.body.payment) {
        response.status(422).json({ error: "Card payment details are required for flight confirmation." });
        return;
      }
      const payment = request.body.payment
        ? validateCardPayment(request.body.payment, request.body.paymentMethod)
        : {
            paymentMethod: request.body.paymentMethod,
            brand: ["VISA", "MASTERCARD"].includes(request.body.paymentMethod)
              ? request.body.paymentMethod
              : null,
            last4: null,
          };
      const receipt = await processCheckout(request.auth.userId, {
        tripId: request.body.tripId,
        checklistItemKey: request.body.checklistItemKey,
        orderType: request.body.orderType,
        totalAmount: Number(request.body.totalAmount),
        currency: request.body.currency,
        paymentMethod: payment.paymentMethod,
        payment,
        details: request.body.details,
      });
      response.status(201).json({ success: true, receipt });
    } catch (error) {
      next(error);
    }
  },
);
