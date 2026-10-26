// Double authentification de l'équipe : activation (QR code), vérification à la connexion,
// réinitialisation par le superadmin. Le secret est chiffré en base (voir secretBox.js).
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { normalizeRole } from "../config/permissions.js";
import User from "../models/User.js";
import { consumeBackupCode, generateBackupCodes, isBackupCode } from "./backupCodes.js";
import { seal, unseal } from "./secretBox.js";
import { revokeAllSessions } from "./tokens.js";
import { generateTotpSecret, otpauthUrl, toBase32, verifyTotp } from "./totp.js";

// 5 codes faux d'affilée : compte verrouillé 15 minutes (le mot de passe était déjà bon :
// c'est peut-être un pirate qui le connaît et tente de deviner le code)
const MAX_MFA_FAILURES = 5;
const LOCK_MS = 15 * 60 * 1000;
const context = (userId) => `mfa:${userId}`;
const MFA_FIELDS = "+mfaSecret +mfaPendingSecret +mfaLastStep +mfaFailures +lockUntil";

// Double authentification obligatoire pour toute l'équipe (gestionnaires et superadmin)
export const requiresMfa = (user) => normalizeRole(user?.role) !== "client";

export const loadMfaUser = (userId) => User.findById(userId).select(MFA_FIELDS);

// Étape 1 de l'activation : nouveau secret, gardé « en attente » tant qu'aucun code ne l'a confirmé
export async function startEnrollment(user) {
  const secret = generateTotpSecret();
  await User.updateOne({ _id: user._id }, { mfaPendingSecret: seal(secret, context(user._id)) });
  const issuer = env.MFA_ISSUER;
  return {
    secret: toBase32(secret),
    otpauthUrl: otpauthUrl({ issuer, account: user.email, secret }),
  };
}

// Étape 2 : le premier code prouve que le téléphone est bien configuré. Renvoie les codes de
// secours (affichés une seule fois) ou null si le code est faux.
export async function completeEnrollment(user, code) {
  const secret = unseal(user.mfaPendingSecret, context(user._id));
  const step = secret ? verifyTotp(secret, code) : null;
  if (step === null) return null;
  const { codes, hashes } = generateBackupCodes(user._id);
  await User.updateOne(
    { _id: user._id },
    {
      mfaSecret: user.mfaPendingSecret,
      mfaEnabledAt: new Date(),
      mfaLastStep: step,
      mfaBackupHashes: hashes,
      mfaFailures: 0,
      $unset: { mfaPendingSecret: "" },
    }
  );
  return codes;
}

// Code de l'application. Le pas de temps utilisé est enregistré de façon atomique : le même
// code présenté deux fois (même en parallèle) n'est accepté qu'une fois.
export async function verifyAppCode(user, code) {
  if (!user?.mfaEnabledAt) return false;
  const secret = unseal(user.mfaSecret, context(user._id));
  const step = secret ? verifyTotp(secret, code, user.mfaLastStep ?? -1) : null;
  if (step === null) return false;
  const claimed = await User.updateOne(
    { _id: user._id, mfaLastStep: mongoose.trusted({ $lt: step }) },
    { mfaLastStep: step }
  );
  return claimed.modifiedCount === 1;
}

export async function registerMfaFailure(userId) {
  const user = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { mfaFailures: 1 } },
    { new: true }
  ).select("+mfaFailures");
  if (user && user.mfaFailures >= MAX_MFA_FAILURES) {
    await User.updateOne(
      { _id: userId },
      { lockUntil: new Date(Date.now() + LOCK_MS), mfaFailures: 0 }
    );
  }
}

export const clearMfaFailures = (userId) => User.updateOne({ _id: userId }, { mfaFailures: 0 });

// Nouveaux codes de secours (les anciens ne valent plus rien)
export async function renewBackupCodes(userId) {
  const { codes, hashes } = generateBackupCodes(userId);
  await User.updateOne({ _id: userId }, { mfaBackupHashes: hashes });
  return codes;
}

// Téléphone perdu : le superadmin efface la 2FA d'un gestionnaire. Toutes ses sessions sont
// fermées ; à sa prochaine connexion, il devra configurer un nouveau téléphone.
export async function resetMfa(userId) {
  await User.updateOne(
    { _id: userId },
    {
      $unset: { mfaSecret: "", mfaPendingSecret: "", mfaEnabledAt: "", mfaBackupHashes: "" },
      mfaLastStep: -1,
      mfaFailures: 0,
      $inc: { tokenVersion: 1 },
    }
  );
  await revokeAllSessions(userId);
}

// Connexion : code de l'application ou, téléphone perdu, un code de secours
export const verifySecondFactor = (user, code) =>
  isBackupCode(code) ? consumeBackupCode(user._id, code) : verifyAppCode(user, code);
