import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { recordEvent } from "../../src/events/outbox.js";
import { EVENTS } from "../../src/events/topology.js";
import OutboxEvent from "../../src/models/OutboxEvent.js";
import { useDatabase } from "../helpers/app.js";

useDatabase();

describe("Boîte d'envoi des événements (outbox)", () => {
  it("enregistre un événement en attente, avec des identifiants en chaîne", async () => {
    const orderId = new mongoose.Types.ObjectId();
    const event = await recordEvent(EVENTS.orderCreated, { orderId });
    const saved = await OutboxEvent.findById(event._id).lean();
    expect(saved.type).toBe("order.created");
    expect(saved.status).toBe("pending");
    expect(saved.attempts).toBe(0);
    expect(saved.payload).toEqual({ orderId: String(orderId) });
  });

  it("refuse un type d'événement inconnu", async () => {
    await expect(recordEvent("order.inconnu", { orderId: "x" })).rejects.toThrow(/inconnu/);
    expect(await OutboxEvent.countDocuments()).toBe(0);
  });

  it("refuse un contenu qui n'est pas un objet d'identifiants", async () => {
    await expect(recordEvent(EVENTS.passwordChanged, { user: { email: "a@b.c" } })).rejects.toThrow(
      /identifiant/
    );
    await expect(recordEvent(EVENTS.passwordChanged, null)).rejects.toThrow(/objet/);
  });

  it("n'écrit rien si la transaction est annulée", async () => {
    await OutboxEvent.createCollection();
    const session = await mongoose.startSession();
    try {
      await expect(
        session.withTransaction(async () => {
          await recordEvent(EVENTS.mfaEnabled, { userId: "u1" }, { session });
          throw new Error("échec de l'action métier");
        })
      ).rejects.toThrow("échec de l'action métier");
    } finally {
      await session.endSession();
    }
    expect(await OutboxEvent.countDocuments()).toBe(0);
  });

  it("écrit l'événement quand la transaction est validée", async () => {
    await OutboxEvent.createCollection();
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(() =>
        recordEvent(EVENTS.mfaReset, { userId: "u2" }, { session })
      );
    } finally {
      await session.endSession();
    }
    expect(await OutboxEvent.countDocuments({ type: "user.mfa_reset" })).toBe(1);
  });
});
