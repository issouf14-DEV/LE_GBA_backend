// Gestion de l'équipe (superadmin uniquement) : gestionnaires et leurs permissions
import { permissionCatalog } from "../config/permissions.js";
import User from "../models/User.js";
import { deleteAccount, findManageable, inviteAccount, setDisabled } from "../services/accounts.js";
import { audit, auditAccount } from "../services/audit.js";

const MANAGER = "gestionnaire";

export function listPermissions(_req, res) {
  res.json({ permissions: permissionCatalog() });
}

export async function listTeam(_req, res) {
  const members = await User.find({ role: MANAGER }).sort({ createdAt: -1 }).limit(200);
  res.json({ members: members.map((member) => member.toPublic()) });
}

// Création d'un gestionnaire : invitation par email, permissions choisies par le superadmin
export async function inviteManager(req, res) {
  const { permissions, ...data } = req.body;
  const user = await inviteAccount({ role: MANAGER, data, permissions, invitedBy: req.user._id });
  await audit(req, "manager.invited", {
    targetType: "user",
    targetId: user._id,
    meta: { permissions: [...user.permissions] },
  });
  res.status(201).json(user.toPublic());
}

// Accorder ou retirer des permissions : effet immédiat (le compte est relu à chaque requête)
export async function updatePermissions(req, res) {
  const target = await findManageable(req.user, req.validated.params.id, MANAGER);
  const before = [...target.permissions];
  target.permissions = req.body.permissions;
  await target.save({ validateModifiedOnly: true });
  await audit(req, "manager.permissions_changed", {
    targetType: "user",
    targetId: target._id,
    meta: { before, after: [...target.permissions] },
  });
  res.json(target.toPublic());
}

export async function updateManagerStatus(req, res) {
  const target = await findManageable(req.user, req.validated.params.id, MANAGER);
  await setDisabled(target, req.body.disabled);
  await auditAccount(req, req.body.disabled ? "account.disabled" : "account.enabled", target);
  res.json(target.toPublic());
}

export async function deleteManager(req, res) {
  const target = await findManageable(req.user, req.validated.params.id, MANAGER);
  await deleteAccount(target);
  await auditAccount(req, "account.deleted", target);
  res.status(204).end();
}
