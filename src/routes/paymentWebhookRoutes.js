// Routes appelées par CinetPay, montées AVANT le contrôle anti-CSRF (requireAjax) mais après le
// contrôle du proxy : corps lu ici seulement, très petit, et nombre de requêtes limité
import express from "express";
import {
  cinetpayNotify,
  cinetpayNotifyPing,
  cinetpayReturn,
} from "../controllers/paymentWebhookController.js";
import { limiter } from "../middlewares/rateLimits.js";

const notifyLimiter = limiter("payment-notify", {
  minutes: 1,
  limit: 60,
  message: "Trop de notifications.",
});
const returnLimiter = limiter("payment-return", {
  minutes: 15,
  limit: 60,
  message: "Trop de requêtes. Réessayez dans quelques minutes.",
});

// Format envoyé par CinetPay : formulaire (x-www-form-urlencoded) ; JSON accepté aussi.
// extended: false : pas d'objets imbriqués ; corps compressés refusés
const SMALL = { limit: "8kb", inflate: false };
const notifyBody = [
  express.urlencoded({ ...SMALL, extended: false, parameterLimit: 40 }),
  express.json(SMALL),
];

const router = express.Router();

router.post("/notify", notifyLimiter, notifyBody, cinetpayNotify);
router.get("/notify", notifyLimiter, cinetpayNotifyPing);
router.get("/return", returnLimiter, cinetpayReturn);
router.post("/return", returnLimiter, cinetpayReturn);

export default router;
