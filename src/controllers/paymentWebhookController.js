// Appels de CinetPay (serveur à serveur, ou navigateur du client renvoyé par CinetPay) : ils
// n'ont pas l'en-tête anti-CSRF du site, et ne modifient rien sans vérification auprès de l'API
import { env, publicSiteUrl } from "../config/env.js";
import Payment from "../models/Payment.js";
import { returnQuery, transactionIdSchema } from "../schemas/payment.js";
import { isValidNotifyToken } from "../services/payments/cinetpayToken.js";
import { refreshPayment } from "../services/payments/settle.js";

const ok = (res) => res.status(200).json({ message: "OK" });

// Notification de paiement : jeton x-token vérifié, puis état confirmé par l'API payment/check
export async function cinetpayNotify(req, res) {
  if (env.PAYMENT_PROVIDER !== "cinetpay") {
    return res.status(404).json({ message: "Ressource introuvable" });
  }
  const fields = req.body && typeof req.body === "object" ? req.body : {};
  if (!isValidNotifyToken(fields, req.get("x-token"), env.CINETPAY_SECRET_KEY)) {
    return res.status(401).json({ message: "Signature invalide" });
  }
  if (String(fields.cpm_site_id) !== env.CINETPAY_SITE_ID) {
    return res.status(401).json({ message: "Signature invalide" });
  }
  // Transaction inconnue : rien à faire, réponse 200 (sinon CinetPay renverrait sans fin)
  const transactionId = transactionIdSchema.safeParse(fields.cpm_trans_id);
  if (!transactionId.success) return ok(res);
  const payment = await Payment.findOne({
    transactionId: transactionId.data,
    provider: "cinetpay",
  });
  if (!payment) return ok(res);
  try {
    // Notification reçue plusieurs fois : un paiement déjà accepté ou refusé n'est plus modifié
    await refreshPayment(payment, { force: true, strict: true });
  } catch {
    // API de vérification injoignable : CinetPay renverra la notification plus tard
    return res.status(503).json({ message: "Vérification impossible, réessayez" });
  }
  return ok(res);
}

// Test de disponibilité de l'adresse de notification
export const cinetpayNotifyPing = (_req, res) => ok(res);

// Retour du client après paiement (GET ou POST selon CinetPay) : simple redirection vers la page
// du site, qui lit l'état réel sur le serveur. Aucun paramètre reçu n'est cru.
export function cinetpayReturn(req, res) {
  const { order } = returnQuery.parse(req.query ?? {});
  res.redirect(303, `${publicSiteUrl}/payment/return${order ? `?order=${order}` : ""}`);
}
