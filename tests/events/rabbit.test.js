// Intégration du bus RabbitMQ : ignoré sans RABBITMQ_TEST_URL (broker de test dédié, files purgées)
import amqplib from "amqplib";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBus } from "../../src/events/bus/index.js";
import { EVENTS, QUEUES, retryQueueName } from "../../src/events/topology.js";

const url = process.env.RABBITMQ_TEST_URL;
const silent = { info() {}, warn() {}, error() {} };
const { name, dead } = QUEUES.email;
const retry = retryQueueName(QUEUES.email, 50);

const message = (type, payload) => ({
  id: `evt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  type,
  payload,
  occurredAt: new Date().toISOString(),
});

async function waitFor(check, timeoutMs = 15_000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > end) throw new Error("Délai dépassé");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe.skipIf(!url)("Bus RabbitMQ (intégration)", () => {
  let bus;
  let admin;
  let channel;
  let current = async () => {}; // handler du test en cours

  // Lit la file morte jusqu'à trouver le message attendu
  const deadLetter = (match) =>
    waitFor(async () => {
      const found = await channel.get(dead, { noAck: true });
      return found && match(found) ? found : null;
    });

  beforeAll(async () => {
    bus = await createBus({ url, retryDelaysMs: [50, 50, 50, 50], logger: silent });
    await bus.consume("email", (msg, ctx) => current(msg, ctx));
    admin = await amqplib.connect(url);
    channel = await admin.createChannel();
  });

  beforeEach(async () => {
    current = async () => {};
    for (const queue of [name, retry, dead]) await channel.purgeQueue(queue);
  });

  afterAll(async () => {
    await bus?.close();
    await admin?.close();
  });

  it("publie avec confirmation puis livre le message au consommateur", async () => {
    const sent = message(EVENTS.orderCreated, { orderId: "o1" });
    const received = [];
    current = async (msg, ctx) => received.push([msg, ctx.attempt]);
    await bus.publish(sent);
    await waitFor(() => received.length === 1);
    expect(received[0]).toEqual([sent, 1]);
  });

  it("refait un essai via la file d'attente puis réussit avec attempt = 2", async () => {
    const sent = message(EVENTS.passwordChanged, { userId: "u1" });
    const attempts = [];
    current = async (msg, { attempt }) => {
      if (msg.id !== sent.id) return;
      attempts.push(attempt);
      if (attempt === 1) throw new Error("SMTP indisponible");
    };
    await bus.publish(sent);
    await waitFor(() => attempts.length === 2);
    expect(attempts).toEqual([1, 2]);
  });

  it("envoie le message en file morte après 5 tentatives", async () => {
    const sent = message(EVENTS.mfaReset, { userId: "u2" });
    const attempts = [];
    current = async (msg, { attempt }) => {
      if (msg.id !== sent.id) return;
      attempts.push(attempt);
      throw new Error("échec permanent");
    };
    await bus.publish(sent);
    const found = await deadLetter((m) => m.properties.messageId === sent.id);
    expect(JSON.parse(found.content.toString())).toEqual(sent);
    expect(attempts).toEqual([1, 2, 3, 4, 5]);
  });

  it("envoie directement en file morte un message illisible", async () => {
    channel.sendToQueue(name, Buffer.from("pas du json"), { messageId: "illisible" });
    const found = await deadLetter((m) => m.properties.messageId === "illisible");
    expect(found.content.toString()).toBe("pas du json");
  });
});
