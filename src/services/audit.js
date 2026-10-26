// Écriture du journal d'audit. Une erreur du journal ne fait JAMAIS échouer la requête :
// elle est seulement signalée dans la console du serveur.
import mongoose from "mongoose";
import { normalizeRole } from "../config/permissions.js";
import AuditLog from "../models/AuditLog.js";
import { anonymizeIp } from "../utils/anonymizeIp.js";

const MAX_KEYS = 12;
const MAX_ITEMS = 20;
const MAX_TEXT = 100;
const KEY = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
// Clés refusées même si l'appelant se trompe : aucun secret ne doit entrer dans le journal
const SENSITIVE = /pass|secret|token|code|hash|otp|cookie|session|key|card|pin/i;

function cleanValue(value) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return value.trim().slice(0, MAX_TEXT);
  if (value instanceof mongoose.Types.ObjectId) return String(value);
  return undefined;
}

// Ne garde que des valeurs courtes (texte, nombre, booléen, identifiant) ou des listes de
// valeurs courtes ; tout objet imbriqué est ignoré
export function cleanMeta(meta) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return {};
  const result = {};
  for (const [key, value] of Object.entries(meta).slice(0, MAX_KEYS)) {
    if (!KEY.test(key) || SENSITIVE.test(key)) continue;
    const clean = Array.isArray(value)
      ? value
          .slice(0, MAX_ITEMS)
          .map(cleanValue)
          .filter((item) => item !== undefined)
      : cleanValue(value);
    if (clean !== undefined) result[key] = clean;
  }
  return result;
}

const userAgentOf = (req) => {
  const value = req?.get?.("user-agent");
  return typeof value === "string" ? value.slice(0, 120) : undefined;
};

// `actor` : compte à l'origine de l'action (par défaut l'utilisateur connecté ; pour une
// connexion échouée, le compte visé)
export async function audit(req, action, { actor, targetType, targetId, meta } = {}) {
  try {
    const who = actor ?? req?.user;
    await AuditLog.create({
      actor: who?._id,
      actorRole: who ? normalizeRole(who.role) : undefined,
      action,
      targetType,
      targetId,
      meta: cleanMeta(meta),
      ip: anonymizeIp(req?.ip),
      userAgent: userAgentOf(req),
    });
  } catch (error) {
    console.error("[journal d'audit]", action, error.message);
  }
}

// Action sur un compte (désactivation, suppression...) : le rôle du compte visé est noté
export const auditAccount = (req, action, target) =>
  audit(req, action, {
    targetType: "user",
    targetId: target._id,
    meta: { role: normalizeRole(target.role) },
  });

// Action sur un véhicule : son nom est noté (lisible même après suppression)
export const auditVehicle = (req, action, vehicle, meta = {}) =>
  audit(req, action, {
    targetType: "vehicle",
    targetId: vehicle._id,
    meta: {
      label: [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" "),
      ...meta,
    },
  });
