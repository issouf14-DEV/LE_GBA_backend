import express from "express";
import { createPaymentIntent } from "../utils/payment.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Route pour créer un paiement (authentification requise)
router.post("/create-payment-intent", protect, async (req, res) => {
  try {
    const { amount, currency, orderId } = req.body;
    const paymentIntent = await createPaymentIntent(amount, currency, orderId);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;
