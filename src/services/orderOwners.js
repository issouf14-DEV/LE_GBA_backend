// Ajoute aux réservations le nom et l'email de leur client, pour l'administration.
// Remplace populate() : avec la protection anti-injection (sanitizeFilter), la requête $in
// générée par populate était neutralisée et provoquait « Identifiant invalide ».
import mongoose from "mongoose";
import User from "../models/User.js";

export async function withOwners(orders) {
  const ids = [...new Set(orders.map((order) => String(order.user)).filter(Boolean))];
  // Filtre écrit par le serveur (identifiants lus en base) : la protection peut être levée
  const owners = await User.find({ _id: mongoose.trusted({ $in: ids }) })
    .select("name email")
    .lean();
  const byId = new Map(owners.map((owner) => [String(owner._id), owner]));
  return orders.map((order) => {
    const plain = order.toObject ? order.toObject() : order;
    return { ...plain, user: byId.get(String(plain.user)) ?? null };
  });
}
