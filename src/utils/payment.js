// src/utils/payment.js
import { stripe } from "../config/stripe.js";

export const createPaymentIntent = async (amount, currency, orderId) => {
  return await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: { orderId },
  });
};

// export const confirmPaymentIntent = async (paymentIntentId) => {
//   return await stripe.paymentIntents.confirm(paymentIntentId);
// };