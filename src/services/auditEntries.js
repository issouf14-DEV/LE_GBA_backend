// Lecture du journal d'audit pour l'administration : filtres, pagination, noms des comptes.
// Lecture groupée des comptes (pas de populate), comme src/services/orderOwners.js.
import mongoose from "mongoose";
import AuditLog from "../models/AuditLog.js";
import User from "../models/User.js";

// Filtre construit par le serveur à partir de valeurs déjà validées par Zod
export function auditFilter({ action, actor, targetType, from, to }) {
  const filter = {};
  if (action) filter.action = action;
  if (actor) filter.actor = actor;
  if (targetType) filter.targetType = targetType;
  if (from || to) {
    // Côte d'Ivoire : heure UTC, la journée locale correspond à la journée UTC
    filter.createdAt = mongoose.trusted({
      ...(from ? { $gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { $lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    });
  }
  return filter;
}

async function peopleById(entries) {
  const ids = new Set();
  for (const entry of entries) {
    if (entry.actor) ids.add(String(entry.actor));
    if (entry.targetType === "user" && entry.targetId) ids.add(String(entry.targetId));
  }
  if (ids.size === 0) return new Map();
  // Identifiants lus en base : la protection anti-injection peut être levée
  const users = await User.find({ _id: mongoose.trusted({ $in: [...ids] }) })
    .select("name email")
    .lean();
  return new Map(users.map((user) => [String(user._id), user]));
}

const person = (byId, id) => {
  const user = id && byId.get(String(id));
  return user ? { id: String(user._id), name: user.name, email: user.email } : null;
};

// Seuls ces champs quittent le serveur (un compte supprimé apparaît sans nom)
export async function listAuditEntries(query) {
  const { page, limit } = query;
  const filter = auditFilter(query);
  const [entries, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  const byId = await peopleById(entries);
  return {
    entries: entries.map((entry) => ({
      id: String(entry._id),
      createdAt: entry.createdAt,
      action: entry.action,
      actor: person(byId, entry.actor),
      actorId: entry.actor ? String(entry.actor) : null,
      actorRole: entry.actorRole ?? null,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ? String(entry.targetId) : null,
      target: entry.targetType === "user" ? person(byId, entry.targetId) : null,
      meta: entry.meta ?? {},
      ip: entry.ip ?? null,
      userAgent: entry.userAgent ?? null,
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
