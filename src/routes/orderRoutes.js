import express from "express";
import {
  cancelMyOrder,
  createOrder,
  getAllOrders,
  getMyOrders,
  resendMyOrderEmail,
  sendPaymentReminder,
  sendRentalSummary,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { authorize, protect, requireRole } from "../middlewares/auth.js";
import { emailLimiter, orderLimiter } from "../middlewares/rateLimits.js";
import { validate } from "../middlewares/validate.js";
import { idParam } from "../schemas/common.js";
import { listQuery, orderSchema, statusSchema } from "../schemas/index.js";

const router = express.Router();
const withId = validate(idParam, "params");

router.use(protect);

// Client (les comptes de l'équipe ne réservent pas)
router.post("/", requireRole("client"), orderLimiter, validate(orderSchema), createOrder);
router.get("/mine", getMyOrders);
router.patch("/:id/cancel", withId, cancelMyOrder);
router.post("/:id/resend-email", emailLimiter, withId, resendMyOrderEmail);

// Équipe : permission précise exigée pour chaque action
const manage = [authorize("orders.manage"), emailLimiter, withId];
router.get("/", authorize("orders.read"), validate(listQuery, "query"), getAllOrders);
router.patch(
  "/:id/status",
  authorize("orders.manage"),
  withId,
  validate(statusSchema),
  updateOrderStatus
);
router.post("/:id/send-payment-reminder", ...manage, sendPaymentReminder);
router.post("/:id/send-rental-summary", ...manage, sendRentalSummary);

export default router;
