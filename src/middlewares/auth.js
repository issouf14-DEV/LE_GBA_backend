import { ACCESS_COOKIE } from "../config/cookies.js";
import { hasPermissions, isSuperadmin, normalizeRole } from "../config/permissions.js";
import User from "../models/User.js";
import { requiresMfa } from "../services/mfa.js";
import { isSessionActive, verifyAccessToken } from "../services/tokens.js";

const unauthorized = (res) => res.status(401).json({ message: "Authentification requise" });
const forbidden = (res, message = "Vous n'avez pas les droits nécessaires") =>
  res.status(403).json({ message });

// Session portée uniquement par le cookie httpOnly (aucun en-tête Authorization accepté)
export async function protect(req, res, next) {
  const token = req.cookies?.[ACCESS_COOKIE];
  if (typeof token !== "string" || token.length > 2000) return unauthorized(res);

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return unauthorized(res);
  }

  const [user, active] = await Promise.all([
    User.findById(payload.sub),
    isSessionActive(payload.sid),
  ]);
  // Compte supprimé ou désactivé, session fermée (déconnexion, vol détecté), ou jeton émis
  // avant un changement de mot de passe : refusé
  if (!user || user.disabledAt || !active || payload.ver !== (user.tokenVersion ?? 0)) {
    return unauthorized(res);
  }
  // Membre de l'équipe sans 2FA (session ouverte avant son activation) : reconnexion exigée
  if (requiresMfa(user) && !user.mfaEnabledAt) return unauthorized(res);

  req.user = user;
  req.auth = { sid: payload.sid, exp: payload.exp };
  return next();
}

// Le compte est relu en base à chaque requête : une permission retirée par le superadmin
// prend effet immédiatement, sans attendre une nouvelle connexion
export const authorize =
  (...permissions) =>
  (req, res, next) =>
    hasPermissions(req.user, permissions) ? next() : forbidden(res);

// Gestion de l'équipe : réservée au superadmin (non délégable à un gestionnaire)
export function superadminOnly(req, res, next) {
  return isSuperadmin(req.user) ? next() : forbidden(res, "Accès réservé au super-administrateur");
}

// Réserver exige une adresse email confirmée (code reçu par email)
export const requireVerifiedEmail = (req, res, next) =>
  req.user?.emailVerifiedAt
    ? next()
    : forbidden(res, "Confirmez votre adresse email (code reçu par email) avant de réserver.");

// Fonctions de client (réserver) : les comptes de l'équipe n'en ont pas l'usage
export const requireRole = (role) => (req, res, next) =>
  normalizeRole(req.user?.role) === role ? next() : forbidden(res);
