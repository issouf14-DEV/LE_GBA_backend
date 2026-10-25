import mongoose from "mongoose";
import {
  effectivePermissions,
  normalizePermissions,
  normalizeRole,
  PERMISSION_KEYS,
  ROLES,
} from "../config/permissions.js";
import { applySecurityMethods, BCRYPT_COST } from "./userSecurity.js";

export { BCRYPT_COST };

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    firstName: { type: String, trim: true, maxlength: 50, default: "" },
    lastName: { type: String, trim: true, maxlength: 50, default: "" },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: { type: String, trim: true, maxlength: 20, default: "" },
    address: { type: String, trim: true, maxlength: 200, default: "" },
    // Jamais renvoyés par défaut dans les requêtes (select: false)
    password: { type: String, required: true, select: false },
    // « admin » et « user » : anciennes valeurs tolérées jusqu'à la migration (retrait prévu)
    role: { type: String, enum: [...ROLES, "admin", "user"], default: "client" },
    // Permissions accordées une par une par le superadmin (gestionnaires uniquement)
    permissions: { type: [{ type: String, enum: PERMISSION_KEYS }], default: [] },
    // Compte désactivé : plus aucune connexion ni session possible
    disabledAt: { type: Date },
    // Compte invité : le mot de passe doit encore être choisi via le lien reçu par email
    passwordSetupRequired: { type: Boolean, default: false },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // Date du dernier changement de mot de passe (information pour l'administration)
    passwordChangedAt: { type: Date, select: false },
    // Incrémenté à chaque changement de mot de passe : tous les jetons d'accès émis avant
    // portent l'ancien numéro et sont refusés immédiatement
    tokenVersion: { type: Number, default: 0 },
    resetPasswordHash: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    failedLogins: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, select: false },
    lastFailedLogin: { type: Date, select: false },
  },
  { timestamps: true }
);

// Seuls les gestionnaires portent des permissions individuelles ; elles sont toujours
// normalisées (inconnues retirées, permissions impliquées ajoutées)
userSchema.pre("validate", function cleanPermissions() {
  if (!this.isModified("permissions") && !this.isModified("role")) return;
  this.permissions =
    normalizeRole(this.role) === "gestionnaire" ? normalizePermissions(this.permissions) : [];
});

applySecurityMethods(userSchema);

// Seuls ces champs quittent le serveur
userSchema.methods.toPublic = function toPublic() {
  return {
    _id: this._id,
    id: this._id,
    name: this.name,
    firstName: this.firstName,
    lastName: this.lastName,
    email: this.email,
    phone: this.phone,
    address: this.address,
    role: normalizeRole(this.role),
    permissions: effectivePermissions(this),
    disabled: Boolean(this.disabledAt),
    createdAt: this.createdAt,
  };
};

export default mongoose.models.User || mongoose.model("User", userSchema);
