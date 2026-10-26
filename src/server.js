import app from "./app.js";
import connectDB from "./config/db.js";
import { env } from "./config/env.js";
import { createBus } from "./events/bus/index.js";
import { startWorker } from "./events/runtime.js";
import User from "./models/User.js";
import { stopFeed } from "./services/notifications/feed.js";
import { closeAllStreams } from "./services/notifications/hub.js";
import { expireStalePending } from "./services/orderStatus.js";
import { createSuperadmin } from "./services/superadmin.js";

// Crée le superadmin à partir des variables d'environnement, s'il n'existe pas encore.
// Seuls moyens d'obtenir ce rôle : ces variables ou `npm run create-superadmin` (accès à la
// base requis) ; aucune route de l'API ne peut le créer ni l'attribuer
async function ensureAdmin() {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;
  if (await User.exists({ email: env.ADMIN_EMAIL.toLowerCase() })) return;
  try {
    await createSuperadmin({
      name: env.ADMIN_NAME || "Administrateur",
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD,
    });
    console.log("Compte super-administrateur créé");
  } catch (error) {
    console.error(`Super-administrateur non créé : ${error.message}`);
  }
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

// Sans RabbitMQ (développement, ou API déployée seule) : worker intégré, bus en mémoire, un seul
// processus. Avec RABBITMQ_URL, seul le service worker (npm run worker) traite les événements.
const inlineWorker = env.RABBITMQ_URL
  ? null
  : await startWorker({ bus: await createBus(), relayIntervalMs: env.RELAY_INTERVAL_MS });
if (inlineWorker) console.log("Événements traités par le worker intégré (bus en mémoire)");

const server = app.listen(env.PORT, () => {
  console.log(`API démarrée sur le port ${env.PORT} (${env.NODE_ENV})`);
});

// Arrêt propre (redéploiement sur Northflank) : fin du tour de relais en cours, puis du serveur
process.on("SIGTERM", async () => {
  await inlineWorker?.stop();
  // Flux SSE fermés (les navigateurs se reconnecteront) : sinon server.close attendrait sans fin
  closeAllStreams();
  await stopFeed();
  server.close(() => process.exit(0));
});
