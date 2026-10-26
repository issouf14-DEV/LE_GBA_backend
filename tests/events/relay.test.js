import { describe, expect, it } from "vitest";
import { recordEvent } from "../../src/events/outbox.js";
import { relayBatch, startRelay } from "../../src/events/relay.js";
import { EVENTS } from "../../src/events/topology.js";
import OutboxEvent from "../../src/models/OutboxEvent.js";
import { useDatabase } from "../helpers/app.js";

useDatabase();

// Faux bus : garde les messages publiés, ou échoue à la demande
function fakeBus({ delayMs = 0 } = {}) {
  return {
    published: [],
    failing: false,
    async publish(message) {
      if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (this.failing) throw new Error("broker indisponible");
      this.published.push(message);
    },
  };
}

const record = (n) => recordEvent(EVENTS.orderCreated, { orderId: `commande-${n}` });

describe("Relais de la boîte d'envoi", () => {
  it("publie dans l'ordre puis marque les événements publiés", async () => {
    const first = await record(1);
    await record(2);
    await record(3);
    const bus = fakeBus();
    expect(await relayBatch(bus)).toBe(3);
    expect(bus.published.map((m) => m.payload.orderId)).toEqual([
      "commande-1",
      "commande-2",
      "commande-3",
    ]);
    expect(bus.published[0]).toEqual({
      id: String(first._id),
      type: "order.created",
      payload: { orderId: "commande-1" },
      occurredAt: first.createdAt.toISOString(),
    });
    const events = await OutboxEvent.find().lean();
    for (const event of events) {
      expect(event.status).toBe("published");
      expect(event.publishedAt).toBeInstanceOf(Date);
      expect(event.lockedUntil).toBeUndefined();
      expect(event.attempts).toBe(1);
    }
    expect(await relayBatch(bus)).toBe(0);
  });

  it("respecte la limite du tour", async () => {
    await record(1);
    await record(2);
    expect(await relayBatch(fakeBus(), { limit: 1 })).toBe(1);
    expect(await OutboxEvent.countDocuments({ status: "pending" })).toBe(1);
  });

  it("garde l'événement en attente si la publication échoue, puis le reprend après le bail", async () => {
    const event = await record(1);
    const bus = fakeBus();
    bus.failing = true;
    expect(await relayBatch(bus, { leaseMs: 60_000 })).toBe(0);
    let saved = await OutboxEvent.findById(event._id).lean();
    expect(saved.status).toBe("pending");
    expect(saved.lastError).toBe("broker indisponible");
    expect(saved.lockedUntil.getTime()).toBeGreaterThan(Date.now());

    // Bail encore valide : personne ne reprend l'événement
    bus.failing = false;
    expect(await relayBatch(bus)).toBe(0);

    // Bail expiré : l'événement est repris et publié
    await OutboxEvent.updateOne({ _id: event._id }, { lockedUntil: new Date(Date.now() - 1000) });
    expect(await relayBatch(bus)).toBe(1);
    saved = await OutboxEvent.findById(event._id).lean();
    expect(saved.status).toBe("published");
    expect(saved.attempts).toBe(2);
  });

  it("deux relais en parallèle ne publient chaque événement qu'une fois", async () => {
    for (let n = 1; n <= 10; n += 1) await record(n);
    const bus = fakeBus({ delayMs: 5 });
    const [a, b] = await Promise.all([relayBatch(bus), relayBatch(bus)]);
    expect(a + b).toBe(10);
    const ids = bus.published.map((m) => m.id);
    expect(new Set(ids).size).toBe(10);
    expect(await OutboxEvent.countDocuments({ status: "published" })).toBe(10);
  });

  it("la boucle publie les nouveaux événements et s'arrête proprement", async () => {
    const bus = fakeBus();
    const relay = startRelay(bus, { intervalMs: 20 });
    await record(1);
    await expect.poll(() => bus.published.length, { timeout: 5000 }).toBe(1);
    await relay.stop();
    await record(2);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(bus.published.length).toBe(1);
  });
});
