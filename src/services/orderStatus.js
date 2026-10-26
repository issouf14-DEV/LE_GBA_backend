// Changements de statut atomiques : la commande n'est modifiée que si elle a toujours le statut
// attendu (un client qui annule pendant qu'un admin valide ne peut pas obtenir les deux)
import mongoose from "mongoose";
import { recordEvent } from "../events/outbox.js";
import { EVENTS } from "../events/topology.js";
import { httpError } from "../middlewares/errorMiddleware.js";
import Order, { ALLOWED_TRANSITIONS } from "../models/Order.js";

// Une demande sans réponse pendant 48 h est annulée : elle ne bloque plus le véhicule
export const PENDING_TTL_MS = 48 * 60 * 60 * 1000;

const DATE_FIELD = { validee: "validatedAt", terminee: "completedAt", annulee: "cancelledAt" };

// Statuts depuis lesquels on peut atteindre `status`
const sourcesOf = (status) =>
  Object.keys(ALLOWED_TRANSITIONS).filter((from) => ALLOWED_TRANSITIONS[from].includes(status));

// `scope` restreint la commande visée (ex : { user } pour un client). Le nouveau statut et
// l'événement qui prévient le client (email) sont écrits dans la même transaction.
export async function changeStatus(orderId, status, { scope = {}, from = sourcesOf(status) } = {}) {
  const set = { status, ...(DATE_FIELD[status] ? { [DATE_FIELD[status]]: new Date() } : {}) };
  const session = await mongoose.startSession();
  let updated = null;
  try {
    await session.withTransaction(async () => {
      updated = await Order.findOneAndUpdate(
        { _id: orderId, ...scope, status: mongoose.trusted({ $in: from }) },
        { $set: set },
        { new: true, session }
      );
      if (updated) {
        await recordEvent(EVENTS.orderStatusChanged, { orderId: updated._id, status }, { session });
      }
    });
  } finally {
    await session.endSession();
  }
  if (updated) return updated;

  const exists = await Order.exists({ _id: orderId, ...scope });
  if (!exists) throw httpError(404, "Réservation introuvable");
  throw httpError(409, "Ce changement de statut n'est pas autorisé");
}

// Réservations qui empêchent de supprimer un véhicule ou un client : une demande en attente,
// ou une location validée dont la date de fin n'est pas encore passée. Une location validée
// déjà terminée dans le temps ne bloque plus (elle reste dans l'historique).
export function hasBlockingOrders(filter) {
  return Order.exists({
    ...filter,
    $or: [
      { status: "en_attente" },
      { status: "validee", endDate: mongoose.trusted({ $gt: new Date() }) },
    ],
  });
}

export async function expireStalePending() {
  const { modifiedCount } = await Order.updateMany(
    {
      status: "en_attente",
      createdAt: mongoose.trusted({ $lt: new Date(Date.now() - PENDING_TTL_MS) }),
    },
    { $set: { status: "annulee", cancelledAt: new Date() } }
  );
  return modifiedCount;
}
