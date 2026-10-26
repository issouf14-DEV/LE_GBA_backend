import mongoose from "mongoose";

// Boîte d'envoi des événements métier (outbox) : écrite par l'API dans la même transaction que
// l'action, puis publiée sur le bus par le relais du worker. Ne contient que des identifiants.
const outboxEventSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["pending", "published"], default: "pending" },
    // Nombre de réclamations par un relais (tentatives de publication)
    attempts: { type: Number, default: 0 },
    // Bail du relais qui publie l'événement : passé ce délai, un autre relais peut le reprendre
    lockedUntil: { type: Date },
    publishedAt: { type: Date },
    lastError: { type: String, maxlength: 500 },
  },
  { timestamps: true }
);

// Réclamation par le relais : les plus anciens événements en attente d'abord
outboxEventSchema.index({ status: 1, lockedUntil: 1, createdAt: 1 });
// Purge automatique des événements publiés au bout de 7 jours
outboxEventSchema.index({ publishedAt: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

export default mongoose.models.OutboxEvent || mongoose.model("OutboxEvent", outboxEventSchema);
