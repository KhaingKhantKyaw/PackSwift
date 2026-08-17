import { Router } from "express";
import { param, query } from "express-validator";
import { requireAuth } from "../middleware/auth.js";
import { requireDatabase } from "../middleware/database.js";
import { validateRequest } from "../middleware/validate.js";
import { findOrder, listOrders } from "../repositories/order-repository.js";

export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireDatabase);

ordersRouter.get(
  "/",
  [query("category").optional().isIn(["flight", "accommodation", "travel_gear"])],
  validateRequest,
  async (request, response, next) => {
    try {
      const orders = await listOrders(request.auth.userId, request.query.category || null);
      response.json({ orders });
    } catch (error) {
      next(error);
    }
  },
);

ordersRouter.get(
  "/:orderNumber",
  [param("orderNumber").matches(/^PS[A-Z]-[A-Z0-9]{4,32}$/)],
  validateRequest,
  async (request, response, next) => {
    try {
      const order = await findOrder(request.auth.userId, request.params.orderNumber);
      if (!order) {
        response.status(404).json({ error: "Order not found." });
        return;
      }
      response.json({ order });
    } catch (error) {
      next(error);
    }
  },
);
