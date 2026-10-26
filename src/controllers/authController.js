import bcrypt from "bcryptjs";
import { clearSessionCookies, REFRESH_COOKIE, setSessionCookies } from "../config/cookies.js";
import { isStaff } from "../config/permissions.js";
import { httpError } from "../middlewares/errorMiddleware.js";
import User, { BCRYPT_COST } from "../models/User.js";
import { isCompromisedPassword } from "../schemas/common.js";
import { audit } from "../services/audit.js";
import { sendVerificationCode } from "../services/emailVerification.js";
import { requiresMfa } from "../services/mfa.js";
import { setMfaTicket } from "../services/mfaTicket.js";
import {
  issueSession,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
} from "../services/tokens.js";

// Hash factice : la vérification dure aussi longtemps qu'un compte existe ou non
// (on ne peut pas deviner les emails inscrits en mesurant le temps de réponse)
const DUMMY_HASH = bcrypt.hashSync("compte-inexistant", 12);
const INVALID_LOGIN = "Email ou mot de passe incorrect";
const TOO_MANY = "Trop de tentatives. Réessayez dans 15 minutes.";

// Échec de connexion d'un membre de l'équipe (celles des clients seraient trop nombreuses).
// Non attendu : le temps de réponse ne révèle pas qu'une adresse appartient à l'équipe
function auditTeamFailure(req, user, reason) {
  if (!isStaff(user)) return;
  void audit(req, "auth.login_failed", {
    actor: user,
    targetType: "user",
    targetId: user._id,
    meta: { reason },
  });
}

// `extra` : données montrées une seule fois avec le profil (codes de secours à l'activation 2FA)
export async function startSession(res, user, status = 200, extra = {}) {
  setSessionCookies(res, await issueSession(user));
  res.status(status).json({ ...user.toPublic(), ...extra });
}

export async function register(req, res) {
  if (await User.exists({ email: req.body.email })) {
    throw httpError(409, "Un compte existe déjà avec cet email");
  }
  const user = await User.create({ ...req.body, role: "client" });
  // Email de bienvenue avec le code qui confirme l'adresse (exigé avant de réserver)
  await sendVerificationCode(user);
  await startSession(res, user, 201);
}

export async function login(req, res) {
  const user = await User.findOne({ email: req.body.email }).select(
    "+password +failedLogins +lockUntil +lastFailedLogin"
  );
  if (!user) {
    await bcrypt.compare(req.body.password, DUMMY_HASH);
    throw httpError(401, INVALID_LOGIN);
  }
  // Compte verrouillé : même message et même durée de calcul qu'une limite atteinte
  if (user.isLocked()) {
    await bcrypt.compare(req.body.password, DUMMY_HASH);
    auditTeamFailure(req, user, "locked");
    throw httpError(429, TOO_MANY);
  }

  if (!(await user.matchPassword(req.body.password))) {
    await user.registerFailedLogin();
    auditTeamFailure(req, user, "password");
    throw httpError(401, INVALID_LOGIN);
  }
  await user.clearFailedLogins();
  // Ancien mot de passe chiffré avec un coût plus faible (ancienne version) : re-chiffré
  if (bcrypt.getRounds(user.password) < BCRYPT_COST) {
    const stronger = await bcrypt.hash(req.body.password, BCRYPT_COST);
    await User.updateOne({ _id: user._id }, { password: stronger });
  }
  // Compte désactivé par l'équipe : annoncé seulement à qui connaît le bon mot de passe
  if (user.disabledAt) {
    auditTeamFailure(req, user, "disabled");
    throw httpError(403, "Ce compte est désactivé. Contactez LE-GBA.");
  }
  // Mot de passe connu des pirates : pas de session, l'utilisateur doit le réinitialiser
  if (isCompromisedPassword(req.body.password)) {
    auditTeamFailure(req, user, "compromised_password");
    throw httpError(
      403,
      "Ce mot de passe n'est plus sûr. Utilisez « Mot de passe oublié » pour en choisir un nouveau."
    );
  }
  // Équipe : pas encore de session, seulement un ticket pour la 2e étape (code de l'application)
  if (requiresMfa(user)) {
    const step = user.mfaEnabledAt ? "verify" : "enroll";
    setMfaTicket(res, user, step);
    return res.json({ mfa: step });
  }
  await startSession(res, user);
}

export async function logout(req, res) {
  await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  clearSessionCookies(res);
  res.status(204).end();
}

// Renouvelle le jeton d'accès (15 min) grâce au jeton de renouvellement (usage unique)
export async function refresh(req, res) {
  const rotated = await rotateRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  const user = rotated && (await User.findById(rotated.userId));
  if (!user || user.disabledAt) {
    clearSessionCookies(res);
    throw httpError(401, "Session expirée");
  }
  // Renouvellement déjà fait à l'instant par un autre onglet : ses cookies sont déjà en place
  if (rotated.concurrent) return res.status(204).end();
  setSessionCookies(res, {
    accessToken: signAccessToken(user, rotated.family),
    refreshToken: rotated.refreshToken,
  });
  res.status(204).end();
}

export function getProfile(req, res) {
  res.json(req.user.toPublic());
}

export async function updateProfile(req, res) {
  Object.assign(req.user, req.body);
  await req.user.save();
  res.json(req.user.toPublic());
}
