// Vérification de l'adresse email des clients : code par email, obligatoire pour réserver
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";
import { migrateEmailVerified } from "../scripts/migrations/emailVerified.js";
import User from "../src/models/User.js";
import { hashEmailCode } from "../src/services/emailVerification.js";
import { browser, createUser, createVehicle, inDays, login, useDatabase } from "./helpers/app.js";

useDatabase();

const CODE = "ABCD2345";

async function unverifiedClient({ expiresInMs = 900_000, attempts = 0 } = {}) {
  const user = await createUser({ emailVerifiedAt: undefined });
  await User.updateOne(
    { _id: user._id },
    {
      $unset: { emailVerifiedAt: "" },
      emailCodeHash: hashEmailCode(user.email, CODE),
      emailCodeExpires: new Date(Date.now() + expiresInMs),
      emailCodeAttempts: attempts,
    }
  );
  const client = browser();
  await login(client, user);
  return { client, user };
}

const book = async (client) => {
  const vehicle = await createVehicle();
  return client.post("/api/orders", {
    vehicleId: String(vehicle._id),
    startDate: inDays(3),
    endDate: inDays(5),
    contact: {
      fullName: "Awa Koné",
      email: "awa@test.local",
      phone: "07 12 34 56 78",
      address: "Cocody, Abidjan",
    },
    notes: "",
  });
};

describe("vérification de l'email", () => {
  it("à l'inscription : adresse non vérifiée, code stocké seulement sous forme d'empreinte", async () => {
    const client = browser();
    const res = await client.post("/api/auth/register", {
      name: "Nouveau Client",
      firstName: "Nouveau",
      lastName: "Client",
      email: "nouveau@test.local",
      password: "MotDePasse2026",
    });
    expect(res.status).toBe(201);
    expect(res.body.emailVerified).toBe(false);
    const saved = await User.findOne({ email: "nouveau@test.local" }).select("+emailCodeHash");
    expect(saved.emailCodeHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("pas de réservation avant la vérification, puis réservation possible", async () => {
    const { client } = await unverifiedClient();
    const refused = await book(client);
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/Confirmez votre adresse email/);

    const res = await client.post("/api/auth/verify-email", { code: "abcd-2345" });
    expect(res.status).toBe(200);
    expect(res.body.emailVerified).toBe(true);
    expect((await book(client)).status).toBe(201);
  });

  it("refuse un code faux, expiré, ou après 5 essais", async () => {
    const expired = await unverifiedClient({ expiresInMs: -1000 });
    expect((await expired.client.post("/api/auth/verify-email", { code: CODE })).status).toBe(400);

    const { client, user } = await unverifiedClient();
    const wrong = await Promise.all(
      Array.from({ length: 6 }, () => client.post("/api/auth/verify-email", { code: "WXYZ6789" }))
    );
    expect(wrong.every((res) => res.status === 400)).toBe(true);
    expect((await User.findById(user._id).select("+emailCodeAttempts")).emailCodeAttempts).toBe(5);
    expect((await client.post("/api/auth/verify-email", { code: CODE })).status).toBe(400);
  });

  it("un nouveau code annule le précédent", async () => {
    const { client } = await unverifiedClient();
    expect((await client.post("/api/auth/verify-email/resend")).status).toBe(204);
    expect((await client.post("/api/auth/verify-email", { code: CODE })).status).toBe(400);
  });

  it("une adresse déjà vérifiée ne reçoit plus de code", async () => {
    const user = await createUser();
    const client = browser();
    await login(client, user);
    expect((await client.post("/api/auth/verify-email/resend")).status).toBe(409);
  });

  it("migration : les comptes existants sont considérés comme vérifiés", async () => {
    const { db } = mongoose.connection;
    const createdAt = new Date("2025-01-01");
    await db.collection("users").insertOne({ email: "ancien@test.local", createdAt });
    expect(await migrateEmailVerified(db, false)).toMatch(/^1 compte/);
    await migrateEmailVerified(db, true);
    const saved = await db.collection("users").findOne({ email: "ancien@test.local" });
    expect(saved.emailVerifiedAt).toEqual(createdAt);
  });
});
