import express from "express";
import { createPaymentIntent } from "../utils/payment.js";

const router = express.Router();

// Route pour créer un paiement
router.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, currency, orderId } = req.body;
    const paymentIntent = await createPaymentIntent(amount, currency, orderId);
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
export default router;
