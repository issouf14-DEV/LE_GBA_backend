// Réservations : prix calculé par le serveur, dates, doubles réservations, droits
import { describe, expect, it } from "vitest";
import Order from "../src/models/Order.js";
import {
  browser,
  createVehicle,
  inDays,
  loggedIn,
  loggedInAdmin,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const CONTACT = {
  fullName: "Awa Koné",
  email: "awa@test.local",
  phone: "07 12 34 56 78",
  address: "Cocody, Abidjan",
};
const orderFor = (vehicle, start = 2, end = 5) => ({
  vehicleId: String(vehicle._id),
  startDate: inDays(start),
  endDate: inDays(end),
  contact: CONTACT,
  notes: "",
});

describe("création", () => {
  it("calcule le prix sur le serveur (prix par jour x nombre de jours)", async () => {
    const { client } = await loggedIn();
    const vehicle = await createVehicle({ price: 30_000 });
    const res = await client.post("/api/orders", orderFor(vehicle, 2, 5));
    expect(res.status).toBe(201);
    expect(res.body.days).toBe(3);
    expect(res.body.totalPrice).toBe(90_000);
    expect(res.body.status).toBe("en_attente");
  });

  it("refuse un prix ou un statut envoyé par le navigateur", async () => {
    const { client } = await loggedIn();
    const vehicle = await createVehicle();
    for (const extra of [{ totalPrice: 1 }, { status: "validee" }]) {
      const res = await client.post("/api/orders", { ...orderFor(vehicle), ...extra });
      expect(res.status).toBe(400);
    }
    expect(await Order.countDocuments()).toBe(0);
  });

  it("refuse une date passée, une fin avant le début, une durée de plus de 90 jours", async () => {
    const { client } = await loggedIn();
    const vehicle = await createVehicle();
    for (const [start, end] of [
      [-2, 3],
      [5, 3],
      [1, 100],
    ]) {
      expect((await client.post("/api/orders", orderFor(vehicle, start, end))).status).toBe(400);
    }
  });

  it("refuse un véhicule indisponible", async () => {
    const { client } = await loggedIn();
    const vehicle = await createVehicle({ available: false });
    expect((await client.post("/api/orders", orderFor(vehicle))).status).toBe(409);
  });

  it("empêche deux réservations sur les mêmes dates, même envoyées au même instant", async () => {
    const vehicle = await createVehicle();
    const [{ client: a }, { client: b }] = await Promise.all([loggedIn(), loggedIn()]);
    const results = await Promise.all([
      a.post("/api/orders", orderFor(vehicle, 2, 6)),
      b.post("/api/orders", orderFor(vehicle, 4, 8)),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await Order.countDocuments()).toBe(1);
  });

  it("exige d'être connecté", async () => {
    const vehicle = await createVehicle();
    expect((await browser().post("/api/orders", orderFor(vehicle))).status).toBe(401);
  });
});

describe("accès aux réservations", () => {
  it("un client ne voit ni n'annule la réservation d'un autre (pas d'IDOR)", async () => {
    const vehicle = await createVehicle();
    const { client: owner } = await loggedIn();
    const { client: other } = await loggedIn();
    const order = (await owner.post("/api/orders", orderFor(vehicle))).body;

    expect((await other.get("/api/orders/mine")).body).toEqual([]);
    expect((await other.patch(`/api/orders/${order._id}/cancel`)).status).toBe(404);
    expect((await owner.patch(`/api/orders/${order._id}/cancel`)).status).toBe(200);
  });

  it("un client ne peut ni lister toutes les commandes ni changer un statut", async () => {
    const vehicle = await createVehicle();
    const { client } = await loggedIn();
    const order = (await client.post("/api/orders", orderFor(vehicle))).body;
    expect((await client.get("/api/orders")).status).toBe(403);
    const res = await client.patch(`/api/orders/${order._id}/status`, { status: "validee" });
    expect(res.status).toBe(403);
  });
});

describe("statuts (administration)", () => {
  it("n'accepte que les transitions prévues", async () => {
    const vehicle = await createVehicle();
    const { client } = await loggedIn();
    const { client: admin } = await loggedInAdmin();
    const order = (await client.post("/api/orders", orderFor(vehicle))).body;
    const setStatus = (status) => admin.patch(`/api/orders/${order._id}/status`, { status });

    expect((await setStatus("terminee")).status).toBe(409);
    expect((await setStatus("validee")).status).toBe(200);
    expect((await setStatus("terminee")).status).toBe(200);
    expect((await setStatus("annulee")).status).toBe(409);
  });

  it("le client ne peut plus annuler une réservation validée", async () => {
    const vehicle = await createVehicle();
    const { client } = await loggedIn();
    const { client: admin } = await loggedInAdmin();
    const order = (await client.post("/api/orders", orderFor(vehicle))).body;
    await admin.patch(`/api/orders/${order._id}/status`, { status: "validee" });
    expect((await client.patch(`/api/orders/${order._id}/cancel`)).status).toBe(409);
  });
});
