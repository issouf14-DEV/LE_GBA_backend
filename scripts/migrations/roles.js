// Anciens rôles -> RBAC : « admin » devient « superadmin », « user » devient « client »
export async function migrateRoles(db, apply) {
  const users = db.collection("users");
  const [admins, clients] = await Promise.all([
    users.countDocuments({ role: "admin" }),
    users.countDocuments({ role: "user" }),
  ]);

  if (apply) {
    await users.updateMany({ role: "admin" }, { $set: { role: "superadmin", permissions: [] } });
    await users.updateMany({ role: "user" }, { $set: { role: "client", permissions: [] } });
    await users.updateMany({ permissions: { $exists: false } }, { $set: { permissions: [] } });
  }

  // Plusieurs superadmins après migration : à vérifier (en garder un, les autres en gestionnaires)
  const superadmins = apply ? await users.countDocuments({ role: "superadmin" }) : admins;
  const warning =
    superadmins > 1 ? ` ATTENTION : ${superadmins} superadmins, gardez-en un seul.` : "";
  return `${admins} admin(s) -> superadmin, ${clients} client(s) à renommer.${warning}`;
}
