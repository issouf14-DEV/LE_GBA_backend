// Champs du modèle User pour la vérification de l'email et la double authentification.
// Les secrets ne sont jamais renvoyés par défaut (select: false).
export const verificationFields = {
  // Adresse prouvée (code reçu par email, invitation acceptée ou code de réinitialisation)
  emailVerifiedAt: { type: Date },
  emailCodeHash: { type: String, select: false },
  emailCodeExpires: { type: Date, select: false },
  emailCodeAttempts: { type: Number, default: 0, select: false },
  // 2FA de l'équipe : secret chiffré (AES-256-GCM), dernier pas de temps utilisé (anti-rejeu),
  // empreintes des codes de secours, échecs consécutifs
  mfaEnabledAt: { type: Date },
  mfaSecret: { type: String, select: false },
  mfaPendingSecret: { type: String, select: false },
  mfaLastStep: { type: Number, default: -1, select: false },
  mfaBackupHashes: { type: [String], default: undefined, select: false },
  mfaFailures: { type: Number, default: 0, select: false },
};
