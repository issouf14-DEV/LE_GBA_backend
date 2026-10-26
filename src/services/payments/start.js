// Nouvelle tentative de paiement de l'acompte d'une réservation, par son client
import { randomBytes } from "node:crypto";
import { httpError } from "../../middlewares/errorMiddleware.js";
import Payment from "../../models/Payment.js";
import { findOwnOrder } from "../orders.js";
import { depositAmount, MIN_DEPOSIT } from "./amount.js";
import { activeProvider } from "./providers.js";
import { refreshPayment } from "./settle.js";

// Tentative en cours réutilisée pendant 30 minutes (même page de paiement), puis remplacée
const REUSE_MS = 30 * 60 * 1000;

// 96 bits aléatoires, lettres et chiffres seulement (format accepté par CinetPay)
export const newTransactionId = () => `GBA${randomBytes(12).toString("hex").toUpperCase()}`;

const alreadyPaid = () => httpError(409, "L'acompte de cette réservation est déjà payé.");

// Réservation confirmée seulement : une demande en attente peut encore être refusée par
// l'équipe, et l'acompte devrait alors être remboursé
export function ensurePayable(order) {
  if (order.paymentStatus === "deposit_paid") throw alreadyPaid();
  if (order.status !== "validee") {
    throw httpError(409, "L'acompte se paie une fois la réservation confirmée par l'équipe.");
  }
  const amount = depositAmount(order.totalPrice);
  if (amount < MIN_DEPOSIT) throw httpError(409, "Montant trop faible pour un paiement en ligne.");
  return amount;
}

// Tentative déjà en cours : vérifiée auprès du fournisseur, réutilisée si récente
async function reusable(order, amount) {
  const pending = await Payment.findOne({ order: order._id, status: "pending" });
  if (!pending) return null;
  const fresh = await refreshPayment(pending, { force: true });
  if (fresh.status === "accepted") throw alreadyPaid();
  if (fresh.status !== "pending") return null;
  const recent = Date.now() - fresh.createdAt.getTime() < REUSE_MS;
  if (recent && fresh.amount === amount && fresh.paymentUrl) return fresh;
  await Payment.updateOne({ _id: fresh._id, status: "pending" }, { status: "cancelled" });
  return null;
}

export async function startPayment(user, orderId) {
  const provider = activeProvider();
  const order = await findOwnOrder(orderId, user._id);
  const amount = ensurePayable(order);
  const existing = await reusable(order, amount);
  if (existing) return existing;

  let payment;
  try {
    payment = await Payment.create({
      order: order._id,
      user: user._id,
      provider: provider.name,
      transactionId: newTransactionId(),
      amount,
    });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, "Un paiement est déjà en cours. Réessayez.");
    throw error;
  }

  try {
    const { paymentUrl, providerRef } = await provider.initialize({ payment, order });
    payment.paymentUrl = paymentUrl;
    if (providerRef) payment.providerRef = providerRef;
    return await payment.save();
  } catch (error) {
    // Page de paiement non obtenue : la tentative est abandonnée, le client peut réessayer
    await Payment.updateOne({ _id: payment._id }, { status: "cancelled" });
    throw error;
  }
}
