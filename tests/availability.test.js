// Calendrier de disponibilité : réservations prises en compte, confidentialité, limites
import { afterAll, describe, expect, it } from "vitest";
import Order from "../src/models/Order.js";
import { createUser, createVehicle, inDays, raw, useDatabase } from "./helpers/app.js";

useDatabase();

const d = (value) => new Date(`${value}T00:00:00Z`);
const HOURS = 3_600_000;

const CONTACT = {
  fullName: "Awa Koné",
  email: "awa@test.local",
  phone: "07 12 34 56 78",
  address: "Cocody, Abidjan",
};

async function book(vehicle, start, end, { status = "validee", createdAt } = {}) {
  const user = await createUser();
  const order = await Order.create({
    user: user._id,
    vehicle: vehicle._id,
    startDate: d(inDays(start)),
    endDate: d(inDays(end)),
    days: end - start,
    pricePerDay: 1000,
    totalPrice: 1000 * (end - start),
    contact: CONTACT,
    status,
  });
  if (createdAt) await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt } });
  return order;
}

const availability = (vehicle, query = "") =>
  raw().get(`/api/vehicles/${vehicle._id}/availability${query}`);

describe("GET /api/vehicles/:id/availability", () => {
  it("renvoie les périodes occupées fusionnées, sans donnée personnelle", async () => {
    const vehicle = await createVehicle();
    await book(vehicle, 2, 5);
    await book(vehicle, 5, 7, { status: "en_attente" });
    await book(vehicle, 20, 22);
    const res = await availability(vehicle);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
    expect(res.body.periods).toEqual([
      { start: inDays(2), end: inDays(6) },
      { start: inDays(20), end: inDays(21) },
    ]);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/awa|Koné|_id|user|contact|status/i);
  });

  it("ignore les demandes expirées (plus de 48 h), refusées, annulées et terminées", async () => {
    const vehicle = await createVehicle();
    await book(vehicle, 2, 4, {
      status: "en_attente",
      createdAt: new Date(Date.now() - 49 * HOURS),
    });
    await book(vehicle, 5, 6, { status: "rejetee" });
    await book(vehicle, 7, 8, { status: "annulee" });
    await book(vehicle, 9, 10, { status: "terminee" });
    await book(vehicle, 11, 12, { status: "en_attente", createdAt: new Date(Date.now() - HOURS) });
    const res = await availability(vehicle);
    expect(res.body.periods).toEqual([{ start: inDays(11), end: inDays(11) }]);
  });

  it("une location validée déjà terminée dans le temps ne bloque plus", async () => {
    const vehicle = await createVehicle();
    await book(vehicle, -5, -1);
    await book(vehicle, -2, 3);
    const res = await availability(vehicle);
    expect(res.body.periods).toEqual([{ start: inDays(0), end: inDays(2) }]);
  });

  it("ne mélange pas les véhicules et respecte la plage demandée", async () => {
    const vehicle = await createVehicle();
    const other = await createVehicle();
    await book(other, 2, 5);
    await book(vehicle, 10, 30);
    const res = await availability(vehicle, `?from=${inDays(15)}&to=${inDays(20)}`);
    expect(res.body).toEqual({
      from: inDays(15),
      to: inDays(20),
      periods: [{ start: inDays(15), end: inDays(20) }],
    });
  });

  it("véhicule inexistant : 404 ; paramètres invalides ou inconnus : 400", async () => {
    expect((await raw().get("/api/vehicles/507f1f77bcf86cd799439011/availability")).status).toBe(
      404
    );
    expect((await raw().get("/api/vehicles/abc/availability")).status).toBe(400);
    const vehicle = await createVehicle();
    expect((await availability(vehicle, "?from=2026-02-31")).status).toBe(400);
    expect((await availability(vehicle, "?status=validee")).status).toBe(400);
    expect((await availability(vehicle, `?from=${inDays(1)}&to=${inDays(120)}`)).status).toBe(400);
    expect((await availability(vehicle, "?from[$gt]=2026-01-01")).status).toBe(400);
  });
});

describe("limite de requêtes dédiée", () => {
  afterAll(() => {
    delete process.env.TEST_RATE_LIMITS;
  });

  it("annonce sa propre limite de 120 consultations par quart d'heure", async () => {
    process.env.TEST_RATE_LIMITS = "1";
    const vehicle = await createVehicle();
    const res = await availability(vehicle);
    expect(res.status).toBe(200);
    expect(String(res.headers["ratelimit-policy"])).toMatch(/q=120/);
  });
});
