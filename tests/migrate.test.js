// Migration des données de l'ancienne version (Stripe, statuts « en attente / payée »)
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { migrateOrders } from "../scripts/migrations/orders.js";
import { migrateRoles } from "../scripts/migrations/roles.js";
import { migrateVehicles } from "../scripts/migrations/vehicles.js";
import { raw, useDatabase } from "./helpers/app.js";

useDatabase();

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function seedLegacy() {
  const { db } = mongoose.connection;
  const user = await db
    .collection("users")
    .insertOne({ name: "Ancien Client", email: "ancien@test.local" });
  const vehicle = await db.collection("vehicles").insertOne({
    brand: "Peugeot",
    model: "208",
    price: 15_000,
    vin: "VF3XXXX",
    miles: 1200,
    image: `data:image/png;base64,${PNG}`,
  });
  await db.collection("orders").insertOne({
    user: user.insertedId,
    vehicles: [{ vehicle: vehicle.insertedId, quantity: 1 }],
    totalPrice: 45_000,
    status: "payée",
    paymentMethod: "stripe",
    paymentIntentId: "pi_123",
    createdAt: new Date(),
  });
  return { db, vehicleId: vehicle.insertedId };
}

describe("migration", () => {
  it("la simulation ne modifie rien", async () => {
    const { db } = await seedLegacy();
    expect(await migrateOrders(db, false)).toMatch(/^1 commande/);
    expect(await migrateVehicles(db, false)).toMatch(/1 photo/);
    expect((await db.collection("orders").findOne()).status).toBe("payée");
  });

  it("convertit les commandes au nouveau format, lisible par l'API", async () => {
    const { db } = await seedLegacy();
    await migrateOrders(db, true);
    const order = await db.collection("orders").findOne();
    expect(order.status).toBe("validee");
    expect(order.paymentMethod).toBe("on_delivery");
    expect(order.vehicleSnapshot.brand).toBe("Peugeot");
    expect(order.contact.email).toBe("ancien@test.local");
    expect(order).not.toHaveProperty("vehicles");
    expect(order).not.toHaveProperty("paymentIntentId");
  });

  it("déplace les photos base64 et retire les champs de l'ancien import", async () => {
    const { db, vehicleId } = await seedLegacy();
    await migrateVehicles(db, true);
    const vehicle = await db.collection("vehicles").findOne({ _id: vehicleId });
    expect(vehicle.gallery).toHaveLength(1);
    expect(vehicle).not.toHaveProperty("image");
    expect(vehicle).not.toHaveProperty("imageData");
    expect(vehicle).not.toHaveProperty("vin");
    expect(vehicle).not.toHaveProperty("miles");

    const list = await raw().get("/api/vehicles");
    expect(JSON.stringify(list.body)).not.toContain(PNG);
    expect((await raw().get(list.body.vehicles[0].image)).status).toBe(200);
  });

  it("garde les images https existantes (affichées) au lieu de les retirer", async () => {
    const { db } = mongoose.connection;
    const { insertedId } = await db.collection("vehicles").insertOne({
      brand: "Kia",
      model: "Rio",
      price: 10_000,
      image: "https://images.unsplash.com/photo-1.jpg",
      photos: ["https://images.unsplash.com/photo-2.jpg", "javascript:alert(1)"],
    });
    expect(await migrateVehicles(db, false)).toMatch(/1 véhicule\(s\) gardant/);
    await migrateVehicles(db, true);
    const vehicle = await db.collection("vehicles").findOne({ _id: insertedId });
    expect(vehicle.legacyImages).toEqual([
      "https://images.unsplash.com/photo-1.jpg",
      "https://images.unsplash.com/photo-2.jpg",
    ]);
    expect(vehicle.type).toBe("thermal");
    const { body } = await raw().get(`/api/vehicles/${insertedId}`);
    expect(body.image).toBe("https://images.unsplash.com/photo-1.jpg");
  });

  it("peut être relancée sans rien casser", async () => {
    const { db } = await seedLegacy();
    await migrateOrders(db, true);
    await migrateVehicles(db, true);
    expect(await migrateOrders(db, true)).toMatch(/^0 commande/);
    expect(await migrateVehicles(db, true)).toMatch(/0 photo/);
  });

  it("convertit les rôles : admin -> superadmin, user -> client (relançable)", async () => {
    const { db } = mongoose.connection;
    await db.collection("users").insertMany([
      { name: "A", email: "a@test.local", role: "admin" },
      { name: "B", email: "b@test.local", role: "user" },
    ]);
    expect(await migrateRoles(db, false)).toMatch(/^1 admin/);
    await migrateRoles(db, true);
    const roles = (await db.collection("users").find().toArray()).map((user) => user.role);
    expect(roles.sort()).toEqual(["client", "superadmin"]);
    expect(await migrateRoles(db, true)).toMatch(/^0 admin/);
  });
});
