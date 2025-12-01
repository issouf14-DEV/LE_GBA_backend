import express from "express";
import {
  createOrder,
  getMyOrders,
  getAllOrders,
  updateOrderStatus,
  notifyAdmin,
  sendCustomerNotification,
} from "../controllers/orderController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Client
router.post("/", protect, createOrder);
router.get("/myorders", protect, getMyOrders);

// Admin
router.get("/", protect, adminOnly, getAllOrders);
router.put("/:id", protect, adminOnly, updateOrderStatus);

// Email notifications
router.post("/notify-admin", protect, notifyAdmin);
router.post("/:id/send-notification", protect, adminOnly, sendCustomerNotification);

export default router;
