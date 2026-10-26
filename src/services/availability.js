// Calendrier de disponibilité : périodes où un véhicule est occupé, sans aucune donnée personnelle
// ni identifiant de réservation. Même règle que la vérification de double réservation.
import mongoose from "mongoose";
import { httpError } from "../middlewares/errorMiddleware.js";
import Order from "../models/Order.js";
import Vehicle from "../models/Vehicle.js";
import { PENDING_TTL_MS } from "./orderStatus.js";
import { MAX_ADVANCE_DAYS, MAX_RENTAL_DAYS, overlapFilter } from "./orders.js";

// Plage consultable en une requête (jours, bornes comprises)
export const MAX_RANGE_DAYS = 90;
// Au-delà, aucune réservation ne peut exister (début à 180 jours au plus, durée de 90 jours au plus)
const HORIZON_DAYS = MAX_ADVANCE_DAYS + MAX_RENTAL_DAYS;
const DAY_MS = 86_400_000;

const toDate = (value) => new Date(`${value}T00:00:00Z`);
const toIso = (date) => date.toISOString().slice(0, 10);
const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

// Fusionne des intervalles [start, end[ (Date) : ceux qui se chevauchent ou se touchent
// (fin de l'un = début de l'autre) n'en forment qu'un. Les intervalles vides sont ignorés.
export function mergeIntervals(intervals) {
  const sorted = intervals
    .filter(({ start, end }) => end > start)
    .map(({ start, end }) => ({ start: new Date(start), end: new Date(end) }))
    .sort((a, b) => a.start - b.start);
  const merged = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval.start <= last.end) {
      if (interval.end > last.end) last.end = interval.end;
    } else {
      merged.push(interval);
    }
  }
  return merged;
}

// Plage demandée (AAAA-MM-JJ, bornes comprises) -> intervalle [start, end[ réellement interrogé.
// Les jours déjà passés ne sont jamais consultés : la plage commence au plus tôt aujourd'hui.
export function resolveRange({ from, to } = {}, now = new Date()) {
  const today = toDate(toIso(now));
  const first = from ? toDate(from) : today;
  const last = to ? toDate(to) : addDays(first, MAX_RANGE_DAYS - 1);
  if (last < first) throw httpError(400, "La date de fin doit suivre la date de début");
  if ((last - first) / DAY_MS + 1 > MAX_RANGE_DAYS) {
    throw httpError(400, `Plage de ${MAX_RANGE_DAYS} jours maximum`);
  }
  if (first > addDays(today, HORIZON_DAYS)) throw httpError(400, "Plage trop lointaine");
  const start = new Date(Math.max(first, today));
  return { from: toIso(first), to: toIso(last), start, end: addDays(last, 1) };
}

// Intervalles [start, end[ fusionnés et ramenés à la plage -> jours occupés, bornes comprises
export function toPeriods(intervals, start, end) {
  const clipped = intervals.map((interval) => ({
    start: new Date(Math.max(interval.start, start)),
    end: new Date(Math.min(interval.end, end)),
  }));
  return mergeIntervals(clipped).map((interval) => ({
    start: toIso(interval.start),
    end: toIso(addDays(interval.end, -1)),
  }));
}

// Réservations qui bloquent vraiment le véhicule : validées, ou en attente depuis moins de 48 h
// (au-delà, elles sont annulées automatiquement). Seules les dates sont lues.
function blockingOrders(vehicleId, start, end, now) {
  return Order.find({
    ...overlapFilter(vehicleId, start, end),
    $or: [
      { status: "validee" },
      {
        status: "en_attente",
        createdAt: mongoose.trusted({ $gt: new Date(now.getTime() - PENDING_TTL_MS) }),
      },
    ],
  })
    .select({ _id: 0, startDate: 1, endDate: 1 })
    .lean();
}

export async function vehicleAvailability(vehicleId, query, now = new Date()) {
  const range = resolveRange(query, now);
  if (!(await Vehicle.exists({ _id: vehicleId }))) throw httpError(404, "Véhicule introuvable");
  if (range.end <= range.start) return { from: range.from, to: range.to, periods: [] };
  const orders = await blockingOrders(vehicleId, range.start, range.end, now);
  const intervals = orders.map((order) => ({ start: order.startDate, end: order.endDate }));
  return { from: range.from, to: range.to, periods: toPeriods(intervals, range.start, range.end) };
}
