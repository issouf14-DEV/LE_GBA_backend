// Déclaration de la topologie RabbitMQ et format des messages sur le fil.
// Les déclarations sont idempotentes : rejouées à chaque (re)connexion sans effet si tout existe.
import { DEAD_LETTER_EXCHANGE, EXCHANGE, QUEUES, retryQueueName } from "../topology.js";

export async function assertTopology(channel, retryDelaysMs) {
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  await channel.assertExchange(DEAD_LETTER_EXCHANGE, "direct", { durable: true });
  for (const queue of Object.values(QUEUES)) {
    // File principale : un rejet (nack sans remise en file) part vers la file morte
    await channel.assertQueue(queue.name, {
      durable: true,
      deadLetterExchange: DEAD_LETTER_EXCHANGE,
      deadLetterRoutingKey: queue.name,
    });
    // Files d'attente des nouveaux essais, une par délai, sans consommateur : à l'expiration
    // (durée de vie de la file), le message revient dans la file principale par l'exchange par défaut
    for (const delay of new Set(retryDelaysMs)) {
      await channel.assertQueue(retryQueueName(queue, delay), {
        durable: true,
        messageTtl: delay,
        deadLetterExchange: "",
        deadLetterRoutingKey: queue.name,
      });
    }
    await channel.assertQueue(queue.dead, { durable: true });
    await channel.bindQueue(queue.dead, DEAD_LETTER_EXCHANGE, queue.name);
    for (const routingKey of queue.bindings) {
      await channel.bindQueue(queue.name, EXCHANGE, routingKey);
    }
  }
}

// Propriétés AMQP d'un message : persistant, JSON, identifiant et type lisibles sans le corps
export const publishOptions = (message, attempt) => ({
  persistent: true,
  contentType: "application/json",
  messageId: String(message.id),
  type: message.type,
  timestamp: Math.floor(Date.now() / 1000),
  headers: { "x-attempt": attempt },
});

export const encode = (message) => Buffer.from(JSON.stringify(message));

// Numéro de tentative porté par l'en-tête x-attempt (1 si absent ou illisible)
export function attemptOf(delivery) {
  const value = Number(delivery.properties?.headers?.["x-attempt"]);
  return Number.isInteger(value) && value >= 1 ? value : 1;
}

// Corps JSON d'une livraison ; null si illisible ou sans identifiant ni type
export function decode(delivery) {
  try {
    const message = JSON.parse(delivery.content.toString("utf8"));
    const valid = message && typeof message.id === "string" && typeof message.type === "string";
    return valid ? message : null;
  } catch {
    return null;
  }
}

// Publication confirmée par le broker : résout sur ack, rejette sur nack ou canal fermé
export const confirmPublish = (channel, exchange, routingKey, content, options) =>
  new Promise((resolve, reject) => {
    try {
      channel.publish(exchange, routingKey, content, options, (err) =>
        err ? reject(err) : resolve()
      );
    } catch (err) {
      reject(err);
    }
  });

// Journal des événements de la connexion (jamais l'URL) ; onDisconnect : plus de canal utilisable
export function watchConnection(connection, logger, onDisconnect) {
  connection.on("connect", () => logger.info("Bus RabbitMQ connecté"));
  connection.on("disconnect", (err) => {
    onDisconnect();
    logger.warn(`Connexion RabbitMQ perdue : ${err.message}`);
  });
  connection.on("connect-failed", (err) =>
    logger.warn(`Connexion RabbitMQ impossible : ${err.message}`)
  );
  connection.on("reconnect-failed", (err) => logger.error(`RabbitMQ abandonné : ${err.message}`));
  connection.on("error", (err) => logger.warn(`Erreur RabbitMQ : ${err.message}`));
  connection.on("blocked", () => logger.warn("RabbitMQ bloque temporairement les publications"));
}
