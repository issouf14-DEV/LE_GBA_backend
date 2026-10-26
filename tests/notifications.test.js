// Consommateur « inapp » : création des notifications à partir des événements du bus
import mongoose from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";
import { createBus } from "../src/events/bus/index.js";
import { handleInappEvent } from "../src/events/consumers/inapp.js";
import { startConsumers } from "../src/events/consumers/index.js";
import Notification from "../src/models/Notification.js";
import Order from "../src/models/Order.js";
import { createUser, createVehicle, useDatabase } from "./helpers/app.js";

useDatabase();
beforeAll(() => Notification.init());

const message = (type, payload, id = new mongoose.Types.ObjectId()) => ({
  id: String(id),
  type,
  payload,
  occurredAt: new Date().toISOString(),
});

async function createOrder(user) {
  const vehicle = await createVehicle();
  return Order.create({
    user: user._id,
    vehicle: vehicle._id,
    vehicleSnapshot: { brand: "Toyota", model: "Corolla", year: 2024 },
    startDate: new Date("2026-11-12T10:00:00Z"),
    endDate: new Date("2026-11-14T10:00:00Z"),
    days: 2,
    pricePerDay: 25_000,
    totalPrice: 50_000,
    contact: { fullName: "Awa Koné", email: "a@test.local", phone: "0700000000", address: "Abj" },
  });
}

const recipients = async () => (await Notification.find().lean()).map((n) => String(n.user)).sort();

describe("Consommateur inapp : création des notifications", () => {
  it("nouvelle réservation : seulement les membres actifs de l'équipe ayant orders.read", async () => {
    const client = await createUser();
    const boss = await createUser({ role: "superadmin", email: "boss@test.local" });
    const reader = await createUser({ role: "gestionnaire", permissions: ["orders.read"] });
    const manager = await createUser({ role: "gestionnaire", permissions: ["orders.manage"] });
    await createUser({ role: "gestionnaire", permissions: ["vehicles.manage"] });
    await createUser({
      role: "gestionnaire",
      permissions: ["orders.read"],
      disabledAt: new Date(),
    });
    const order = await createOrder(client);

    expect(await handleInappEvent(message("order.created", { orderId: String(order._id) }))).toBe(
      3
    );
    expect(await recipients()).toEqual([boss, reader, manager].map((u) => String(u._id)).sort());
    const notification = await Notification.findOne({ user: boss._id }).lean();
    expect(notification).toMatchObject({ kind: "order.created", link: "/admin/orders" });
    expect(notification.body).toContain("Toyota Corolla");
    expect(notification.body).not.toContain("Awa");
  });

  it("changement de statut : seul le client de la réservation est notifié", async () => {
    const client = await createUser();
    await createUser({ role: "superadmin", email: "boss@test.local" });
    const order = await createOrder(client);
    await handleInappEvent(
      message("order.status_changed", { orderId: String(order._id), status: "validee" })
    );
    expect(await recipients()).toEqual([String(client._id)]);
    const notification = await Notification.findOne().lean();
    expect(notification).toMatchObject({ title: "Réservation confirmée", link: "/profile/orders" });
    // Retour « en attente » : aucune notification
    await handleInappEvent(
      message("order.status_changed", { orderId: String(order._id), status: "en_attente" })
    );
    expect(await Notification.countDocuments()).toBe(1);
  });

  it("événements de sécurité : seul le compte concerné, rien pour un compte supprimé", async () => {
    const user = await createUser();
    await handleInappEvent(message("user.password_changed", { userId: String(user._id) }));
    await handleInappEvent(message("user.mfa_reset", { userId: String(user._id) }));
    await handleInappEvent(message("user.mfa_enabled", { userId: "pas-un-id" }));
    await handleInappEvent(message("constructor", {}));
    expect(await recipients()).toEqual([String(user._id), String(user._id)]);
    expect(await Notification.distinct("kind")).toEqual(["security"]);
  });

  it("idempotence : un événement livré deux fois ne crée qu'une notification", async () => {
    const user = await createUser();
    const event = message("user.password_changed", { userId: String(user._id) });
    await handleInappEvent(event);
    expect(await handleInappEvent(event)).toBe(0);
    expect(await Notification.countDocuments()).toBe(1);
  });

  it("par le bus mémoire : la file inapp reçoit l'événement en plus de la file email", async () => {
    const bus = await createBus({ retryDelaysMs: [0, 0, 0, 0], logger: console });
    await startConsumers(bus);
    const user = await createUser();
    const event = message("user.mfa_enabled", { userId: String(user._id) });
    await bus.publish(event);
    await bus.publish(event);
    await bus.drain();
    expect(await Notification.countDocuments({ user: user._id, eventId: event.id })).toBe(1);
    expect(bus.deadLetters("inapp")).toEqual([]);
    await bus.close();
  });
});
