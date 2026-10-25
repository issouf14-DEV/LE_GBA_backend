// Statistiques du tableau de bord, calculées par MongoDB sur l'ensemble des commandes
import Order, { ORDER_STATUSES } from "../models/Order.js";

const MONTHS = 6;
const REVENUE_STATUSES = ["validee", "terminee"];

// Les 6 derniers mois (UTC), du plus ancien au plus récent, même s'ils sont vides
function lastMonths(now = new Date()) {
  return Array.from({ length: MONTHS }, (_, index) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (MONTHS - 1 - index), 1)
    );
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
  });
}

export async function computeStats() {
  const months = lastMonths();
  const since = new Date(Date.UTC(months[0].year, months[0].month - 1, 1));

  // Pipeline écrit par le serveur uniquement (aucune donnée du client)
  const [byStatus, monthly] = await Promise.all([
    Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 }, revenue: { $sum: "$totalPrice" } } },
    ]),
    Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          commandes: { $sum: 1 },
          revenus: {
            $sum: { $cond: [{ $in: ["$status", REVENUE_STATUSES] }, "$totalPrice", 0] },
          },
        },
      },
    ]),
  ]);

  const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
  let totalRevenue = 0;
  for (const { _id, count, revenue } of byStatus) {
    if (_id in counts) counts[_id] = count;
    if (REVENUE_STATUSES.includes(_id)) totalRevenue += revenue;
  }

  const find = ({ year, month }) =>
    monthly.find((item) => item._id.year === year && item._id.month === month);

  return {
    totalOrders: Object.values(counts).reduce((sum, value) => sum + value, 0),
    pendingOrders: counts.en_attente,
    totalRevenue,
    byStatus: counts,
    monthly: months.map((key) => ({
      ...key,
      revenus: find(key)?.revenus ?? 0,
      commandes: find(key)?.commandes ?? 0,
    })),
  };
}
