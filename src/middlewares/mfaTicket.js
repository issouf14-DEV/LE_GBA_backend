// Routes de la 2e étape de connexion : accessibles uniquement avec le ticket reçu après le bon
// mot de passe, et seulement pour l'étape prévue (activation OU vérification)

import { loadMfaUser } from "../services/mfa.js";
import { readMfaTicket } from "../services/mfaTicket.js";
import { httpError } from "./errorMiddleware.js";

const EXPIRED = "Étape expirée. Reconnectez-vous avec votre mot de passe.";

export const requireMfaTicket = (purpose) => async (req, _res, next) => {
  const ticket = readMfaTicket(req);
  if (!ticket || ticket.purpose !== purpose) throw httpError(401, EXPIRED);
  const user = await loadMfaUser(ticket.sub);
  // Mot de passe changé, compte désactivé ou 2FA réinitialisée depuis : ticket périmé
  const enrolled = Boolean(user?.mfaEnabledAt);
  if (!user || user.disabledAt || ticket.ver !== (user.tokenVersion ?? 0)) {
    throw httpError(401, EXPIRED);
  }
  if (enrolled !== (purpose === "verify")) throw httpError(401, EXPIRED);
  if (user.isLocked()) throw httpError(429, "Trop de tentatives. Réessayez dans 15 minutes.");
  req.user = user;
  return next();
};
