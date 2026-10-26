// Paiement en ligne d'un acompte (Mobile Money via CinetPay). Le montant est toujours calculé
// par le serveur ; seuls des champs utiles du fournisseur sont gardés (aucun numéro complet)
import mongoose from "mongoose";

export const PAYMENT_STATUSES = ["pending", "accepted", "refused", "cancelled"];

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["fake", "cinetpay"], required: true },
    // Identifiant aléatoire non devinable, transmis au fournisseur (transaction_id)
    transactionId: { type: String, required: true, unique: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ["XOF"], default: "XOF" },
    status: { type: String, enum: PAYMENT_STATUSES, default: "pending", index: true },
    // Adresse de la page de paiement du fournisseur (réutilisée si le client reclique)
    paymentUrl: { type: String, maxlength: 500 },
    providerRef: { type: String, maxlength: 100 },
    paidAt: Date,
    // Dernière vérification auprès du fournisseur (évite de l'interroger à chaque affichage)
    checkedAt: Date,
    raw: {
      paymentMethod: { type: String, maxlength: 40 },
      providerStatus: { type: String, maxlength: 60 },
      anomaly: { type: String, maxlength: 60 },
    },
  },
  { timestamps: true }
);

// Une seule tentative en cours par réservation (deux clics simultanés : le second échoue)
paymentSchema.index(
  { order: 1 },
  { unique: true, partialFilterExpression: { status: "pending" }, name: "one_pending_per_order" }
);
paymentSchema.index({ createdAt: -1 });

export default mongoose.models.Payment || mongoose.model("Payment", paymentSchema);
