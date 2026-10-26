// Consommateur « inapp » : relit en base la commande ou le compte visé par l'événement et crée
// les notifications de la cloche. L'API les pousse ensuite aux navigateurs connectés (SSE).
import mongoose from "mongoose";
import { effectivePermissions, STAFF_ROLES } from "../../config/permissions.js";
import Notification from "../../models/Notification.js";
import Order, { ORDER_STATUSES } from "../../models/Order.js";
import User from "../../models/User.js";
import {
  newOrderMessage,
  orderStatusMessage,
  SECURITY_MESSAGES,
} from "../../services/notifications/messages.js";
import { EVENTS } from "../topology.js";

const DUPLICATE_KEY = 11000;

// Identifiant invalide ou ressource supprimée entre-temps : null, rien à notifier
const findById = (Model, id) => (mongoose.isValidObjectId(id) ? Model.findById(id).lean() : null);

// Membres actifs de l'équipe autorisés à voir les réservations (orders.read)
async function orderReaders() {
  const staff = await User.find({
    role: mongoose.trusted({ $in: [...STAFF_ROLES, "admin"] }),
    disabledAt: null,
  })
    .select("role permissions")
    .lean();
  return staff.filter((user) => effectivePermissions(user).includes("orders.read"));
}

// Seules des collisions sur l'index unique { eventId, user } : déjà créées par une livraison
// précédente du même événement (idempotence)
const onlyDuplicates = (error) =>
  error?.code === DUPLICATE_KEY ||
  (Array.isArray(error?.writeErrors) &&
    error.writeErrors.length > 0 &&
    error.writeErrors.every((item) => (item.code ?? item.err?.code) === DUPLICATE_KEY));

async function notify(eventId, userIds, message) {
  if (!message || userIds.length === 0) return 0;
  const docs = userIds.map((user) => ({ ...message, user, eventId }));
  try {
    const created = await Notification.insertMany(docs, { ordered: false });
    return created.length;
  } catch (error) {
    if (onlyDuplicates(error)) return 0;
    throw error;
  }
}

const toUser =
  (type) =>
  async (eventId, { userId }) => {
    const user = await findById(User, userId);
    if (!user || user.disabledAt) return 0;
    return notify(eventId, [user._id], SECURITY_MESSAGES[type]);
  };

const HANDLERS = {
  [EVENTS.orderCreated]: async (eventId, { orderId }) => {
    const order = await findById(Order, orderId);
    if (!order) return 0;
    const readers = await orderReaders();
    return notify(
      eventId,
      readers.map((user) => user._id),
      newOrderMessage(order)
    );
  },
  [EVENTS.orderStatusChanged]: async (eventId, { orderId, status }) => {
    const order = await findById(Order, orderId);
    if (!order) return 0;
    // C'est l'événement qui fait foi : la commande a pu changer de statut depuis
    const eventStatus = ORDER_STATUSES.includes(status) ? status : order.status;
    return notify(eventId, [order.user], orderStatusMessage(order, eventStatus));
  },
  [EVENTS.passwordChanged]: toUser(EVENTS.passwordChanged),
  [EVENTS.mfaEnabled]: toUser(EVENTS.mfaEnabled),
  [EVENTS.mfaReset]: toUser(EVENTS.mfaReset),
};

// Renvoie le nombre de notifications créées ; une exception déclenche un nouvel essai
export async function handleInappEvent(message) {
  const handler = Object.hasOwn(HANDLERS, String(message?.type)) ? HANDLERS[message.type] : null;
  if (!handler) {
    console.warn(`Consommateur inapp : type d'événement ignoré (${message?.type})`);
    return 0;
  }
  return handler(String(message.id), message.payload || {});
}
