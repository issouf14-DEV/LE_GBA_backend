import mongoose from "mongoose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleEmailEvent } from "../../src/events/consumers/email.js";
import { once } from "../../src/events/consumers/once.js";
import Order from "../../src/models/Order.js";
import ProcessedEvent from "../../src/models/ProcessedEvent.js";
import { sendEmail } from "../../src/services/email/sender.js";
import { createUser, createVehicle, useDatabase } from "../helpers/app.js";

// Envoi simulé (aucun appel au fournisseur) et configuration des emails pilotée par le test
const state = vi.hoisted(() => ({ enabled: true }));
vi.mock("../../src/services/email/sender.js", () => ({ sendEmail: vi.fn(async () => true) }));
vi.mock("../../src/services/email/providers.js", async (importOriginal) => ({
  ...(await importOriginal()),
  emailConfig: () => ({ enabled: state.enabled }),
}));

useDatabase();

beforeEach(() => {
  state.enabled = true;
  sendEmail.mockReset();
  sendEmail.mockResolvedValue(true);
});

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
    startDate: new Date(Date.now() + 86_400_000),
    endDate: new Date(Date.now() + 3 * 86_400_000),
    days: 2,
    pricePerDay: 25_000,
    totalPrice: 50_000,
    contact: {
      fullName: "Awa Koné",
      email: "libre@test.local",
      phone: "0700000000",
      address: "Abidjan",
    },
  });
}

describe("Idempotence des consommateurs (once)", () => {
  it("ne traite qu'une fois un message livré deux fois", async () => {
    const handler = vi.fn(async () => {});
    const wrapped = once("email", handler);
    const msg = message("order.created", { orderId: "x" });
    await wrapped(msg, { attempt: 1 });
    await wrapped(msg, { attempt: 1 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(msg, { attempt: 1 });
    expect(await ProcessedEvent.countDocuments({ eventId: msg.id, consumer: "email" })).toBe(1);
  });

  it("refait le traitement si la première tentative a échoué", async () => {
    const handler = vi.fn().mockRejectedValueOnce(new Error("panne")).mockResolvedValue();
    const wrapped = once("email", handler);
    const msg = message("order.created", { orderId: "x" });
    await expect(wrapped(msg, { attempt: 1 })).rejects.toThrow("panne");
    expect(await ProcessedEvent.countDocuments()).toBe(0);
    await wrapped(msg, { attempt: 2 });
    expect(handler).toHaveBeenCalledTimes(2);
    expect(await ProcessedEvent.countDocuments()).toBe(1);
  });

  it("distingue les consommateurs pour un même événement", async () => {
    const handler = vi.fn(async () => {});
    const msg = message("order.created", { orderId: "x" });
    await once("email", handler)(msg, {});
    await once("autre", handler)(msg, {});
    expect(handler).toHaveBeenCalledTimes(2);
  });
});

describe("Consommateur email", () => {
  it("envoie à l'adresse du compte l'email du statut porté par l'événement", async () => {
    const user = await createUser();
    const order = await createOrder(user);
    await handleEmailEvent(
      message("order.status_changed", { orderId: String(order._id), status: "validee" })
    );
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [email] = sendEmail.mock.calls[0];
    expect(email.to).toBe(user.email);
    expect(email.subject).toMatch(/confirmée/);
  });

  it("prévient l'administrateur d'une nouvelle commande", async () => {
    const order = await createOrder(await createUser());
    await handleEmailEvent(message("order.created", { orderId: String(order._id) }));
    expect(sendEmail.mock.calls[0][0].to).toBe("admin@test.local");
  });

  it("n'échoue pas pour une commande ou un compte supprimé", async () => {
    const missing = String(new mongoose.Types.ObjectId());
    await handleEmailEvent(message("order.created", { orderId: missing }));
    await handleEmailEvent(
      message("order.status_changed", { orderId: missing, status: "validee" })
    );
    await handleEmailEvent(message("user.password_changed", { userId: missing }));
    await handleEmailEvent(message("user.mfa_reset", { userId: "pas-un-identifiant" }));
    const order = await createOrder({ _id: new mongoose.Types.ObjectId() });
    await handleEmailEvent(
      message("order.status_changed", { orderId: String(order._id), status: "annulee" })
    );
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("ignore un type d'événement inconnu avec un avertissement", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(handleEmailEvent(message("vehicle.unknown", {}))).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("lève une erreur si l'envoi échoue alors que les emails sont configurés", async () => {
    const user = await createUser();
    sendEmail.mockResolvedValue(false);
    await expect(
      handleEmailEvent(message("user.mfa_enabled", { userId: String(user._id) }))
    ).rejects.toThrow(/non envoyé/);
  });

  it("ne lève pas si les emails ne sont pas configurés", async () => {
    const user = await createUser();
    state.enabled = false;
    sendEmail.mockResolvedValue(false);
    await handleEmailEvent(message("user.password_changed", { userId: String(user._id) }));
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
