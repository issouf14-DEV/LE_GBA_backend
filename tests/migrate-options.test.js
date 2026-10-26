// Options de suppression de la migration (définitives, seulement si demandées)
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { migrateRoles } from "../scripts/migrations/roles.js";
import { migrateVehicles } from "../scripts/migrations/vehicles.js";
import { useDatabase } from "./helpers/app.js";

useDatabase();

const db = () => mongoose.connection.db;

async function seed() {
  await db()
    .collection("users")
    .insertMany([
      { name: "Ancien admin 1", email: "a1@test.local", role: "admin" },
      { name: "Ancien admin 2", email: "a2@test.local", role: "admin" },
      { name: "Client", email: "c@test.local", role: "user" },
    ]);
  await db()
    .collection("vehicles")
    .insertMany([
      { brand: "Kia", model: "Rio", price: 1, image: "https://images.unsplash.com/a.jpg" },
      { brand: "Fiat", model: "500", price: 1, image: null, vin: "X" },
      { brand: "Seat", model: "Ibiza", price: 1, photos: [] },
    ]);
}

describe("options de suppression", () => {
  it("sans option, rien n'est supprimé", async () => {
    await seed();
    await migrateRoles(db(), true);
    await migrateVehicles(db(), true);
    expect(await db().collection("users").countDocuments()).toBe(3);
    expect(await db().collection("vehicles").countDocuments()).toBe(3);
  });

  it("la simulation annonce les suppressions sans rien supprimer", async () => {
    await seed();
    const roles = await migrateRoles(db(), false, { removeOldAdmins: true });
    const vehicles = await migrateVehicles(db(), false, { removeImageless: true });
    expect(roles).toMatch(/^2 ancien\(s\) administrateur\(s\) SUPPRIMÉ/);
    expect(vehicles).toMatch(/2 véhicule\(s\) sans image SUPPRIMÉ/);
    expect(await db().collection("users").countDocuments()).toBe(3);
    expect(await db().collection("vehicles").countDocuments()).toBe(3);
  });

  it("supprime les anciens admins et les véhicules sans image, garde le reste", async () => {
    await seed();
    await migrateRoles(db(), true, { removeOldAdmins: true });
    await migrateVehicles(db(), true, { removeImageless: true });

    const users = await db().collection("users").find().toArray();
    expect(users.map((user) => [user.email, user.role])).toEqual([["c@test.local", "client"]]);

    const vehicles = await db().collection("vehicles").find().toArray();
    expect(vehicles).toHaveLength(1);
    expect(vehicles[0].brand).toBe("Kia");
    expect(vehicles[0].type).toBe("thermal");
    expect(vehicles[0].legacyImages).toEqual(["https://images.unsplash.com/a.jpg"]);
  });

  it("ne supprime jamais un super-administrateur créé avec la nouvelle version", async () => {
    await seed();
    await db().collection("users").insertOne({ email: "chef@test.local", role: "superadmin" });
    await migrateRoles(db(), true, { removeOldAdmins: true });
    const emails = (await db().collection("users").find().toArray()).map((user) => user.email);
    expect(emails.sort()).toEqual(["c@test.local", "chef@test.local"]);
  });
});
