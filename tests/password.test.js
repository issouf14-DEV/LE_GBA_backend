// Mot de passe : changement depuis le profil, code « mot de passe oublié », invitation
import { describe, expect, it } from "vitest";
import User from "../src/models/User.js";
import { hashResetCode } from "../src/services/resetCode.js";
import { hashToken } from "../src/services/tokens.js";
import { browser, createUser, loggedIn, PASSWORD, useDatabase } from "./helpers/app.js";

useDatabase();

const NEW_PASSWORD = "NouveauSecret2026";
const CODE = "ABCD2345";

async function prepareCode(user, { expiresInMs = 30_000, attempts = 0 } = {}) {
  await User.updateOne(
    { _id: user._id },
    {
      resetCodeHash: hashResetCode(user.email, CODE),
      resetCodeExpires: Date.now() + expiresInMs,
      resetAttempts: attempts,
    }
  );
}
const reset = (user, code = CODE) =>
  browser().post("/api/auth/reset-password", { email: user.email, code, password: NEW_PASSWORD });
const login = (user, password = NEW_PASSWORD) =>
  browser().post("/api/auth/login", { email: user.email, password });

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

describe("mot de passe oublié (code par email)", () => {
  it("même réponse que le compte existe ou non, avec la durée du code", async () => {
    const user = await createUser();
    const known = await browser().post("/api/auth/forgot-password", { email: user.email });
    const unknown = await browser().post("/api/auth/forgot-password", { email: "x@test.local" });
    expect(known.body).toEqual(unknown.body);
    expect(known.body.expiresIn).toBe(30);
  });

  it("ne stocke que l'empreinte du code, valable 30 secondes", async () => {
    const user = await createUser();
    await browser().post("/api/auth/forgot-password", { email: user.email });
    let saved;
    for (let i = 0; i < 50 && !saved?.resetCodeHash; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      saved = await User.findById(user._id).select("+resetCodeHash +resetCodeExpires");
    }
    expect(saved.resetCodeHash).toMatch(/^[a-f0-9]{64}$/);
    const remaining = saved.resetCodeExpires.getTime() - Date.now();
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(30_000);
  });

  it("le bon code change le mot de passe, une seule fois, et ferme les sessions", async () => {
    const { client, user } = await loggedIn();
    await prepareCode(user);
    expect((await reset(user, "abcd-2345")).status).toBe(200);
    expect((await reset(user)).status).toBe(400);
    expect((await client.get("/api/auth/profile")).status).toBe(401);
    expect((await login(user)).status).toBe(200);
  });

  it("refuse un code expiré, un code faux, et le code d'un autre compte", async () => {
    const user = await createUser();
    const other = await createUser();
    await prepareCode(user, { expiresInMs: -1000 });
    expect((await reset(user)).status).toBe(400);
    await prepareCode(user);
    expect((await reset(user, "ZZZZ9999")).status).toBe(400);
    expect((await reset(other)).status).toBe(400);
  });

  it("5 essais maximum, même en parallèle : le bon code est ensuite refusé", async () => {
    const user = await createUser();
    await prepareCode(user);
    const attempts = await Promise.all(Array.from({ length: 7 }, () => reset(user, "WXYZ6789")));
    expect(attempts.every((res) => res.status === 400)).toBe(true);
    expect((await User.findById(user._id).select("+resetAttempts")).resetAttempts).toBe(5);
    expect((await reset(user)).status).toBe(400);
  });

  it("refuse un code au mauvais format sans toucher au compteur", async () => {
    const user = await createUser();
    await prepareCode(user);
    expect((await reset(user, "<script>")).status).toBe(400);
    expect((await User.findById(user._id).select("+resetAttempts")).resetAttempts).toBe(0);
  });

  it("débloque un compte verrouillé", async () => {
    const user = await createUser();
    await User.updateOne({ _id: user._id }, { lockUntil: Date.now() + 600_000 });
    await prepareCode(user);
    await reset(user);
    expect((await login(user)).status).toBe(200);
  });
});

describe("invitation", () => {
  it("le lien d'invitation active le compte une seule fois", async () => {
    const token = "a".repeat(43);
    const user = await createUser({ role: "gestionnaire", passwordSetupRequired: true });
    await User.updateOne(
      { _id: user._id },
      { inviteHash: hashToken(token), inviteExpires: Date.now() + 72 * 3600 * 1000 }
    );
    const body = { token, password: NEW_PASSWORD };
    expect((await browser().post("/api/auth/accept-invitation", body)).status).toBe(200);
    expect((await browser().post("/api/auth/accept-invitation", body)).status).toBe(400);
    expect((await User.findById(user._id)).passwordSetupRequired).toBe(false);
    expect((await login(user)).status).toBe(200);
  });
});
