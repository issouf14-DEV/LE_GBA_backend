// Bus RabbitMQ (amqplib 2) : reconnexion automatique intégrée, canal de confirmation pour publier,
// topologie et consommateurs recréés à chaque (re)connexion, acquittement manuel.
// Les journaux ne contiennent ni l'URL (mot de passe) ni le contenu des messages.
import { setTimeout as sleep } from "node:timers/promises";
import amqplib from "amqplib";
import {
  EXCHANGE,
  MAX_ATTEMPTS,
  QUEUES,
  RETRY_DELAYS_MS,
  retryDelay,
  retryQueueName,
} from "../topology.js";
import {
  assertTopology,
  attemptOf,
  confirmPublish,
  decode,
  encode,
  publishOptions,
  watchConnection,
} from "./rabbitTopology.js";

export async function createRabbitBus({
  url,
  retryDelaysMs = RETRY_DELAYS_MS,
  logger = console,
  prefetch = 10,
  initialMaxRetries = 10,
  closeTimeoutMs = 10_000,
}) {
  const handlers = new Map(); // clé de file -> handler, rejoués après chaque reconnexion
  const inflight = new Set();
  let current = null; // { model, publisher, consumer, tags } de la connexion active
  let closing = false;

  // Canal déjà fermé (connexion perdue) : le broker redistribuera le message non acquitté
  const settle = (action) => {
    try {
      action();
    } catch {
      logger.warn("Acquittement impossible (canal fermé) : le message sera redistribué");
    }
  };

  async function handle(state, queueKey, handler, delivery) {
    const { consumer, publisher } = state;
    const message = decode(delivery);
    if (!message) {
      logger.error(`Message illisible sur ${QUEUES[queueKey].name} : envoyé en file morte`);
      return settle(() => consumer.nack(delivery, false, false));
    }
    const attempt = attemptOf(delivery);
    const label = `Événement ${message.id} (${message.type})`;
    try {
      await handler(message, { attempt });
      return settle(() => consumer.ack(delivery));
    } catch (err) {
      if (attempt >= MAX_ATTEMPTS) {
        logger.error(`${label} en file morte après ${attempt} tentatives : ${err.message}`);
        return settle(() => consumer.nack(delivery, false, false));
      }
      logger.warn(`${label} en échec (tentative ${attempt}) : ${err.message}`);
    }
    try {
      // Copie dans la file d'attente de ce délai : elle revient dans la file principale ensuite
      const retryQueue = retryQueueName(QUEUES[queueKey], retryDelay(retryDelaysMs, attempt));
      const options = publishOptions(message, attempt + 1);
      await confirmPublish(publisher, "", retryQueue, delivery.content, options);
      settle(() => consumer.ack(delivery));
    } catch (err) {
      logger.error(`${label} : nouvel essai impossible, remis en file (${err.message})`);
      settle(() => consumer.nack(delivery, false, true));
    }
  }

  async function startConsumer(state, queueKey, handler) {
    const { consumerTag } = await state.consumer.consume(QUEUES[queueKey].name, (delivery) => {
      // null : consommateur annulé par le serveur (file supprimée) -> reconnexion complète
      if (delivery === null) return state.model.close().catch(() => {});
      const task = handle(state, queueKey, handler, delivery).finally(() => inflight.delete(task));
      inflight.add(task);
    });
    state.tags.set(queueKey, consumerTag);
  }

  // Appelée par amqplib après chaque connexion réussie, avant de la déclarer prête
  async function setup(model) {
    const publisher = await model.createConfirmChannel();
    const consumer = await model.createChannel();
    const state = { model, publisher, consumer, tags: new Map() };
    for (const channel of [publisher, consumer]) {
      channel.on("error", (err) => logger.warn(`Canal RabbitMQ en erreur : ${err.message}`));
      // Un canal perdu alors que la connexion vit : on ferme tout pour forcer une reconnexion
      channel.on("close", () => {
        if (closing || current !== state) return;
        current = null;
        model.close().catch(() => {});
      });
    }
    await assertTopology(publisher, retryDelaysMs);
    await consumer.prefetch(prefetch);
    for (const [queueKey, handler] of handlers) await startConsumer(state, queueKey, handler);
    current = state;
  }

  const connection = await amqplib.connect(url, {
    recovery: { setup, initialMaxRetries, maxRetries: Infinity, waitForConnect: false },
  });
  watchConnection(connection, logger, () => {
    current = null;
  });
  await connection.waitForConnect();

  return {
    async publish(message) {
      if (closing) throw new Error("Bus fermé");
      if (!current) throw new Error("RabbitMQ indisponible : événement non publié");
      const options = publishOptions(message, 1);
      await confirmPublish(current.publisher, EXCHANGE, message.type, encode(message), options);
    },

    async consume(queueKey, handler) {
      if (!QUEUES[queueKey]) throw new Error(`File inconnue : ${queueKey}`);
      if (handlers.has(queueKey)) throw new Error(`La file ${queueKey} a déjà un consommateur`);
      handlers.set(queueKey, handler);
      // Échec (connexion perdue entre-temps) : le consommateur sera recréé à la reconnexion
      if (current) {
        await startConsumer(current, queueKey, handler).catch((err) =>
          logger.warn(`Consommateur ${queueKey} en attente de reconnexion : ${err.message}`)
        );
      }
    },

    async close() {
      if (closing) return;
      closing = true;
      const state = current;
      current = null;
      // Plus de nouvelles livraisons, puis on laisse finir (dans la limite du délai) celles en cours
      for (const tag of state?.tags.values() ?? []) {
        await state.consumer.cancel(tag).catch(() => {});
      }
      const timeout = sleep(closeTimeoutMs, undefined, { ref: false });
      await Promise.race([Promise.allSettled([...inflight]), timeout]);
      await connection.close();
    },
  };
}
