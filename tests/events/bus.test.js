// Bus d'événements en mémoire : routage, file durable, nouveaux essais, file morte
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBus } from "../../src/events/bus/index.js";
import { EVENTS, MAX_ATTEMPTS } from "../../src/events/topology.js";

const silent = { info() {}, warn() {}, error() {} };
const message = (type, payload = { orderId: "o1" }) => ({
  id: `evt-${Math.random().toString(36).slice(2)}`,
  type,
  payload,
  occurredAt: new Date().toISOString(),
});

describe("Bus d'événements en mémoire", () => {
  let bus;
  beforeEach(async () => {
    bus = await createBus({ retryDelaysMs: [0, 0, 0, 0], logger: silent });
  });
  afterEach(async () => {
    await bus.close();
  });

  it("livre dans gba.email les types liés à la file, avec attempt = 1", async () => {
    const received = [];
    await bus.consume("email", async (msg, ctx) => received.push([msg.type, ctx.attempt]));
    await bus.publish(message(EVENTS.orderCreated));
    await bus.publish(message(EVENTS.passwordChanged, { userId: "u1" }));
    await bus.drain();
    expect(received).toEqual([
      [EVENTS.orderCreated, 1],
      [EVENTS.passwordChanged, 1],
    ]);
  });

  it("garde un message publié avant l'abonnement et le livre ensuite", async () => {
    const sent = message(EVENTS.orderStatusChanged, { orderId: "o2", status: "confirmed" });
    await bus.publish(sent);
    await bus.drain();
    const received = [];
    await bus.consume("email", async (msg) => received.push(msg));
    await bus.drain();
    expect(received).toEqual([sent]);
  });

  it("livre une copie sérialisée, sans référence partagée avec l'éditeur", async () => {
    const sent = message(EVENTS.mfaEnabled, { userId: "u1", at: new Date(0) });
    let received;
    await bus.consume("email", async (msg) => {
      received = msg;
    });
    await bus.publish(sent);
    sent.payload.userId = "modifié";
    await bus.drain();
    expect(received.payload).toEqual({ userId: "u1", at: "1970-01-01T00:00:00.000Z" });
  });

  it("refait un essai après un échec puis réussit avec attempt = 2", async () => {
    const attempts = [];
    await bus.consume("email", async (_msg, { attempt }) => {
      attempts.push(attempt);
      if (attempt === 1) throw new Error("SMTP indisponible");
    });
    await bus.publish(message(EVENTS.orderCreated));
    await bus.drain();
    expect(attempts).toEqual([1, 2]);
    expect(bus.deadLetters("email")).toEqual([]);
  });

  it("envoie le message en file morte après 5 échecs", async () => {
    const attempts = [];
    await bus.consume("email", async (_msg, { attempt }) => {
      attempts.push(attempt);
      throw new Error("échec permanent");
    });
    const sent = message(EVENTS.mfaReset, { userId: "u3" });
    await bus.publish(sent);
    await bus.drain();
    expect(attempts).toEqual([1, 2, 3, 4, 5]);
    expect(attempts).toHaveLength(MAX_ATTEMPTS);
    expect(bus.deadLetters("email")).toEqual([sent]);
  });

  it("n'achemine pas dans gba.email un type non lié", async () => {
    const received = [];
    await bus.consume("email", async (msg) => received.push(msg));
    await bus.publish(message("vehicle.created", { vehicleId: "v1" }));
    await bus.drain();
    expect(received).toEqual([]);
    expect(bus.deadLetters("email")).toEqual([]);
  });

  it("drain attend la fin des handlers et des nouveaux essais en cours", async () => {
    const slowBus = await createBus({ retryDelaysMs: [30, 30, 30, 30], logger: silent });
    let done = false;
    await slowBus.consume("email", async (_msg, { attempt }) => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      if (attempt < 3) throw new Error("pas encore");
      done = true;
    });
    await slowBus.publish(message(EVENTS.orderCreated));
    await slowBus.drain();
    expect(done).toBe(true);
    await slowBus.close();
  });

  it("drain résout immédiatement sans activité, même avec des messages en attente", async () => {
    await bus.publish(message(EVENTS.orderCreated));
    await expect(bus.drain()).resolves.toBeUndefined();
  });

  it("refuse une file inconnue, un second consommateur et la publication après fermeture", async () => {
    await expect(bus.consume("sms", async () => {})).rejects.toThrow("File inconnue");
    await bus.consume("email", async () => {});
    await expect(bus.consume("email", async () => {})).rejects.toThrow("déjà un consommateur");
    await bus.close();
    await expect(bus.publish(message(EVENTS.orderCreated))).rejects.toThrow("Bus fermé");
  });
});
