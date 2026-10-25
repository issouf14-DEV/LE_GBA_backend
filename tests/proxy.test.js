// Secret partagé avec le proxy Vercel : sans lui, l'API refuse les appels directs au serveur
import request from "supertest";
import { describe, expect, it } from "vitest";

const SECRET = "secret-du-proxy-vercel-0123456789-abcdef";
const PREVIOUS = "ancien-secret-du-proxy-0123456789-abcdefgh";
process.env.PROXY_SECRET = SECRET;
process.env.PROXY_SECRET_PREVIOUS = PREVIOUS;
// Import après la définition du secret (configuration lue au chargement)
const { default: app } = await import("../src/app.js");

describe("accès direct au serveur", () => {
  it("refuse un appel sans le secret du proxy, même avec une IP inventée", async () => {
    const res = await request(app).get("/api/vehicles/abc").set("X-Forwarded-For", "6.6.6.6");
    expect(res.status).toBe(403);
  });

  it("refuse un secret faux ou de longueur différente", async () => {
    for (const value of ["x", SECRET.replace("a", "b"), `${SECRET}!`]) {
      const res = await request(app).get("/api/vehicles/abc").set("X-Proxy-Auth", value);
      expect(res.status).toBe(403);
    }
  });

  it("accepte l'ancien secret pendant un changement de secret (pas de coupure)", async () => {
    const res = await request(app).get("/api/vehicles/abc").set("X-Proxy-Auth", PREVIOUS);
    expect(res.status).toBe(400);
  });

  it("laisse passer les appels du proxy et la vérification de santé de l'hébergeur", async () => {
    const res = await request(app).get("/api/vehicles/abc").set("X-Proxy-Auth", SECRET);
    expect(res.status).toBe(400);
    expect((await request(app).get("/health")).status).toBe(200);
  });
});
