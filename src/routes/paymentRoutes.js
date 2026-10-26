import express from "express";
import { ipKeyGenerator } from "express-rate-limit";
import {
  createOrderPayment,
  getOrderPayment,
  getPaymentConfig,
  listPayments,
} from "../controllers/paymentController.js";
import { authorize, protect, requireRole } from "../middlewares/auth.js";
import { limiter } from "../middlewares/rateLimits.js";
import { validate } from "../middlewares/validate.js";
import { idParam } from "../schemas/common.js";
import { paymentListQuery } from "../schemas/payment.js";

const byAccount = (req) => String(req.user?._id || ipKeyGenerator(req.ip));

// Tentatives de paiement : 10 par heure et par compte
const startLimiter = limiter("payment-start", {
  minutes: 60,
  limit: 10,
  message: "Trop de tentatives de paiement. Réessayez plus tard.",
  key: byAccount,
});
// Lecture de l'état (page de retour qui interroge le serveur) : 60 par quart d'heure
const statusLimiter = limiter("payment-status", {
  minutes: 15,
  limit: 60,
  message: "Trop de requêtes. Réessayez dans quelques minutes.",
  key: byAccount,
});

const router = express.Router();
const withId = validate(idParam, "params");

router.get("/config", getPaymentConfig);

router.use(protect);

// Client propriétaire de la réservation (introuvable pour les autres comptes)
router.post("/orders/:id", requireRole("client"), startLimiter, withId, createOrderPayment);
router.get("/orders/:id", requireRole("client"), statusLimiter, withId, getOrderPayment);

// Équipe
router.get("/", authorize("payments.read"), validate(paymentListQuery, "query"), listPayments);

export default router;
