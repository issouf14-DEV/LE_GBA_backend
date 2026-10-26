// Chaîne complète avec le bus en mémoire : action dans l'API -> outbox -> relais -> email
import { describe, expect, it, vi } from "vitest";
import { createBus } from "../../src/events/bus/index.js";
import { startConsumers } from "../../src/events/consumers/index.js";
import { relayBatch } from "../../src/events/relay.js";
import OutboxEvent from "../../src/models/OutboxEvent.js";
import ProcessedEvent from "../../src/models/ProcessedEvent.js";
import { sendEmail } from "../../src/services/email/sender.js";
import { createVehicle, inDays, loggedIn, loggedInManager, useDatabase } from "../helpers/app.js";

// Emails « configurés » mais envoi simulé : on vérifie qui reçoit quoi, sans fournisseur réel
vi.mock("../../src/services/email/sender.js", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("../../src/services/email/providers.js", async (importOriginal) => ({
  ...(await importOriginal()),
  emailConfig: () => ({ enabled: true }),
}));

useDatabase();

const CONTACT = {
  fullName: "Awa Koné",
  email: "awa@test.local",
  phone: "07 12 34 56 78",
  address: "Cocody, Abidjan",
};

async function book(client) {
  const vehicle = await createVehicle();
  const res = await client.post("/api/orders", {
    vehicleId: String(vehicle._id),
    startDate: inDays(2),
    endDate: inDays(4),
    contact: CONTACT,
    notes: "",
  });
  expect(res.status).toBe(201);
  return res.body;
}

// Fait passer tous les événements en attente par le bus, comme le ferait le worker
async function runWorker() {
  const bus = await createBus({ retryDelaysMs: [0, 0, 0, 0] });
  await startConsumers(bus);
  await relayBatch(bus);
  await bus.drain();
  await bus.close();
}

describe("événements métier", () => {
  it("une réservation écrit un événement (identifiant seulement), envoyé par le worker", async () => {
    const { client } = await loggedIn();
    const order = await book(client);
    const [event] = await OutboxEvent.find();
    expect(event.type).toBe("order.created");
    expect(event.payload).toEqual({ orderId: String(order._id ?? order.id) });
    expect(event.status).toBe("pending");
    expect(sendEmail).not.toHaveBeenCalled();

    await runWorker();
    expect((await OutboxEvent.findById(event._id)).status).toBe("published");
    // Traité une fois par chaque consommateur abonné (email et notifications de l'application)
    const consumers = await ProcessedEvent.distinct("consumer", { eventId: String(event._id) });
    expect(consumers.sort()).toEqual(["email", "inapp"]);
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "admin@test.local" }));
  });

  it("validation par l'équipe : statut et événement écrits ensemble, email au compte client", async () => {
    const { client, user } = await loggedIn();
    const order = await book(client);
    const { client: manager } = await loggedInManager(["orders.manage"]);
    const id = order._id ?? order.id;
    expect((await manager.patch(`/api/orders/${id}/status`, { status: "validee" })).status).toBe(
      200
    );
    const event = await OutboxEvent.findOne({ type: "order.status_changed" });
    expect(event.payload).toEqual({ orderId: String(id), status: "validee" });

    sendEmail.mockClear();
    await runWorker();
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: user.email }));
  });

  it("un changement de statut refusé n'écrit aucun événement", async () => {
    const { client } = await loggedIn();
    const order = await book(client);
    const { client: manager } = await loggedInManager(["orders.manage"]);
    const id = order._id ?? order.id;
    expect((await manager.patch(`/api/orders/${id}/status`, { status: "terminee" })).status).toBe(
      409
    );
    expect(await OutboxEvent.countDocuments({ type: "order.status_changed" })).toBe(0);
  });

  it("relancer le worker ne renvoie pas les emails déjà envoyés", async () => {
    const { client } = await loggedIn();
    await book(client);
    await runWorker();
    sendEmail.mockClear();
    await runWorker();
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
