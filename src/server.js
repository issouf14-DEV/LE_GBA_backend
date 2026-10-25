import app from "./app.js";
import connectDB from "./config/db.js";
import { env } from "./config/env.js";
import User from "./models/User.js";
import { strongPassword } from "./schemas/common.js";
import { expireStalePending } from "./services/orderStatus.js";

// Crée le superadmin à partir des variables d'environnement, s'il n'existe pas encore.
// Seul moyen d'obtenir ce rôle : aucune route de l'API ne peut le créer ni l'attribuer
async function ensureAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  if (await User.exists({ email: env.ADMIN_EMAIL.toLowerCase() })) return;

  if (!strongPassword.safeParse(env.ADMIN_PASSWORD).success) {
    console.error(
      "ADMIN_PASSWORD trop faible : 8 caractères min. avec lettres et chiffres. Admin non créé."
    );
    return;
  }
  await User.create({
    name: env.ADMIN_NAME || "Administrateur",
    email: env.ADMIN_EMAIL,
    password: env.ADMIN_PASSWORD,
    role: "superadmin",
  });
  console.log("Compte super-administrateur créé");
}

await connectDB();
await ensureAdmin();

// Demandes de réservation sans réponse depuis 48 h : annulées au démarrage puis toutes les heures
const expire = () =>
  expireStalePending()
    .then((count) => count && console.log(`${count} réservation(s) en attente expirée(s)`))
    .catch((error) => console.error("Expiration des réservations :", error.message));
expire();
setInterval(expire, 60 * 60 * 1000).unref();

const server = app.listen(env.PORT, () => {
  console.log(`API démarrée sur le port ${env.PORT} (${env.NODE_ENV})`);
});

// Arrêt propre (redéploiement sur Northflank)
process.on("SIGTERM", () => server.close(() => process.exit(0)));
