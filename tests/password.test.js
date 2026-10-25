// Changement et réinitialisation du mot de passe
import { describe, expect, it } from "vitest";
import User from "../src/models/User.js";
import { hashToken } from "../src/services/tokens.js";
import { browser, createUser, loggedIn, PASSWORD, useDatabase } from "./helpers/app.js";

useDatabase();

const NEW_PASSWORD = "NouveauSecret2026";
const RESET_TOKEN = "a".repeat(43);

async function prepareReset(user, expiresInMs = 30 * 60 * 1000) {
  await User.updateOne(
    { _id: user._id },
    { resetPasswordHash: hashToken(RESET_TOKEN), resetPasswordExpires: Date.now() + expiresInMs }
  );
}

describe("changement depuis le profil", () => {
  it("exige le mot de passe actuel", async () => {
    const { client } = await loggedIn();
    const res = await client.put("/api/auth/password", {
      currentPassword: "Mauvais99",
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(400);
  });

  it("ferme les autres sessions mais garde celle en cours", async () => {
    const { client, user } = await loggedIn();
    const otherDevice = browser();
    await otherDevice.post("/api/auth/login", { email: user.email, password: PASSWORD });

    const res = await client.put("/api/auth/password", {
      currentPassword: PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect((await client.get("/api/auth/profile")).status).toBe(200);
    expect((await otherDevice.post("/api/auth/refresh")).status).toBe(401);
  });
});

describe("mot de passe oublié", () => {
  it("répond la même chose que le compte existe ou non", async () => {
    const user = await createUser();
    const known = await browser().post("/api/auth/forgot-password", { email: user.email });
    const unknown = await browser().post("/api/auth/forgot-password", { email: "x@test.local" });
    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it("ne stocke que le hash du jeton de réinitialisation", async () => {
    const user = await createUser();
    await browser().post("/api/auth/forgot-password", { email: user.email });
    // Le lien est préparé en arrière-plan, juste après la réponse
    let saved;
    for (let i = 0; i < 50 && !saved?.resetPasswordHash; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      saved = await User.findById(user._id).select("+resetPasswordHash");
    }
    expect(saved.resetPasswordHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("réinitialisation", () => {
  it("change le mot de passe, ne sert qu'une fois et ferme toutes les sessions", async () => {
    const { client, user } = await loggedIn();
    await prepareReset(user);

    const body = { token: RESET_TOKEN, password: NEW_PASSWORD };
    expect((await browser().post("/api/auth/reset-password", body)).status).toBe(200);
    expect((await browser().post("/api/auth/reset-password", body)).status).toBe(400);

    // L'ancien cookie d'accès est refusé (émis avant le changement)
    expect((await client.get("/api/auth/profile")).status).toBe(401);
    const login = await browser().post("/api/auth/login", {
      email: user.email,
      password: NEW_PASSWORD,
    });
    expect(login.status).toBe(200);
  });

  it("refuse un lien expiré", async () => {
    const user = await createUser();
    await prepareReset(user, -1000);
    const res = await browser().post("/api/auth/reset-password", {
      token: RESET_TOKEN,
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(400);
  });

  it("débloque un compte verrouillé", async () => {
    const user = await createUser();
    await User.updateOne({ _id: user._id }, { lockUntil: Date.now() + 600_000 });
    await prepareReset(user);
    await browser().post("/api/auth/reset-password", {
      token: RESET_TOKEN,
      password: NEW_PASSWORD,
    });
    const login = await browser().post("/api/auth/login", {
      email: user.email,
      password: NEW_PASSWORD,
    });
    expect(login.status).toBe(200);
  });

  it("invitation : le lien reçu permet de choisir son mot de passe puis de se connecter", async () => {
    const user = await createUser({ role: "gestionnaire", passwordSetupRequired: true });
    await prepareReset(user, 72 * 3600 * 1000);
    const res = await browser().post("/api/auth/reset-password", {
      token: RESET_TOKEN,
      password: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);
    expect((await User.findById(user._id)).passwordSetupRequired).toBe(false);
    const login = await browser().post("/api/auth/login", {
      email: user.email,
      password: NEW_PASSWORD,
    });
    expect(login.status).toBe(200);
  });
});
