import Order from "../models/Order.js";
import {
  sendNewOrderToAdmin,
  sendOrderStatusEmail,
  sendPaymentReminderEmail,
  sendRentalSummaryEmail,
} from "../services/email/index.js";
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
  sendNewOrderToAdmin(order);
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
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Order.countDocuments(),
  ]);
  res.json({
    orders: orders.map((order) => serializeOrder(order, { withUser: true })),
    page,
    totalPages: Math.ceil(total / limit),
    total,
  });
}

// Admin : seules les transitions prévues sont acceptées ; le client est prévenu par email
export async function updateOrderStatus(req, res) {
  const order = await changeStatus(req.validated.params.id, req.body.status);
  sendOrderStatusEmail(order, await accountEmail(order));
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

export async function resendMyOrderEmail(req, res) {
  const order = await findOwnOrder(req.validated.params.id, req.user._id);
  await sendOrderStatusEmail(order, req.user.email);
  res.json({ message: "Email renvoyé" });
}

export async function sendPaymentReminder(req, res) {
  const order = await findOrder(req.validated.params.id);
  await sendPaymentReminderEmail(order, await accountEmail(order));
  res.json({ message: "Rappel envoyé" });
}

export async function sendRentalSummary(req, res) {
  const order = await findOrder(req.validated.params.id);
  await sendRentalSummaryEmail(order, await accountEmail(order));
  res.json({ message: "Récapitulatif envoyé" });
}
