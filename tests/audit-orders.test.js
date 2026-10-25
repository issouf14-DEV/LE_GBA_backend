// Corrections du contre-audit : réservations fantômes, statuts concurrents, limites
import { afterAll, describe, expect, it } from "vitest";
import Order from "../src/models/Order.js";
import {
  browser,
  createUser,
  createVehicle,
  inDays,
  loggedIn,
  loggedInAdmin,
  PASSWORD,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const CONTACT = {
  fullName: "Awa Koné",
  email: "a@test.local",
  phone: "0712345678",
  address: "Cocody, Abidjan",
};
const order = (vehicle, start, end) => ({
  vehicleId: String(vehicle._id),
  startDate: inDays(start),
  endDate: inDays(end),
  contact: CONTACT,
  notes: "",
});

describe("réservations (M3, F3)", () => {
  it("refuse une réservation à plus de 180 jours", async () => {
    const { client } = await loggedIn();
    const vehicle = await createVehicle();
    expect((await client.post("/api/orders", order(vehicle, 200, 203))).status).toBe(400);
  });

  it("une demande sans réponse depuis 48 h ne bloque plus le véhicule", async () => {
    const { client, user } = await loggedIn();
    const vehicle = await createVehicle();
    const old = await Order.create({
      user: user._id,
      vehicle: vehicle._id,
      startDate: inDays(2),
      endDate: inDays(5),
      days: 3,
      pricePerDay: 1,
      totalPrice: 3,
      contact: CONTACT,
    });
    // createdAt est protégé par Mongoose : modifié directement dans MongoDB
    await Order.collection.updateOne(
      { _id: old._id },
      { $set: { createdAt: new Date(Date.now() - 49 * 3600 * 1000) } }
    );
    expect((await client.post("/api/orders", order(vehicle, 2, 5))).status).toBe(201);
    expect((await Order.findById(old._id)).status).toBe("annulee");
  });

  it("annulation client et validation admin simultanées : une seule gagne", async () => {
    const vehicle = await createVehicle();
    const { client } = await loggedIn();
    const { client: admin } = await loggedInAdmin();
    const created = (await client.post("/api/orders", order(vehicle, 2, 4))).body;
    const results = await Promise.all([
      client.patch(`/api/orders/${created._id}/cancel`),
      admin.patch(`/api/orders/${created._id}/status`, { status: "validee" }),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 409]);
  });
});

describe("limites de tentatives (M2)", () => {
  afterAll(() => {
    delete process.env.TEST_RATE_LIMITS;
  });

  it("une connexion réussie ne consomme pas d'essai", async () => {
    process.env.TEST_RATE_LIMITS = "1";
    const user = await createUser();
    for (let i = 0; i < 7; i++) {
      const res = await browser().post("/api/auth/login", {
        email: user.email,
        password: PASSWORD,
      });
      expect(res.status).toBe(200);
    }
  });
});
