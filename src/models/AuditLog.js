// Journal d'audit : qui a fait quoi, quand, sur quoi. Écrit uniquement par src/services/audit.js.
// Le journal n'est JAMAIS modifié ni supprimé par l'application : seule la purge automatique de
// MongoDB (index TTL, AUDIT_RETENTION_DAYS) retire les entrées trop anciennes.
import mongoose from "mongoose";
import { env } from "../config/env.js";

// Liste fermée des actions tracées (libellés français côté frontend)
export const AUDIT_ACTIONS = [
  "auth.login_succeeded",
  "auth.login_failed",
  "mfa.enabled",
  "mfa.failed",
  "mfa.reset",
  "password.changed",
  "password.reset",
  "manager.invited",
  "manager.permissions_changed",
  "account.disabled",
  "account.enabled",
  "account.deleted",
  "client.invited",
  "order.status_changed",
  "vehicle.created",
  "vehicle.updated",
  "vehicle.deleted",
  "photo.added",
  "photo.deleted",
];

export const AUDIT_TARGET_TYPES = ["user", "order", "vehicle"];

const fixed = { immutable: true };

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", ...fixed },
    actorRole: { type: String, maxlength: 20, ...fixed },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, ...fixed },
    targetType: { type: String, enum: AUDIT_TARGET_TYPES, ...fixed },
    targetId: { type: mongoose.Schema.Types.ObjectId, ...fixed },
    // Identifiants et valeurs courtes uniquement (nettoyé par le service : aucun secret)
    meta: { type: mongoose.Schema.Types.Mixed, default: {}, ...fixed },
    // Adresse tronquée (IPv4 sans le dernier octet, IPv6 /48) : limite les données personnelles
    ip: { type: String, maxlength: 64, ...fixed },
    userAgent: { type: String, maxlength: 120, ...fixed },
  },
  { timestamps: { createdAt: true, updatedAt: false }, minimize: false }
);

// Filtres de la page « Journal d'audit » (toujours triés du plus récent au plus ancien)
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });
// Purge automatique : seul moyen de retirer une entrée
auditLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: env.AUDIT_RETENTION_DAYS * 24 * 3600 }
);

const READ_ONLY = "Le journal d'audit ne peut être ni modifié ni supprimé";
function refuse() {
  throw new Error(READ_ONLY);
}

// Toute modification ou suppression passant par Mongoose est refusée
const WRITES = [
  "updateOne",
  "updateMany",
  "replaceOne",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
  "deleteOne",
  "deleteMany",
];
auditLogSchema.pre(WRITES, { document: true, query: true }, refuse);
auditLogSchema.pre("bulkWrite", refuse);
// Une entrée existante ne peut pas être réenregistrée (seule la création est permise)
auditLogSchema.pre("save", function onlyCreate() {
  if (!this.isNew) refuse();
});

export default mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
