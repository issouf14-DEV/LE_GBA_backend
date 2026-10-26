// Anciens rôles -> RBAC : « admin » devient « superadmin », « user » devient « client ».
// Option removeOldAdmins : les anciens comptes admin sont SUPPRIMÉS au lieu d'être convertis
// (le nouveau super-administrateur est ensuite créé avec « npm run create-superadmin »).
// Uniquement l'ancien rôle « admin » : un super-administrateur (créé avec la nouvelle version)
// n'est jamais supprimé, même si la migration est relancée après sa création
const OLD_ADMINS = { role: "admin" };

export async function migrateRoles(db, apply, { removeOldAdmins = false } = {}) {
  const users = db.collection("users");
  const [admins, clients] = await Promise.all([
    users.countDocuments(removeOldAdmins ? OLD_ADMINS : { role: "admin" }),
    users.countDocuments({ role: "user" }),
  ]);

  if (apply) {
    if (removeOldAdmins) {
      const old = await users.find(OLD_ADMINS, { projection: { _id: 1 } }).toArray();
      await users.deleteMany(OLD_ADMINS);
      // Leurs sessions éventuelles disparaissent avec eux
      await db.collection("refreshtokens").deleteMany({ user: { $in: old.map((u) => u._id) } });
    } else {
      await users.updateMany({ role: "admin" }, { $set: { role: "superadmin", permissions: [] } });
    }
    await users.updateMany({ role: "user" }, { $set: { role: "client", permissions: [] } });
    await users.updateMany({ permissions: { $exists: false } }, { $set: { permissions: [] } });
  }

  if (removeOldAdmins) {
    return `${admins} ancien(s) administrateur(s) SUPPRIMÉ(S), ${clients} client(s) à renommer. Créez ensuite votre compte : npm run create-superadmin`;
  }
  // Plusieurs superadmins après migration : à vérifier (en garder un, les autres en gestionnaires)
  const superadmins = apply ? await users.countDocuments({ role: "superadmin" }) : admins;
  const warning =
    superadmins > 1 ? ` ATTENTION : ${superadmins} superadmins, gardez-en un seul.` : "";
  return `${admins} admin(s) -> superadmin, ${clients} client(s) à renommer.${warning}`;
}
