// Matrice des droits : chaque route protégée, pour chaque profil
import { describe, expect, it } from "vitest";
import { normalizePermissions } from "../src/config/permissions.js";
import {
  createUser,
  createVehicle,
  loggedIn,
  loggedInManager,
  loggedInSuperadmin,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const ID = "0123456789abcdef01234567";
// [méthode, route, permission exigée] — un corps invalide suffit : seuls 401/403 nous intéressent
const ROUTES = [
  ["get", "/api/admin/stats", "stats.read"],
  ["get", "/api/admin/clients", "clients.read"],
  ["post", "/api/admin/clients", "clients.manage"],
  ["delete", `/api/admin/clients/${ID}`, "clients.manage"],
  ["get", "/api/orders", "orders.read"],
  ["patch", `/api/orders/${ID}/status`, "orders.manage"],
  ["post", `/api/orders/${ID}/send-payment-reminder`, "orders.manage"],
  ["post", "/api/vehicles", "vehicles.manage"],
  ["delete", `/api/vehicles/${ID}`, "vehicles.manage"],
];

const call = (client, method, path) => client[method](path, {});

describe("matrice des droits", () => {
  it("un client reçoit 403 partout", async () => {
    const { client } = await loggedIn();
    for (const [method, path] of ROUTES) {
      expect((await call(client, method, path)).status, `${method} ${path}`).toBe(403);
    }
  });

  it("un gestionnaire sans permission reçoit 403 partout", async () => {
    const { client } = await loggedInManager([]);
    for (const [method, path] of ROUTES) {
      expect((await call(client, method, path)).status, `${method} ${path}`).toBe(403);
    }
  });

  it("chaque permission ouvre ses routes, et seulement elles", async () => {
    for (const permission of new Set(ROUTES.map(([, , needed]) => needed))) {
      const { client } = await loggedInManager([permission]);
      // Droits effectifs : la permission + celles qu'elle implique (orders.manage -> orders.read)
      const granted = normalizePermissions([permission]);
      for (const [method, path, needed] of ROUTES) {
        const status = (await call(client, method, path)).status;
        const label = `${permission} -> ${method} ${path}`;
        if (granted.includes(needed)) expect(status, label).not.toBe(403);
        else expect(status, label).toBe(403);
      }
    }
  });

  it("le superadmin passe partout", async () => {
    const { client } = await loggedInSuperadmin();
    for (const [method, path] of ROUTES) {
      expect((await call(client, method, path)).status, `${method} ${path}`).not.toBe(403);
    }
  });
});

describe("réservation et rôles", () => {
  it("les comptes de l'équipe ne peuvent pas réserver", async () => {
    const vehicle = await createVehicle();
    const { client } = await loggedInSuperadmin();
    const res = await client.post("/api/orders", { vehicleId: String(vehicle._id) });
    expect(res.status).toBe(403);
  });

  it("le profil renvoie le rôle et les permissions effectives (impliquées comprises)", async () => {
    const { client } = await loggedInManager(["orders.manage"]);
    const { body } = await client.get("/api/auth/profile");
    expect(body.role).toBe("gestionnaire");
    expect(body.permissions).toEqual(["orders.read", "orders.manage"]);
  });

  it("une permission inconnue enregistrée en base est ignorée", async () => {
    const user = await createUser({ role: "gestionnaire", permissions: ["orders.read"] });
    await user.collection.updateOne({ _id: user._id }, { $push: { permissions: "users.root" } });
    const fresh = await user.constructor.findById(user._id);
    expect(fresh.toPublic().permissions).toEqual(["orders.read"]);
  });
});
