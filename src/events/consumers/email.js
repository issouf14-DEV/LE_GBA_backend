// Consommateur « email » : relit en base la commande ou le compte visé par l'événement, puis
// envoie l'email correspondant avec les fonctions d'envoi existantes
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import Order, { ORDER_STATUSES } from "../../models/Order.js";
import User from "../../models/User.js";
import { sendNewOrderToAdmin, sendOrderStatusEmail } from "../../services/email/index.js";
import { handlePaymentAccepted } from "../../services/email/payments.js";
import { emailConfig } from "../../services/email/providers.js";
import { sendPasswordChangedEmail } from "../../services/email/security.js";
import { sendMfaEnabledEmail, sendMfaResetEmail } from "../../services/email/verification.js";
import { EVENTS } from "../topology.js";

// Emails non configurés (développement, tests) : un envoi refusé n'est pas une erreur
const emailsEnabled = () => emailConfig(env).enabled;

// Identifiant invalide ou ressource supprimée entre-temps : null, rien à envoyer
const findById = (Model, id) => (mongoose.isValidObjectId(id) ? Model.findById(id).lean() : null);

const toUser =
  (send) =>
  async ({ userId }) => {
    const user = await findById(User, userId);
    return user?.email ? send(user) : null;
  };

// Chaque handler renvoie true (envoyé), false (envoi refusé) ou null (rien à envoyer)
const HANDLERS = {
  [EVENTS.orderCreated]: async ({ orderId }) => {
    if (!env.ADMIN_EMAIL) return null;
    const order = await findById(Order, orderId);
    return order ? sendNewOrderToAdmin(order) : null;
  },
  [EVENTS.orderStatusChanged]: async ({ orderId, status }) => {
    const order = await findById(Order, orderId);
    if (!order) return null;
    const client = await findById(User, order.user);
    if (!client?.email) return null;
    // C'est l'événement qui fait foi : la commande a pu changer de statut depuis
    const eventStatus = ORDER_STATUSES.includes(status) ? status : order.status;
    return sendOrderStatusEmail({ ...order, status: eventStatus }, client.email);
  },
  [EVENTS.passwordChanged]: toUser(sendPasswordChangedEmail),
  [EVENTS.mfaEnabled]: toUser(sendMfaEnabledEmail),
  [EVENTS.mfaReset]: toUser(sendMfaResetEmail),
  [EVENTS.paymentAccepted]: handlePaymentAccepted,
};

export async function handleEmailEvent(message) {
  const handler = HANDLERS[message?.type];
  if (!handler) {
    console.warn(`Consommateur email : type d'événement ignoré (${message?.type})`);
    return;
  }
  const sent = await handler(message.payload || {});
  // Une exception déclenche un nouvel essai (puis la file morte)
  if (sent === false && emailsEnabled()) {
    throw new Error(`Email non envoyé pour l'événement ${message.type} (${message.id})`);
  }
}
