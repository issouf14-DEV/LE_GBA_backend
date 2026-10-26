import mongoose from "mongoose";
import { hasPermissions } from "../config/permissions.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import { withOwners } from "../services/orderOwners.js";
import { serializeOrder } from "../services/orders.js";
import { computeStats } from "../services/stats.js";

// Tableau de bord : calculé sur TOUTES les commandes, pas seulement la première page.
// Les dernières réservations (noms et emails des clients) ne sont montrées qu'aux comptes
// qui ont aussi le droit de voir les réservations.
export async function getStats(req, res) {
  const canSeeOrders = hasPermissions(req.user, ["orders.read"]);
  const [stats, totalUsers, totalVehicles, recent] = await Promise.all([
    computeStats(),
    // Clients uniquement (l'équipe n'est pas comptée)
    User.countDocuments({ role: mongoose.trusted({ $in: ["client", "user"] }) }),
    Vehicle.countDocuments(),
    canSeeOrders ? Order.find().sort({ createdAt: -1 }).limit(5) : [],
  ]);
  res.json({
    ...stats,
    totalUsers,
    totalVehicles,
    recentOrders: (await withOwners(recent)).map((order) =>
      serializeOrder(order, { withUser: true })
    ),
  });
}
