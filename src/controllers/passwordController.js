import mongoose from "mongoose";
import { setSessionCookies } from "../config/cookies.js";
import { env } from "../config/env.js";
import { isStaff } from "../config/permissions.js";
import { recordEvent } from "../events/outbox.js";
import { EVENTS } from "../events/topology.js";
import { httpError } from "../middlewares/errorMiddleware.js";
import { clearLoginLimits } from "../middlewares/rateLimits.js";
import User from "../models/User.js";
import { audit } from "../services/audit.js";
import { sendPasswordResetCodeEmail } from "../services/email/security.js";
import {
  generateResetCode,
  hashResetCode,
  MAX_RESET_ATTEMPTS,
  matchesResetCode,
} from "../services/resetCode.js";
import { hashToken, issueSession, revokeAllSessions } from "../services/tokens.js";

const GENERIC_FORGOT =
  "Si un compte existe avec cette adresse, un code de réinitialisation vient d'être envoyé.";
const INVALID_CODE = "Code invalide ou expiré. Refaites une demande.";

// Mots de passe de l'équipe seulement (jamais le mot de passe lui-même, bien sûr)
const auditTeamPassword = (req, action, user, via) =>
  isStaff(user)
    ? audit(req, action, { actor: user, targetType: "user", targetId: user._id, meta: { via } })
    : null;

// Changement depuis le profil : toutes les autres sessions sont fermées
export async function changePassword(req, res) {
  const user = await User.findById(req.user._id).select("+password");
  if (!(await user.matchPassword(req.body.currentPassword))) {
    throw httpError(400, "Mot de passe actuel incorrect");
  }
  user.password = req.body.newPassword;
  await user.save();
  await revokeAllSessions(user._id);
  setSessionCookies(res, await issueSession(user));
  // Alerte de sécurité envoyée par le worker (via le bus)
  await recordEvent(EVENTS.passwordChanged, { userId: user._id });
  await auditTeamPassword(req, "password.changed", user, "profile");
  res.json({ message: "Mot de passe modifié" });
}

// Nouveau code : remplace et annule le précédent, compteur d'essais remis à zéro
async function sendResetCode(email) {
  const user = await User.findOne({ email });
  if (!user) return;
  const code = generateResetCode();
  user.resetCodeHash = hashResetCode(email, code);
  user.resetCodeExpires = new Date(Date.now() + env.RESET_CODE_TTL_SECONDS * 1000);
  user.resetAttempts = 0;
  await user.save({ validateModifiedOnly: true });
  await sendPasswordResetCodeEmail(user, code, env.RESET_CODE_TTL_SECONDS);
}

// Réponse identique, et immédiate, que le compte existe ou non : ni le message ni le temps de
// réponse ne révèlent si l'adresse est inscrite. Le code est préparé ensuite, en arrière-plan.
export function forgotPassword(req, res) {
  res.json({ message: GENERIC_FORGOT, expiresIn: env.RESET_CODE_TTL_SECONDS });
  sendResetCode(req.body.email).catch((error) => {
    console.error("[mot de passe oublié]", error.message);
  });
}

// Nouveau mot de passe : compte débloqué, sessions fermées, alerte envoyée par email
// `via` : code « mot de passe oublié » ou lien d'invitation (noté au journal pour l'équipe)
async function applyNewPassword(user, password, req, via) {
  user.password = password;
  user.failedLogins = 0;
  user.lockUntil = undefined;
  user.lastFailedLogin = undefined;
  await user.save();
  await revokeAllSessions(user._id);
  await clearLoginLimits(user.email, req);
  await recordEvent(EVENTS.passwordChanged, { userId: user._id });
  await auditTeamPassword(req, "password.reset", user, via);
}

// Chaque essai est compté AVANT la vérification (de façon atomique) : même des essais lancés
// en parallèle ne dépassent pas 5. Au-delà, ou après expiration, le code ne vaut plus rien.
export async function resetPassword(req, res) {
  const { email, code, password } = req.body;
  // Filtre écrit par le serveur (email déjà validé par Zod) : marqué « de confiance »
  const user = await User.findOneAndUpdate(
    {
      email,
      resetCodeExpires: mongoose.trusted({ $gt: new Date() }),
      resetAttempts: mongoose.trusted({ $lt: MAX_RESET_ATTEMPTS }),
    },
    { $inc: { resetAttempts: 1 } },
    { new: true }
  ).select("+resetCodeHash +resetAttempts");

  if (!user || !matchesResetCode(email, code, user.resetCodeHash)) {
    throw httpError(400, INVALID_CODE);
  }
  // Code utilisé : il ne pourra plus servir
  user.resetCodeHash = undefined;
  user.resetCodeExpires = undefined;
  user.resetAttempts = 0;
  // Le code a été reçu dans la boîte mail : l'adresse est prouvée
  user.emailVerifiedAt ??= new Date();
  await applyNewPassword(user, password, req, "reset_code");
  res.json({ message: "Mot de passe modifié. Vous pouvez vous connecter." });
}

// Invitation : le lien reçu (jeton après #, valable 72 h, usage unique) active le compte
export async function acceptInvitation(req, res) {
  const user = await User.findOne({ inviteHash: hashToken(req.body.token) }).select(
    "+inviteHash +inviteExpires"
  );
  if (!user?.inviteExpires || user.inviteExpires < new Date()) {
    throw httpError(400, "Lien d'invitation invalide ou expiré. Demandez une nouvelle invitation.");
  }
  user.inviteHash = undefined;
  user.inviteExpires = undefined;
  user.passwordSetupRequired = false;
  // Le lien a été reçu dans la boîte mail : l'adresse est prouvée
  user.emailVerifiedAt ??= new Date();
  await applyNewPassword(user, req.body.password, req, "invitation");
  res.json({ message: "Votre compte est activé. Vous pouvez vous connecter." });
}
