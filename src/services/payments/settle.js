// Mise à jour d'un paiement d'après l'état CONFIRMÉ par le fournisseur (jamais d'après une
// notification ou des paramètres d'URL seuls). Traitement idempotent : chaque passage à
// « accepté » n'a lieu qu'une fois, avec l'acompte de la réservation et l'événement associé.
import mongoose from "mongoose";
import { recordEvent } from "../../events/outbox.js";
import { EVENTS } from "../../events/topology.js";
import Order from "../../models/Order.js";
import Payment from "../../models/Payment.js";
import { providerFor } from "./providers.js";

// Délai minimal entre deux vérifications déclenchées par l'affichage de la page
const RECHECK_MS = 10_000;

async function accept(payment, result) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Une tentative remplacée (« cancelled ») mais finalement payée est aussi enregistrée
      const updated = await Payment.findOneAndUpdate(
        { _id: payment._id, status: mongoose.trusted({ $in: ["pending", "cancelled"] }) },
        {
          $set: {
            status: "accepted",
            paidAt: new Date(),
            checkedAt: new Date(),
            ...(result.providerRef ? { providerRef: result.providerRef } : {}),
            "raw.paymentMethod": result.paymentMethod,
            "raw.providerStatus": result.providerStatus,
          },
        },
        { new: true, session }
      );
      if (!updated) return;
      const order = await Order.findOneAndUpdate(
        { _id: payment.order, paymentStatus: "none" },
        { $set: { paymentStatus: "deposit_paid" } },
        { new: true, session }
      );
      // Acompte déjà réglé par une autre tentative : paiement en double, à rembourser
      if (!order) {
        await Payment.updateOne({ _id: payment._id }, { "raw.anomaly": "duplicate" }, { session });
      }
      await recordEvent(
        EVENTS.paymentAccepted,
        { orderId: payment.order, paymentId: payment._id },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }
}

export async function settle(payment, result) {
  const status = result.status;
  const amountOk = result.amount === payment.amount && result.currency === payment.currency;
  if (status === "accepted" && !amountOk) {
    // Montant confirmé différent du montant attendu : jamais considéré comme payé
    console.warn(`Paiement ${payment._id} : montant confirmé différent du montant attendu`);
    await Payment.updateOne(
      { _id: payment._id, status: "pending" },
      { status: "refused", checkedAt: new Date(), "raw.anomaly": "amount_mismatch" }
    );
  } else if (status === "accepted") {
    await accept(payment, result);
  } else {
    const set = { checkedAt: new Date(), "raw.providerStatus": result.providerStatus };
    if (status !== "pending") set.status = status;
    await Payment.updateOne({ _id: payment._id, status: "pending" }, { $set: set });
  }
  return Payment.findById(payment._id);
}

// `force` : notification du fournisseur ou nouvelle tentative du client (vérification immédiate,
// y compris d'une tentative remplacée). Erreur du fournisseur : propagée si `strict`.
export async function refreshPayment(payment, { force = false, strict = false } = {}) {
  const checkable = force ? ["pending", "cancelled"] : ["pending"];
  const provider = providerFor(payment?.provider);
  if (!payment || !provider || !checkable.includes(payment.status)) return payment;
  if (!force && payment.checkedAt && Date.now() - payment.checkedAt.getTime() < RECHECK_MS) {
    return payment;
  }
  try {
    return await settle(payment, await provider.check(payment));
  } catch (error) {
    if (strict) throw error;
    return payment;
  }
}
