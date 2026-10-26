import mongoose from "mongoose";
import { env } from "../config/env.js";

export const NOTIFICATION_KINDS = ["order.created", "order.status", "security"];

// Notification affichée dans l'application (cloche). Textes courts écrits par le serveur, lien
// vers une page interne du site ; créée par le consommateur « inapp » à partir des événements
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    kind: { type: String, enum: NOTIFICATION_KINDS, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: "", maxlength: 300 },
    // Chemin interne uniquement (/admin/orders…), jamais une adresse externe
    link: { type: String, default: "", maxlength: 200, match: /^(\/(?!\/)[^\s\\]*)?$/ },
    readAt: { type: Date, default: null },
    // Événement d'origine : une livraison en double ne crée pas deux notifications
    eventId: { type: String, required: true, maxlength: 64 },
  },
  { timestamps: true }
);

notificationSchema.index({ eventId: 1, user: 1 }, { unique: true });
// Liste de la cloche : les plus récentes d'abord, et nombre de non lues
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });
// Purge automatique au-delà de NOTIFICATION_TTL_DAYS jours
notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: env.NOTIFICATION_TTL_DAYS * 24 * 3600 }
);

// Seuls ces champs quittent le serveur (document Mongoose, objet lean ou document de change stream)
export const publicNotification = (doc) => ({
  id: String(doc._id),
  kind: doc.kind,
  title: doc.title,
  body: doc.body ?? "",
  link: doc.link ?? "",
  readAt: doc.readAt ?? null,
  createdAt: doc.createdAt,
});

export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
