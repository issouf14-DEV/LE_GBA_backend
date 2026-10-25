import mongoose from "mongoose";
import { httpError } from "../middlewares/errorMiddleware.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import { expireStalePending } from "./orderStatus.js";

export const MAX_RENTAL_DAYS = 90;
// Réservation possible jusqu'à 6 mois à l'avance (pas de blocage du catalogue pour l'an 9999)
export const MAX_ADVANCE_DAYS = 180;
const MAX_PENDING_PER_USER = 5;
const DAY_MS = 86_400_000;

const todayUtc = () => new Date().toISOString().slice(0, 10);
const toDate = (value) => new Date(`${value}T00:00:00Z`);

// Le prix et la durée sont calculés ici, jamais repris de la requête du client
export async function quoteOrder(userId, { vehicleId, startDate, endDate }) {
  if (startDate < todayUtc()) throw httpError(400, "La date de début ne peut pas être passée");
  if (endDate <= startDate) throw httpError(400, "La date de fin doit suivre la date de début");

  const advance = Math.round((toDate(startDate) - toDate(todayUtc())) / DAY_MS);
  if (advance > MAX_ADVANCE_DAYS) {
    throw httpError(400, `Réservation possible au plus ${MAX_ADVANCE_DAYS} jours à l'avance`);
  }

  const days = Math.round((toDate(endDate) - toDate(startDate)) / DAY_MS);
  if (days > MAX_RENTAL_DAYS) throw httpError(400, `Durée maximale : ${MAX_RENTAL_DAYS} jours`);

  // Les demandes restées sans réponse 48 h ne bloquent plus le véhicule
  await expireStalePending();
  const vehicle = await Vehicle.findById(vehicleId);
  if (!vehicle || vehicle.available === false || !(vehicle.price > 0)) {
    throw httpError(409, "Ce véhicule n'est pas disponible");
  }

  const start = toDate(startDate);
  const end = toDate(endDate);
  if (await Order.exists(overlapFilter(vehicle._id, start, end))) {
    throw httpError(409, "Ce véhicule est déjà réservé sur ces dates");
  }

  const pending = await Order.countDocuments({ user: userId, status: "en_attente" });
  if (pending >= MAX_PENDING_PER_USER) {
    throw httpError(429, "Trop de réservations en attente. Patientez leur validation.");
  }

  return { vehicle, days, start, end };
}

// Réservations actives qui chevauchent la période [start, end[
// (opérateurs écrits par le serveur lui-même : marqués « de confiance » pour sanitizeFilter)
function overlapFilter(vehicleId, start, end) {
  return {
    vehicle: vehicleId,
    status: mongoose.trusted({ $in: ["en_attente", "validee"] }),
    startDate: mongoose.trusted({ $lt: end }),
    endDate: mongoose.trusted({ $gt: start }),
  };
}

// Deux demandes simultanées peuvent passer la vérification en même temps : après l'enregistrement,
// seule la plus ancienne est gardée, l'autre est supprimée
export async function ensureNoDoubleBooking(order) {
  // Filtre construit uniquement par le serveur : la protection anti-injection peut être levée
  const earlier = await Order.exists({
    ...overlapFilter(order.vehicle, order.startDate, order.endDate),
    $or: [
      { createdAt: { $lt: order.createdAt } },
      { createdAt: order.createdAt, _id: { $lt: order._id } },
    ],
  }).setOptions({ sanitizeFilter: false });
  if (earlier) {
    await Order.deleteOne({ _id: order._id });
    throw httpError(409, "Ce véhicule vient d'être réservé sur ces dates");
  }
}

// Adresse du compte qui a passé la commande : seule destination des emails de suivi
export async function accountEmail(order) {
  const user = await User.findById(order.user).select("email").lean();
  return user?.email;
}

// Réponse envoyée au navigateur : jamais le document brut de la base
export function serializeOrder(order, { withUser = false } = {}) {
  const plain = order.toObject ? order.toObject() : order;
  return {
    _id: plain._id,
    vehicle: { _id: plain.vehicle?._id ?? plain.vehicle, ...plain.vehicleSnapshot },
    startDate: plain.startDate,
    endDate: plain.endDate,
    days: plain.days,
    pricePerDay: plain.pricePerDay,
    totalPrice: plain.totalPrice,
    contact: plain.contact,
    notes: plain.notes,
    status: plain.status,
    paymentMethod: plain.paymentMethod,
    createdAt: plain.createdAt,
    validatedAt: plain.validatedAt,
    completedAt: plain.completedAt,
    ...(withUser && plain.user?.email
      ? { user: { _id: plain.user._id, name: plain.user.name, email: plain.user.email } }
      : {}),
  };
}

// Commande d'un client : introuvable si elle appartient à quelqu'un d'autre (pas d'IDOR)
export async function findOwnOrder(orderId, userId) {
  const order = await Order.findOne({ _id: orderId, user: userId });
  if (!order) throw httpError(404, "Réservation introuvable");
  return order;
}

export async function findOrder(orderId) {
  const order = await Order.findById(orderId);
  if (!order) throw httpError(404, "Réservation introuvable");
  return order;
}
