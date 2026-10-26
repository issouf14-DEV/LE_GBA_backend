// Journal d'audit : consultation réservée à audit.read, filtres validés, adresses tronquées
import { describe, expect, it } from "vitest";
import AuditLog from "../src/models/AuditLog.js";
import { anonymizeIp } from "../src/utils/anonymizeIp.js";
import {
  browser,
  createUser,
  loggedIn,
  loggedInManager,
  loggedInSuperadmin,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const at = (day) => new Date(`2026-03-${day}T12:00:00.000Z`);

// Entrées écrites directement (dates choisies) : la connexion de test en ajoute une autre
async function seed(actor, target) {
  await AuditLog.collection.deleteMany({});
  await AuditLog.collection.insertMany([
    { action: "vehicle.created", actor: actor._id, targetType: "vehicle", createdAt: at("01") },
    { action: "vehicle.deleted", actor: actor._id, targetType: "vehicle", createdAt: at("05") },
    {
      action: "account.disabled",
      actor: target._id,
      targetType: "user",
      targetId: target._id,
      meta: { role: "client" },
      createdAt: at("10"),
    },
  ]);
}

describe("accès au journal", () => {
  it("réservé à la permission audit.read", async () => {
    expect((await browser().get("/api/admin/audit")).status).toBe(401);
    const { client } = await loggedIn();
    expect((await client.get("/api/admin/audit")).status).toBe(403);
    const { client: other } = await loggedInManager(["stats.read", "clients.manage"]);
    expect((await other.get("/api/admin/audit")).status).toBe(403);
    const { client: reader } = await loggedInManager(["audit.read"]);
    expect((await reader.get("/api/admin/audit")).status).toBe(200);
  });

  it("aucune route d'écriture ou de suppression", async () => {
    const { client } = await loggedInSuperadmin();
    expect((await client.post("/api/admin/audit", {})).status).toBe(404);
    expect((await client.delete("/api/admin/audit")).status).toBe(404);
  });
});

describe("liste et filtres", () => {
  it("du plus récent au plus ancien, avec le nom et l'email des comptes", async () => {
    const { client, user } = await loggedInSuperadmin();
    const target = await createUser({ name: "Awa Cible" });
    await seed(user, target);
    const { body } = await client.get("/api/admin/audit");
    expect(body.total).toBe(3);
    expect(body.entries.map((entry) => entry.action)).toEqual([
      "account.disabled",
      "vehicle.deleted",
      "vehicle.created",
    ]);
    expect(body.entries[1].actor).toEqual({
      id: String(user._id),
      name: user.name,
      email: user.email,
    });
    expect(body.entries[0].target.name).toBe("Awa Cible");
    expect(JSON.stringify(body)).not.toMatch(/password|tokenVersion|mfa/);
  });

  it("filtre par action, acteur, type de cible et période ; pagine", async () => {
    const { client, user } = await loggedInSuperadmin();
    const target = await createUser();
    await seed(user, target);
    const get = async (query) => (await client.get(`/api/admin/audit?${query}`)).body;
    expect((await get("action=vehicle.deleted")).total).toBe(1);
    expect((await get(`actor=${target._id}`)).entries[0].action).toBe("account.disabled");
    expect((await get("targetType=vehicle")).total).toBe(2);
    expect((await get("from=2026-03-05&to=2026-03-05")).entries[0].action).toBe("vehicle.deleted");
    expect((await get("from=2026-03-02")).total).toBe(2);
    const page = await get("limit=2&page=2");
    expect(page).toMatchObject({ total: 3, page: 2, totalPages: 2 });
    expect(page.entries).toHaveLength(1);
  });

  it("refuse les filtres invalides ou piégés", async () => {
    const { client } = await loggedInSuperadmin();
    for (const query of [
      "action=hack",
      "limit=101",
      "actor=abc",
      "targetType=payment",
      "from=2026-03-10&to=2026-03-01",
      "from=2026-02-30",
      "inconnu=1",
      "action[$ne]=x",
    ]) {
      expect((await client.get(`/api/admin/audit?${query}`)).status, query).toBe(400);
    }
  });
});

describe("adresses IP tronquées", () => {
  it("IPv4 sans le dernier octet, IPv6 réduite à /48", () => {
    expect(anonymizeIp("203.0.113.42")).toBe("203.0.113.0");
    expect(anonymizeIp("::ffff:203.0.113.42")).toBe("203.0.113.0");
    expect(anonymizeIp("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd::/48");
    expect(anonymizeIp("2001:db8::1")).toBe("2001:db8:0::/48");
    expect(anonymizeIp("::1")).toBe("0:0:0::/48");
    expect(anonymizeIp("pas-une-ip")).toBeUndefined();
  });

  it("l'entrée écrite ne garde qu'une adresse tronquée et un navigateur court", async () => {
    await loggedInSuperadmin();
    const [entry] = await AuditLog.find({ action: "auth.login_succeeded" }).lean();
    expect(entry.ip).toMatch(/(\.0|::\/48)$/);
    expect((entry.userAgent ?? "").length).toBeLessThanOrEqual(120);
  });
});
