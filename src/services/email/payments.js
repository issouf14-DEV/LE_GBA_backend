// Reçu envoyé au client après le paiement en ligne de son acompte
import mongoose from "mongoose";
import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import User from "../../models/User.js";
import { button, date, escapeHtml, layout, price, row } from "./layout.js";
import { sendEmail } from "./sender.js";

const reference = (order) => String(order._id).slice(-8).toUpperCase();

// `to` : adresse du compte client (jamais l'email libre saisi dans la réservation)
export const sendPaymentReceiptEmail = (order, payment, to) => {
  const rest = Math.max(0, (Number(order.totalPrice) || 0) - (Number(payment.amount) || 0));
  return sendEmail({
    kind: "reçu d'acompte",
    to,
    subject: `Reçu de paiement - réservation #${reference(order)}`,
    html: layout(
      "Acompte reçu",
      `<p>Bonjour ${escapeHtml(order.contact?.fullName)},</p>
      <p>Nous avons bien reçu le paiement de votre acompte par Mobile Money. Merci !</p>
      ${row("Réservation", `#${reference(order)}`)}${row("Acompte payé", price(payment.amount))}${row("Date du paiement", date(payment.paidAt))}${row("Transaction", payment.transactionId)}${row("Reste à payer à la remise du véhicule", price(rest))}${button("Voir mes réservations", "/profile/orders")}`
    ),
  });
};

const byId = (Model, id) => (mongoose.isValidObjectId(id) ? Model.findById(id).lean() : null);

// Handler de l'événement payment.accepted (consommateur email) : true, false ou null
export async function handlePaymentAccepted({ orderId, paymentId }) {
  const [order, payment] = await Promise.all([byId(Order, orderId), byId(Payment, paymentId)]);
  if (!order || payment?.status !== "accepted" || String(payment.order) !== String(order._id)) {
    return null;
  }
  const client = await byId(User, order.user);
  return client?.email ? sendPaymentReceiptEmail(order, payment, client.email) : null;
}
