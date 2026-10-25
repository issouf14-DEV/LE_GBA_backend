import { hasPermissions } from "../config/permissions.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Vehicle from "../models/Vehicle.js";
import { serializeOrder } from "../services/orders.js";
import { computeStats } from "../services/stats.js";

// Tableau de bord : calculé sur TOUTES les commandes, pas seulement la première page.
// Les dernières réservations (noms et emails des clients) ne sont montrées qu'aux comptes
// qui ont aussi le droit de voir les réservations.
export async function getStats(req, res) {
  const canSeeOrders = hasPermissions(req.user, ["orders.read"]);
  const [stats, totalUsers, totalVehicles, recent] = await Promise.all([
    computeStats(),
    User.countDocuments(),
    Vehicle.countDocuments(),
    canSeeOrders
      ? Order.find().populate("user", "name email").sort({ createdAt: -1 }).limit(5)
      : [],
  ]);
  res.json({
    ...stats,
    totalUsers,
    totalVehicles,
    recentOrders: recent.map((order) => serializeOrder(order, { withUser: true })),
  });
}
