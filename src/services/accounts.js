// Comptes créés par l'équipe : invitations et règles de protection
import { randomBytes } from "node:crypto";
import { isSuperadmin, normalizeRole } from "../config/permissions.js";
import { httpError } from "../middlewares/errorMiddleware.js";
import User from "../models/User.js";
import { sendInvitationEmail } from "./email/accounts.js";
import { hashToken, revokeAllSessions } from "./tokens.js";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000;

// Le compte est créé avec un mot de passe aléatoire que personne ne connaît : la personne
// invitée choisit le sien via le lien reçu par email (même mécanisme que « mot de passe oublié »)
export async function inviteAccount({ role, data, permissions = [], invitedBy }) {
  if (await User.exists({ email: data.email })) {
    throw httpError(409, "Un compte existe déjà avec cet email");
  }
  const token = randomBytes(32).toString("base64url");
  const user = await User.create({
    ...data,
    role,
    permissions,
    invitedBy,
    password: randomBytes(32).toString("base64url"),
    passwordSetupRequired: true,
    resetPasswordHash: hashToken(token),
    resetPasswordExpires: new Date(Date.now() + INVITE_TTL_MS),
  });
  await sendInvitationEmail(user, token);
  return user;
}

// Compte visé par une action de l'équipe (filtré par rôle : un identifiant d'un autre type
// de compte répond « introuvable », sans rien révéler)
export async function findManageable(actor, id, role) {
  if (String(actor._id) === String(id)) {
    throw httpError(400, "Vous ne pouvez pas effectuer cette action sur votre propre compte");
  }
  const target = await User.findById(id);
  if (!target || normalizeRole(target.role) !== role) {
    throw httpError(404, "Compte introuvable");
  }
  if (isSuperadmin(target)) throw httpError(403, "Compte protégé");
  return target;
}

// Désactiver coupe immédiatement toutes les sessions ; réactiver rend l'accès
export async function setDisabled(target, disabled) {
  target.disabledAt = disabled ? new Date() : undefined;
  await target.save({ validateModifiedOnly: true });
  if (disabled) await revokeAllSessions(target._id);
  return target;
}

export async function deleteAccount(target) {
  await User.deleteOne({ _id: target._id });
  await revokeAllSessions(target._id);
}
