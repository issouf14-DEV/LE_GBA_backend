// Réponses envoyées au navigateur : jamais le document brut (ni l'URL d'une tentative close)
const reference = (orderId) => String(orderId).slice(-8).toUpperCase();

export function serializePayment(payment) {
  if (!payment) return null;
  return {
    _id: payment._id,
    status: payment.status,
    amount: payment.amount,
    currency: payment.currency,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    ...(payment.status === "pending" && payment.paymentUrl
      ? { paymentUrl: payment.paymentUrl }
      : {}),
  };
}

// Liste de l'équipe : nom du client, référence de la réservation, moyen de paiement
export function serializeStaffPayment(payment, owner) {
  return {
    ...serializePayment(payment),
    paymentUrl: undefined,
    provider: payment.provider,
    transactionId: payment.transactionId,
    paymentMethod: payment.raw?.paymentMethod,
    anomaly: payment.raw?.anomaly,
    order: { _id: payment.order, reference: reference(payment.order) },
    user: owner ? { _id: owner._id, name: owner.name } : null,
  };
}
