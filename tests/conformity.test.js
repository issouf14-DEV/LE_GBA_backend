// Corrections issues de l'audit de conformité frontend / backend
import { describe, expect, it } from "vitest";
import Order from "../src/models/Order.js";
import {
  createUser,
  createVehicle,
  inDays,
  loggedIn,
  loggedInSuperadmin,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const CONTACT = {
  fullName: "Awa Koné",
  email: "a@test.local",
  phone: "0712345678",
  address: "Cocody",
};
const orderFor = (user, vehicle, extra = {}) => ({
  user: user._id,
  vehicle: vehicle._id,
  startDate: inDays(2),
  endDate: inDays(4),
  days: 2,
  pricePerDay: 1000,
  totalPrice: 2000,
  contact: CONTACT,
  ...extra,
});

describe("suppression après une location", () => {
  it("une location validée déjà passée ne bloque plus la suppression du véhicule", async () => {
    const { client } = await loggedInSuperadmin();
    const vehicle = await createVehicle();
    const past = { status: "validee", startDate: inDays(-10), endDate: inDays(-5) };
    await Order.create(orderFor(await createUser(), vehicle, past));
    expect((await client.delete(`/api/vehicles/${vehicle._id}`)).status).toBe(204);
  });

  it("une location validée à venir bloque toujours la suppression", async () => {
    const { client } = await loggedInSuperadmin();
    const vehicle = await createVehicle();
    await Order.create(orderFor(await createUser(), vehicle, { status: "validee" }));
    expect((await client.delete(`/api/vehicles/${vehicle._id}`)).status).toBe(409);
  });
});

describe("réservations et emails", () => {
  it("6e demande en attente : 409 (règle métier, pas une limite de tentatives)", async () => {
    const { client, user } = await loggedIn();
    const vehicles = await Promise.all(Array.from({ length: 6 }, () => createVehicle()));
    await Order.insertMany(vehicles.slice(0, 5).map((vehicle) => orderFor(user, vehicle)));
    const res = await client.post("/api/orders", {
      vehicleId: String(vehicles[5]._id),
      startDate: inDays(2),
      endDate: inDays(3),
      contact: CONTACT,
      notes: "",
    });
    expect(res.status).toBe(409);
  });

  it("renvoi refusé pour une réservation en attente, 503 si l'email ne part pas", async () => {
    const { client, user } = await loggedIn();
    const vehicle = await createVehicle();
    const pending = await Order.create(orderFor(user, vehicle));
    expect((await client.post(`/api/orders/${pending._id}/resend-email`)).status).toBe(409);
    const validated = await Order.create(
      orderFor(user, vehicle, { status: "validee", startDate: inDays(10), endDate: inDays(12) })
    );
    // Aucun fournisseur d'email dans les tests : l'envoi échoue, l'utilisateur est prévenu
    expect((await client.post(`/api/orders/${validated._id}/resend-email`)).status).toBe(503);
  });

  it("un rappel de l'équipe qui n'a pas pu partir répond 503 (pas de faux succès)", async () => {
    const { client } = await loggedInSuperadmin();
    const order = await Order.create(orderFor(await createUser(), await createVehicle()));
    const res = await client.post(`/api/orders/${order._id}/send-payment-reminder`);
    expect(res.status).toBe(503);
  });

  it("l'annulation renvoie sa date (cancelledAt)", async () => {
    const { client, user } = await loggedIn();
    const order = await Order.create(orderFor(user, await createVehicle()));
    const res = await client.patch(`/api/orders/${order._id}/cancel`);
    expect(res.body.status).toBe("annulee");
    expect(res.body.cancelledAt).toBeTruthy();
  });
});

describe("comptes", () => {
  it("le tableau de bord compte les clients, pas l'équipe", async () => {
    const { client } = await loggedInSuperadmin();
    await createUser();
    await createUser({ role: "gestionnaire" });
    expect((await client.get("/api/admin/stats")).body.totalUsers).toBe(1);
  });

  it("un compte invité est signalé « invitation en attente »", async () => {
    const { client } = await loggedInSuperadmin();
    const res = await client.post("/api/team", { name: "Koffi Yao", email: "k@test.local" });
    expect(res.body.invitationPending).toBe(true);
  });
});
