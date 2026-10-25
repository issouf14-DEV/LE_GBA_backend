// Anciennes commandes (paiement Stripe, liste `vehicles`) -> nouveau format (paiement à la remise)
const STATUS_MAP = {
  "en attente": "en_attente",
  payée: "validee",
  échouée: "rejetee",
  remboursée: "annulee",
};
const DAY_MS = 86_400_000;

export async function migrateOrders(db, apply) {
  const orders = db.collection("orders");
  const users = db.collection("users");
  const vehicles = db.collection("vehicles");
  const legacy = await orders.find({ vehicles: { $exists: true } }).toArray();

  for (const order of legacy) {
    const vehicleId = order.vehicles?.[0]?.vehicle;
    const [user, vehicle] = await Promise.all([
      users.findOne({ _id: order.user }),
      vehicleId ? vehicles.findOne({ _id: vehicleId }) : null,
    ]);
    // Les anciennes commandes n'avaient pas de dates : on garde la date de création
    const start = order.createdAt || new Date();
    const total = Number(order.totalPrice) || 0;

    const update = {
      $set: {
        vehicle: vehicleId ?? null,
        vehicleSnapshot: {
          brand: vehicle?.brand || "Véhicule",
          model: vehicle?.model || "supprimé",
          year: vehicle?.year,
          image: vehicle?.image?.startsWith("https://") ? vehicle.image : undefined,
        },
        startDate: start,
        endDate: new Date(start.getTime() + DAY_MS),
        days: 1,
        pricePerDay: total,
        totalPrice: total,
        contact: {
          fullName: user?.name || "Client",
          email: user?.email || "inconnu@le-gba.invalid",
          phone: user?.phone || "-",
          address: user?.address || "-",
        },
        notes: "Commande importée depuis l'ancienne version du site",
        status: STATUS_MAP[order.status] ?? "annulee",
        paymentMethod: "on_delivery",
      },
      $unset: { vehicles: "", paymentInfo: "", paymentIntentId: "" },
    };
    if (apply) await orders.updateOne({ _id: order._id }, update);
  }
  return `${legacy.length} commande(s) à l'ancien format`;
}
