// Attaques classiques : CSRF, origine pirate, injection NoSQL, faux jetons, abus de taille
import jwt from "jsonwebtoken";
import { afterAll, describe, expect, it } from "vitest";
import { createUser, PASSWORD, raw, useDatabase, XHR } from "./helpers/app.js";

useDatabase();

// Jeton « alg: none » fabriqué à la main (aucune signature)
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const unsigned = (payload) => `${b64({ alg: "none", typ: "JWT" })}.${b64(payload)}.`;

const login = (body, headers = XHR) => raw().post("/api/auth/login").set(headers).send(body);

describe("requêtes venant d'un autre site", () => {
  it("CSRF : une requête sans l'en-tête X-Requested-With est refusée", async () => {
    expect((await login({ email: "a@test.local", password: "x" }, {})).status).toBe(403);
  });

  it("une origine inconnue est refusée et ne reçoit aucune autorisation CORS", async () => {
    const res = await login({}, { ...XHR, Origin: "https://pirate.vercel.app" });
    expect(res.status).toBe(403);
    const preflight = await raw()
      .options("/api/auth/login")
      .set("Origin", "https://pirate.vercel.app")
      .set("Access-Control-Request-Method", "POST");
    expect(preflight.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("l'origine du site est acceptée", async () => {
    const res = await login(
      { email: "a@test.local", password: "x" },
      { ...XHR, Origin: "https://legba-zeta.vercel.app" }
    );
    expect(res.status).toBe(401);
    expect(res.headers["access-control-allow-origin"]).toBe("https://legba-zeta.vercel.app");
  });
});

describe("injections", () => {
  it("NoSQL : des opérateurs MongoDB à la place des valeurs sont refusés", async () => {
    await createUser();
    for (const body of [
      { email: { $ne: null }, password: { $ne: null } },
      { email: { $gt: "" }, password: PASSWORD },
    ]) {
      expect((await login(body)).status).toBe(400);
    }
  });

  it("NoSQL : une clé $where ajoutée au corps est supprimée avant tout traitement", async () => {
    const user = await createUser();
    const res = await login({ $where: "return true", email: user.email, password: "Mauvais99" });
    expect(res.status).toBe(401);
  });

  it("pollution de prototype : __proto__ dans le corps est ignoré", async () => {
    await login(JSON.parse('{"__proto__":{"isAdmin":true},"email":"a@test.local","password":"x"}'));
    expect({}.isAdmin).toBeUndefined();
  });
});

describe("faux jetons", () => {
  it("refuse un jeton non signé (alg: none), mal signé ou expiré", async () => {
    const user = await createUser();
    const sub = String(user._id);
    const tokens = [
      unsigned({ sub, ver: 0, iss: "le-gba", aud: "le-gba-web" }),
      jwt.sign({ sub, ver: 0 }, "autre-secret-0123456789-0123456789", {
        issuer: "le-gba",
        audience: "le-gba-web",
      }),
      jwt.sign({ sub, ver: 0 }, process.env.JWT_ACCESS_SECRET, {
        issuer: "le-gba",
        audience: "le-gba-web",
        expiresIn: -10,
      }),
    ];
    for (const token of tokens) {
      const res = await raw().get("/api/auth/profile").set("Cookie", `gba_at=${token}`);
      expect(res.status).toBe(401);
    }
  });
});

describe("abus et robustesse", () => {
  it("refuse un corps trop gros, un JSON cassé et une pagination excessive", async () => {
    expect((await login({ email: "x".repeat(200_000) })).status).toBe(413);
    const broken = await raw()
      .post("/api/auth/login")
      .set(XHR)
      .set("Content-Type", "application/json")
      .send('{"a":');
    expect(broken.status).toBe(400);
    expect((await raw().get("/api/vehicles?limit=100000")).status).toBe(400);
    expect((await raw().get("/api/vehicles/abc")).status).toBe(400);
  });

  it("les erreurs ne révèlent aucun détail technique, en français", async () => {
    const res = await login({ email: 42, password: "x" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/[éè]|attendu|invalide/i);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|mongo|node_modules/i);
  });

  it("envoie les en-têtes de sécurité et masque la technologie utilisée", async () => {
    const res = await raw().get("/health");
    expect(res.headers["strict-transport-security"]).toBeDefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("limites de tentatives", () => {
  afterAll(() => {
    delete process.env.TEST_RATE_LIMITS;
  });

  it("5 essais par compte, même en changeant d'adresse IP déclarée", async () => {
    process.env.TEST_RATE_LIMITS = "1";
    const user = await createUser();
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const res = await login(
        { email: user.email, password: "Mauvais99" },
        { ...XHR, "X-Forwarded-For": `10.0.0.${i}` }
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
