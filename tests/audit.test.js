// Corrections issues du contre-audit de sécurité
import { gzipSync } from "node:zlib";
import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import User from "../src/models/User.js";
import { browser, createUser, loggedIn, PASSWORD, raw, useDatabase, XHR } from "./helpers/app.js";

useDatabase();

describe("déni de service par le corps de requête (E1)", () => {
  it("un JSON imbriqué sur des milliers de niveaux est refusé sans faire tomber le serveur", async () => {
    const deep = `${"[".repeat(20_000)}${"]".repeat(20_000)}`;
    const res = await raw()
      .post("/api/auth/login")
      .set(XHR)
      .set("Content-Type", "application/json")
      .send(deep);
    expect(res.status).toBe(400);
    expect((await raw().get("/health")).status).toBe(200);
  });

  it("un corps compressé (gzip) est refusé sans être décompressé", async () => {
    const res = await raw()
      .post("/api/auth/login")
      .set(XHR)
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "gzip")
      .send(gzipSync(JSON.stringify({ email: "a@test.local", password: "x" })));
    expect(res.status).toBe(415);
  });

  it("un appel anonyme n'est jamais lu jusqu'à 3 Mo : le contrôle anti-CSRF passe avant", async () => {
    // Le serveur répond 403 sans lire le corps puis ferme la connexion : selon le moment, le
    // client voit le 403 ou une connexion coupée (ECONNRESET / EPIPE). Les deux prouvent le refus.
    const outcome = await raw()
      .post("/api/vehicles")
      .send({ image: "x".repeat(2_000_000) })
      .then((res) => res.status)
      .catch((error) => error.code);
    expect([403, "ECONNRESET", "EPIPE"]).toContain(outcome);
  });
});

describe("sessions (F6)", () => {
  it("la déconnexion coupe immédiatement le jeton d'accès", async () => {
    const { client, accessToken: copied } = await loggedIn();
    const withCopy = () => raw().get("/api/auth/profile").set("Cookie", `gba_at=${copied}`);
    expect((await withCopy()).status).toBe(200);
    await client.post("/api/auth/logout");
    // Le cookie d'accès copié avant la déconnexion (vol) est refusé tout de suite
    expect((await withCopy()).status).toBe(401);
  });
});

describe("mots de passe (F2, F5)", () => {
  it("refuse un mot de passe de plus de 72 octets (bcrypt l'aurait tronqué)", async () => {
    const res = await browser().post("/api/auth/register", {
      name: "A B",
      firstName: "A",
      lastName: "B",
      email: "long@test.local",
      password: `${"é".repeat(40)}1a`,
    });
    expect(res.status).toBe(400);
  });

  it("re-chiffre au coût 12 un mot de passe de l'ancienne version (coût 10)", async () => {
    const user = await createUser();
    await User.updateOne({ _id: user._id }, { password: await bcrypt.hash(PASSWORD, 10) });
    await browser().post("/api/auth/login", { email: user.email, password: PASSWORD });
    const saved = await User.findById(user._id).select("+password");
    expect(bcrypt.getRounds(saved.password)).toBe(12);
  });

  it("les échecs de plus de 15 minutes sont oubliés (pas de verrou cumulatif)", async () => {
    const user = await createUser();
    await User.updateOne(
      { _id: user._id },
      { failedLogins: 19, lastFailedLogin: new Date(Date.now() - 20 * 60 * 1000) }
    );
    await browser().post("/api/auth/login", { email: user.email, password: "Mauvais99" });
    const res = await browser().post("/api/auth/login", { email: user.email, password: PASSWORD });
    expect(res.status).toBe(200);
  });
});
