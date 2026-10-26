import { recordEvent } from "../events/outbox.js";
import { EVENTS } from "../events/topology.js";
import { httpError } from "../middlewares/errorMiddleware.js";
import Order from "../models/Order.js";
import { audit } from "../services/audit.js";
import {
  sendOrderStatusEmail,
  sendPaymentReminderEmail,
  sendRentalSummaryEmail,
} from "../services/email/index.js";
import { withOwners } from "../services/orderOwners.js";
import { changeStatus } from "../services/orderStatus.js";
import {
  accountEmail,
  ensureNoDoubleBooking,
  findOrder,
  findOwnOrder,
  quoteOrder,
  serializeOrder,
} from "../services/orders.js";
import { toPublicVehicle } from "../services/vehicles.js";

export async function createOrder(req, res) {
  const { vehicle, days, start, end } = await quoteOrder(req.user._id, req.body);
  const order = await Order.create({
    user: req.user._id,
    vehicle: vehicle._id,
    vehicleSnapshot: {
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      // Photo enregistrée depuis l'administration ou URL https, comme dans le catalogue
      image: toPublicVehicle(vehicle).image || undefined,
    },
    startDate: start,
    endDate: end,
    days,
    pricePerDay: vehicle.price,
    totalPrice: vehicle.price * days,
    contact: req.body.contact,
    notes: req.body.notes,
  });
  await ensureNoDoubleBooking(order);
  // L'équipe est prévenue par email via le bus (worker) : rien n'est perdu si l'envoi échoue
  await recordEvent(EVENTS.orderCreated, { orderId: order._id });
  res.status(201).json(serializeOrder(order));
}

export async function getMyOrders(req, res) {
  const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(100);
  res.json(orders.map((order) => serializeOrder(order)));
}

export async function getAllOrders(req, res) {
  const { page, limit } = req.validated.query;
  const [orders, total] = await Promise.all([
    Order.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(),
  ]);
  res.json({
    orders: (await withOwners(orders)).map((order) => serializeOrder(order, { withUser: true })),
    page,
    totalPages: Math.ceil(total / limit),
    total,
  });
}

// Admin : seules les transitions prévues sont acceptées ; le client est prévenu par email
// (événement écrit avec le statut, envoyé par le worker)
export async function updateOrderStatus(req, res) {
  const order = await changeStatus(req.validated.params.id, req.body.status);
  await audit(req, "order.status_changed", {
    targetType: "order",
    targetId: order._id,
    meta: { status: order.status },
  });
  res.json(serializeOrder(order));
}

// Client : annulation de SA réservation, uniquement tant qu'elle est en attente
export async function cancelMyOrder(req, res) {
  const order = await changeStatus(req.validated.params.id, "annulee", {
    scope: { user: req.user._id },
    from: ["en_attente"],
  });
  res.json(serializeOrder(order));
}

// L'utilisateur est prévenu si l'email n'est pas parti (au lieu d'un faux « envoyé »)
const ensureSent = (sent) => {
  if (!sent) throw httpError(503, "L'email n'a pas pu être envoyé. Réessayez plus tard.");
};

// Seules une confirmation ou un refus ont un email de statut à renvoyer
const RESENDABLE = ["validee", "rejetee"];

export async function resendMyOrderEmail(req, res) {
  const order = await findOwnOrder(req.validated.params.id, req.user._id);
  if (!RESENDABLE.includes(order.status)) {
    throw httpError(409, "Aucun email à renvoyer pour cette réservation");
  }
  ensureSent(await sendOrderStatusEmail(order, req.user.email));
  res.json({ message: "Email renvoyé" });
}

export async function sendPaymentReminder(req, res) {
  const order = await findOrder(req.validated.params.id);
  ensureSent(await sendPaymentReminderEmail(order, await accountEmail(order)));
  res.json({ message: "Rappel envoyé" });
}

export async function sendRentalSummary(req, res) {
  const order = await findOrder(req.validated.params.id);
  ensureSent(await sendRentalSummaryEmail(order, await accountEmail(order)));
  res.json({ message: "Récapitulatif envoyé" });
}
