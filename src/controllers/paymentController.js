import { env } from "../config/env.js";
import Payment from "../models/Payment.js";
import { withOwners } from "../services/orderOwners.js";
import { findOwnOrder } from "../services/orders.js";
import { depositAmount } from "../services/payments/amount.js";
import { activeProvider, paymentEnabled } from "../services/payments/providers.js";
import { serializePayment, serializeStaffPayment } from "../services/payments/serialize.js";
import { refreshPayment } from "../services/payments/settle.js";
import { startPayment } from "../services/payments/start.js";

// Public : le site affiche le bouton de paiement seulement si le paiement est activé
export function getPaymentConfig(_req, res) {
  const enabled = paymentEnabled();
  res.json({ enabled, depositPercent: enabled ? env.PAYMENT_DEPOSIT_PERCENT : 0 });
}

// Client : crée (ou reprend) la tentative et renvoie l'adresse de la page de paiement
export async function createOrderPayment(req, res) {
  const payment = await startPayment(req.user, req.validated.params.id);
  res.status(201).json({ paymentUrl: payment.paymentUrl, payment: serializePayment(payment) });
}

// Client propriétaire : état réel, vérifié auprès du fournisseur si une tentative est en cours
export async function getOrderPayment(req, res) {
  activeProvider();
  const order = await findOwnOrder(req.validated.params.id, req.user._id);
  const latest = await Payment.findOne({ order: order._id }).sort({ createdAt: -1 });
  const payment = await refreshPayment(latest);
  const paid = await Payment.exists({ order: order._id, status: "accepted" });
  res.json({
    orderId: order._id,
    paymentStatus: paid ? "deposit_paid" : order.paymentStatus,
    depositAmount: depositAmount(order.totalPrice),
    payment: serializePayment(payment),
  });
}

// Équipe (payments.read) : liste paginée, la plus récente d'abord
export async function listPayments(req, res) {
  const { page, limit, status } = req.validated.query;
  const filter = status ? { status } : {};
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Payment.countDocuments(filter),
  ]);
  const owners = await withOwners(payments);
  res.json({
    payments: payments.map((payment, index) => serializeStaffPayment(payment, owners[index].user)),
    page,
    totalPages: Math.ceil(total / limit),
    total,
  });
}
