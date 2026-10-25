// Inscription, connexion, sessions en cookies httpOnly
import { describe, expect, it, vi } from "vitest";
import RefreshToken from "../src/models/RefreshToken.js";
import User from "../src/models/User.js";
import {
  browser,
  cookieNames,
  createUser,
  loggedIn,
  PASSWORD,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const NEW_USER = {
  name: "Awa Koné",
  firstName: "Awa",
  lastName: "Koné",
  email: "Awa@Test.Local",
  phone: "07 12 34 56 78",
  address: "Cocody, Abidjan",
  password: PASSWORD,
};

describe("inscription", () => {
  it("crée le compte, ouvre la session en cookies httpOnly et ne renvoie aucun jeton", async () => {
    const res = await browser().post("/api/auth/register", NEW_USER);
    expect(res.status).toBe(201);
    expect(res.body.email).toBe("awa@test.local");
    expect(res.body.role).toBe("client");
    expect(JSON.stringify(res.body)).not.toMatch(/token|password/i);

    const cookies = res.headers["set-cookie"].join(";");
    expect(cookieNames(res)).toEqual(["gba_at", "gba_rt"]);
    expect(cookies).toMatch(/HttpOnly/);
    expect(cookies).toMatch(/SameSite=Strict/);
  });

  it("refuse un champ non prévu (tentative de se donner le rôle admin)", async () => {
    const res = await browser().post("/api/auth/register", { ...NEW_USER, role: "admin" });
    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  it("refuse un mot de passe faible ou publié, avec un message en français", async () => {
    for (const password of ["court1", "Password123", "Azerty123", "sanschiffre"]) {
      const res = await browser().post("/api/auth/register", { ...NEW_USER, password });
      expect(res.status).toBe(400);
    }
    const weak = { ...NEW_USER, password: "Password123" };
    const res = await browser().post("/api/auth/register", weak);
    expect(res.body.message).toMatch(/trop connu/);
  });

  it("refuse un email déjà utilisé", async () => {
    await createUser({ email: "awa@test.local" });
    const res = await browser().post("/api/auth/register", NEW_USER);
    expect(res.status).toBe(409);
  });
});

describe("connexion", () => {
  it("donne le même message que le compte existe ou non (pas d'énumération)", async () => {
    const user = await createUser();
    const wrong = await browser().post("/api/auth/login", {
      email: user.email,
      password: "Mauvais99",
    });
    const unknown = await browser().post("/api/auth/login", {
      email: "x@test.local",
      password: "Mauvais99",
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it("verrouille le compte après 20 échecs, même avec le bon mot de passe ensuite", async () => {
    const user = await createUser();
    for (let i = 0; i < 20; i++) {
      await browser().post("/api/auth/login", { email: user.email, password: "Mauvais99" });
    }
    const res = await browser().post("/api/auth/login", { email: user.email, password: PASSWORD });
    expect(res.status).toBe(429);
  });

  it("bloque la connexion avec un mot de passe publié", async () => {
    const admin = await createUser({ role: "admin", password: "Password123" });
    const res = await browser().post("/api/auth/login", {
      email: admin.email,
      password: "Password123",
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/Mot de passe oublié/);
    expect(cookieNames(res)).not.toContain("gba_at");
  });

  it("n'accepte que le cookie : un jeton Authorization est ignoré", async () => {
    const res = await browser().agent.get("/api/auth/profile").set("Authorization", "Bearer abc");
    expect(res.status).toBe(401);
  });
});

describe("session", () => {
  it("la déconnexion révoque le jeton de renouvellement", async () => {
    const { client } = await loggedIn();
    expect((await client.get("/api/auth/profile")).status).toBe(200);
    expect((await client.post("/api/auth/logout")).status).toBe(204);
    expect((await client.post("/api/auth/refresh")).status).toBe(401);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
  });

  it("le renouvellement remplace le jeton (usage unique)", async () => {
    const { client } = await loggedIn();
    const res = await client.post("/api/auth/refresh");
    expect(res.status).toBe(204);
    expect(cookieNames(res)).toEqual(["gba_at", "gba_rt"]);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(1);
  });

  it("un jeton volé rejoué plus tard déconnecte toutes les sessions de la famille", async () => {
    const { client, refreshToken: stolen } = await loggedIn();
    await client.post("/api/auth/refresh");

    const later = Date.now() + 60_000;
    const spy = vi.spyOn(Date, "now").mockReturnValue(later);
    const replay = await browser()
      .agent.post("/api/auth/refresh")
      .set("X-Requested-With", "XMLHttpRequest")
      .set("Cookie", `gba_rt=${stolen}`);
    spy.mockRestore();

    expect(replay.status).toBe(401);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
  });

  it("deux onglets qui renouvellent en même temps ne sont pas pris pour un vol", async () => {
    const { client, refreshToken: token } = await loggedIn();
    await client.post("/api/auth/refresh");
    const secondTab = await browser()
      .agent.post("/api/auth/refresh")
      .set("X-Requested-With", "XMLHttpRequest")
      .set("Cookie", `gba_rt=${token}`);
    expect(secondTab.status).toBe(204);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(1);
  });
});
