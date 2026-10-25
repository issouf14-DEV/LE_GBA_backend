// Gestion de l'équipe par le superadmin : invitations, permissions, protections
import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS } from "../src/config/permissions.js";
import User from "../src/models/User.js";
import {
  browser,
  createUser,
  loggedIn,
  loggedInManager,
  loggedInSuperadmin,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const MANAGER = { name: "Koffi Yao", email: "koffi@test.local", phone: "" };

describe("invitation d'un gestionnaire", () => {
  it("crée le compte avec les permissions choisies (impliquées ajoutées), sans mot de passe", async () => {
    const { client } = await loggedInSuperadmin();
    const res = await client.post("/api/team", { ...MANAGER, permissions: ["orders.manage"] });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("gestionnaire");
    expect(res.body.permissions).toEqual(["orders.read", "orders.manage"]);
    const saved = await User.findOne({ email: MANAGER.email }).select("+resetPasswordHash");
    expect(saved.passwordSetupRequired).toBe(true);
    expect(saved.resetPasswordHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("refuse une permission inconnue et un rôle fourni par le navigateur", async () => {
    const { client } = await loggedInSuperadmin();
    const unknown = await client.post("/api/team", { ...MANAGER, permissions: ["users.root"] });
    expect(unknown.status).toBe(400);
    const withRole = await client.post("/api/team", { ...MANAGER, role: "superadmin" });
    expect(withRole.status).toBe(400);
  });

  it("le catalogue des permissions est fourni au superadmin", async () => {
    const { client } = await loggedInSuperadmin();
    const { body } = await client.get("/api/team/permissions");
    expect(body.permissions.map((item) => item.key)).toEqual(PERMISSION_KEYS);
  });
});

describe("accorder et retirer des droits", () => {
  it("un droit retiré prend effet immédiatement, sans nouvelle connexion", async () => {
    const { client: admin } = await loggedInSuperadmin();
    const { client, user } = await loggedInManager(["stats.read"]);
    expect((await client.get("/api/admin/stats")).status).toBe(200);

    const res = await admin.put(`/api/team/${user._id}/permissions`, { permissions: [] });
    expect(res.status).toBe(200);
    expect((await client.get("/api/admin/stats")).status).toBe(403);

    await admin.put(`/api/team/${user._id}/permissions`, { permissions: ["stats.read"] });
    expect((await client.get("/api/admin/stats")).status).toBe(200);
  });

  it("désactiver un gestionnaire le déconnecte partout", async () => {
    const { client: admin } = await loggedInSuperadmin();
    const { client, user } = await loggedInManager(["stats.read"]);
    await admin.patch(`/api/team/${user._id}/status`, { disabled: true });
    expect((await client.get("/api/auth/profile")).status).toBe(401);
  });
});

describe("protections", () => {
  it("un gestionnaire, même avec toutes les permissions, n'accède pas à l'équipe", async () => {
    const { client } = await loggedInManager(PERMISSION_KEYS);
    expect((await client.get("/api/team")).status).toBe(403);
    expect((await client.post("/api/team", MANAGER)).status).toBe(403);
  });

  it("un client n'accède pas à l'équipe", async () => {
    const { client } = await loggedIn();
    expect((await client.get("/api/team")).status).toBe(403);
  });

  it("le superadmin ne peut ni modifier ni supprimer un superadmin, ni lui-même", async () => {
    const { client, user } = await loggedInSuperadmin();
    const other = await createUser({ role: "superadmin" });
    for (const target of [user, other]) {
      expect((await client.delete(`/api/team/${target._id}`)).status).not.toBe(204);
      const res = await client.put(`/api/team/${target._id}/permissions`, { permissions: [] });
      expect(res.status).not.toBe(200);
    }
    expect(await User.countDocuments({ role: "superadmin" })).toBe(2);
  });

  it("un compte client n'est pas modifiable par les routes de l'équipe", async () => {
    const { client } = await loggedInSuperadmin();
    const customer = await createUser();
    expect((await client.delete(`/api/team/${customer._id}`)).status).toBe(404);
  });

  it("personne ne peut se donner un rôle ou des permissions via son profil", async () => {
    const { client } = await loggedInManager([]);
    const res = await client.put("/api/auth/profile", {
      name: "A B",
      firstName: "A",
      lastName: "B",
      permissions: PERMISSION_KEYS,
    });
    expect(res.status).toBe(400);
    const register = await browser().post("/api/auth/register", { role: "superadmin" });
    expect(register.status).toBe(400);
  });
});
