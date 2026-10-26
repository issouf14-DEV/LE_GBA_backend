// Vérification de l'email (nouvelle version) : les comptes existants sont considérés comme
// vérifiés (ils réservaient déjà) ; seuls les nouveaux inscrits devront confirmer leur adresse.
const UNVERIFIED = { emailVerifiedAt: { $exists: false } };

export async function migrateEmailVerified(db, apply) {
  const users = db.collection("users");
  const count = await users.countDocuments(UNVERIFIED);
  if (apply && count > 0) {
    // Date d'inscription reprise comme date de vérification
    await users.updateMany(UNVERIFIED, [{ $set: { emailVerifiedAt: "$createdAt" } }]);
  }
  return `${count} compte(s) existant(s) marqué(s) comme ayant une adresse vérifiée.`;
}
