import { randomBytes } from "node:crypto";
import { setSessionCookies } from "../config/cookies.js";
import { httpError } from "../middlewares/errorMiddleware.js";
import { clearLoginLimits } from "../middlewares/rateLimits.js";
import User from "../models/User.js";
import { sendPasswordResetEmail } from "../services/email/index.js";
import { hashToken, issueSession, revokeAllSessions } from "../services/tokens.js";

const RESET_TTL_MS = 30 * 60 * 1000;
const GENERIC_FORGOT =
  "Si un compte existe avec cette adresse, un email de réinitialisation vient d'être envoyé.";

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
  res.json({ message: "Mot de passe modifié" });
}

async function sendResetLink(email) {
  const user = await User.findOne({ email });
  if (!user) return;
  const token = randomBytes(32).toString("base64url");
  user.resetPasswordHash = hashToken(token);
  user.resetPasswordExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save({ validateModifiedOnly: true });
  await sendPasswordResetEmail(user, token);
}

// Réponse identique, et immédiate, que le compte existe ou non : ni le message ni le temps de
// réponse ne révèlent si l'adresse est inscrite. Le lien est préparé ensuite, en arrière-plan.
export function forgotPassword(req, res) {
  res.json({ message: GENERIC_FORGOT });
  sendResetLink(req.body.email).catch((error) => {
    console.error("[mot de passe oublié]", error.message);
  });
}

// Le lien ne sert qu'une fois et expire après 30 minutes
export async function resetPassword(req, res) {
  const user = await User.findOne({ resetPasswordHash: hashToken(req.body.token) }).select(
    "+resetPasswordHash +resetPasswordExpires"
  );
  if (!user?.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
    throw httpError(400, "Lien invalide ou expiré. Refaites une demande.");
  }
  user.password = req.body.password;
  user.resetPasswordHash = undefined;
  user.resetPasswordExpires = undefined;
  user.failedLogins = 0;
  user.lockUntil = undefined;
  user.lastFailedLogin = undefined;
  // Compte invité : le mot de passe est maintenant choisi, le compte est actif
  user.passwordSetupRequired = false;
  await user.save();
  await revokeAllSessions(user._id);
  await clearLoginLimits(user.email, req);
  res.json({ message: "Mot de passe modifié. Vous pouvez vous connecter." });
}
