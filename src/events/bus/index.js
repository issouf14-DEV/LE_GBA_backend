// Fabrique du bus d'événements : RabbitMQ si une URL est fournie, sinon bus en mémoire
// (tests et développement sans broker), avec la même interface.
import { createMemoryBus } from "./memoryBus.js";

export async function createBus({ url, retryDelaysMs, logger = console, prefetch } = {}) {
  if (!url) return createMemoryBus({ retryDelaysMs, logger });
  // Import à la demande : amqplib n'est chargé que si RabbitMQ est réellement utilisé
  const { createRabbitBus } = await import("./rabbitBus.js");
  return createRabbitBus({ url, retryDelaysMs, logger, prefetch });
}
