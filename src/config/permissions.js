// RBAC : rôles et catalogue FIXE des permissions (seule source de vérité côté serveur).
// - client       : droits de client uniquement (réserver, voir et annuler SES réservations)
// - gestionnaire : seulement les permissions que le superadmin lui a accordées une par une
// - superadmin   : toutes les permissions ; seul à gérer l'équipe (non délégable)

export const ROLES = ["client", "gestionnaire", "superadmin"];
export const STAFF_ROLES = ["gestionnaire", "superadmin"];

// `implies` : une permission en entraîne d'autres (gérer les réservations implique de les voir)
export const PERMISSIONS = {
  "stats.read": { label: "Voir le tableau de bord", implies: [] },
  "orders.read": { label: "Voir les réservations et les coordonnées des clients", implies: [] },
  "orders.manage": {
    label: "Valider, refuser, terminer les réservations et envoyer les rappels",
    implies: ["orders.read"],
  },
  "vehicles.manage": { label: "Créer, modifier et supprimer des véhicules", implies: [] },
  "clients.read": { label: "Voir les clients", implies: [] },
  "clients.manage": {
    label: "Inviter, désactiver et supprimer des clients",
    implies: ["clients.read"],
  },
  "payments.read": { label: "Voir les paiements", implies: [] },
  "payments.manage": {
    label: "Enregistrer un paiement à la remise, marquer un remboursement",
    implies: ["payments.read"],
  },
  "audit.read": { label: "Consulter le journal d'audit", implies: [] },
};

export const PERMISSION_KEYS = Object.keys(PERMISSIONS);

// Anciennes valeurs (avant la migration) : tolérées le temps de la bascule
const LEGACY_ROLES = { admin: "superadmin", user: "client" };
export const normalizeRole = (role) => LEGACY_ROLES[role] ?? role;

// Liste reçue -> permissions connues, sans doublon, avec les permissions impliquées
export function normalizePermissions(list = []) {
  const result = new Set();
  for (const key of list) {
    if (!Object.hasOwn(PERMISSIONS, key)) continue;
    result.add(key);
    for (const implied of PERMISSIONS[key].implies) result.add(implied);
  }
  return PERMISSION_KEYS.filter((key) => result.has(key));
}

// Permissions réellement accordées à un utilisateur
export function effectivePermissions(user) {
  const role = normalizeRole(user?.role);
  if (role === "superadmin") return [...PERMISSION_KEYS];
  if (role === "gestionnaire") return normalizePermissions(user.permissions);
  return [];
}

export const isStaff = (user) => STAFF_ROLES.includes(normalizeRole(user?.role));
export const isSuperadmin = (user) => normalizeRole(user?.role) === "superadmin";

export const hasPermissions = (user, required) => {
  const granted = new Set(effectivePermissions(user));
  return required.every((key) => granted.has(key));
};

// Catalogue envoyé au frontend (page « Équipe »)
export const permissionCatalog = () =>
  PERMISSION_KEYS.map((key) => ({ key, label: PERMISSIONS[key].label }));
