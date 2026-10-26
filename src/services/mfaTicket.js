// Connexion en deux étapes : après le bon mot de passe, un membre de l'équipe reçoit seulement
// un ticket de 5 minutes (cookie httpOnly limité aux routes /api/auth/mfa). Il ne donne accès
// à rien d'autre que la saisie du code 2FA ou, au premier passage, à son activation.
import jwt from "jsonwebtoken";
import { env, isProduction } from "../config/env.js";

const TICKET_TTL_SECONDS = 5 * 60;
export const MFA_COOKIE = `${isProduction ? "__Secure-" : ""}gba_mfa`;
// Audience distincte de celle des jetons d'accès : un ticket n'est jamais accepté comme session
const JWT_OPTIONS = { algorithm: "HS256", issuer: "le-gba", audience: "le-gba-mfa" };
const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "strict",
  path: "/api/auth/mfa",
};

// purpose : « verify » (2FA déjà active) ou « enroll » (2FA à activer avant tout accès)
export function setMfaTicket(res, user, purpose) {
  const payload = { sub: String(user._id), ver: user.tokenVersion ?? 0, purpose };
  const ticket = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...JWT_OPTIONS,
    expiresIn: TICKET_TTL_SECONDS,
  });
  res.cookie(MFA_COOKIE, ticket, { ...cookieOptions, maxAge: TICKET_TTL_SECONDS * 1000 });
}

export const clearMfaTicket = (res) => res.clearCookie(MFA_COOKIE, cookieOptions);

// Renvoie { sub, ver, purpose } ou null (absent, expiré, falsifié)
export function readMfaTicket(req) {
  const ticket = req.cookies?.[MFA_COOKIE];
  if (typeof ticket !== "string" || ticket.length > 2000) return null;
  try {
    return jwt.verify(ticket, env.JWT_ACCESS_SECRET, { ...JWT_OPTIONS, algorithms: ["HS256"] });
  } catch {
    return null;
  }
}
