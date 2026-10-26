// Worker des événements (node src/worker.js, même image que l'API) : publie la boîte d'envoi
// sur RabbitMQ et traite les files (emails). Réglages Mongoose (anti-injection) chargés en premier.

import connectDB from "./config/db.js";
import { env } from "./config/env.js";
import mongoose from "./config/mongoose.js";
import { createBus } from "./events/bus/index.js";
import { startWorker } from "./events/runtime.js";

// biome-ignore lint/suspicious/noConsole: journal de démarrage et d'arrêt du worker
const info = (text) => console.log(text);

// Variables validées par env.js (RABBITMQ_URL, RABBITMQ_PREFETCH, RELAY_INTERVAL_MS)
const url = env.RABBITMQ_URL;
const relayIntervalMs = env.RELAY_INTERVAL_MS;

// En production, un bus en mémoire perdrait les événements à chaque redémarrage : refus
if (env.NODE_ENV === "production" && !url) {
  console.error("Configuration invalide : RABBITMQ_URL manquant (obligatoire pour le worker)");
  process.exit(1);
}

let bus;
let worker;
try {
  await connectDB();
  bus = await createBus({ url, logger: console, prefetch: env.RABBITMQ_PREFETCH });
  worker = await startWorker({ bus, relayIntervalMs });
  info(`Worker démarré (bus ${url ? "RabbitMQ" : "en mémoire"})`);
} catch (error) {
  console.error("Démarrage du worker impossible :", error?.message);
  process.exit(1);
}

// Arrêt propre : fin du tour de relais en cours, fermeture du bus, puis de la base
let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  info(`Worker : arrêt demandé (${signal})`);
  try {
    await worker.stop();
    await bus.close();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Arrêt du worker incomplet :", error?.message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
