// Démarrage du traitement des événements (relais + consommateurs) sur un bus donné : utilisé par
// le worker, et par l'API en développement (worker intégré, bus en mémoire)
import { startConsumers } from "./consumers/index.js";
import { startRelay } from "./relay.js";

export async function startWorker({ bus, relayIntervalMs } = {}) {
  await startConsumers(bus);
  const relay = startRelay(bus, { intervalMs: relayIntervalMs });
  return { stop: () => relay.stop() };
}
