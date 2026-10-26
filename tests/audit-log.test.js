// Journal d'audit : écriture sur les actions sensibles, journal non modifiable, aucun secret
import { describe, expect, it, vi } from "vitest";
import AuditLog from "../src/models/AuditLog.js";
import { audit, cleanMeta } from "../src/services/audit.js";
import {
  browser,
  createUser,
  inDays,
  loggedIn,
  loggedInSuperadmin,
  PASSWORD,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const entries = (action) => AuditLog.find({ action }).sort({ createdAt: 1 }).lean();
const WRONG = "Mauvais2026x";

describe("connexions de l'équipe", () => {
  it("trace l'échec d'un gestionnaire (compte visé), jamais celui d'un client ou d'un inconnu", async () => {
    const manager = await createUser({ role: "gestionnaire" });
    const client = await createUser();
    const http = browser();
    await http.post("/api/auth/login", { email: client.email, password: WRONG });
    await http.post("/api/auth/login", { email: "inconnu@test.local", password: WRONG });
    await http.post("/api/auth/login", { email: manager.email, password: WRONG });
    await vi.waitFor(async () => expect(await entries("auth.login_failed")).toHaveLength(1));
    const [failure] = await entries("auth.login_failed");
    expect(String(failure.actor)).toBe(String(manager._id));
    expect(failure).toMatchObject({ actorRole: "gestionnaire", meta: { reason: "password" } });
  });

  it("trace la connexion réussie de l'équipe (après la 2FA) mais pas celle d'un client", async () => {
    await loggedIn();
    const { user } = await loggedIn({ role: "gestionnaire" });
    const [success] = await entries("auth.login_succeeded");
    expect(String(success.actor)).toBe(String(user._id));
    expect(success.meta).toEqual({ factor: "app" });
    expect(await AuditLog.countDocuments()).toBe(1);
  });

  it("trace un code 2FA faux", async () => {
    const manager = await createUser({ role: "gestionnaire" });
    const http = browser();
    await http.post("/api/auth/login", { email: manager.email, password: PASSWORD });
    expect((await http.post("/api/auth/mfa/verify", { code: "000000" })).status).toBe(400);
    const [failure] = await entries("mfa.failed");
    expect(String(failure.actor)).toBe(String(manager._id));
    expect(failure.meta).toEqual({ step: "verify" });
  });
});

describe("actions de l'équipe", () => {
  it("permissions modifiées : avant et après sont notés", async () => {
    const { client: admin, user: superadmin } = await loggedInSuperadmin();
    const manager = await createUser({ role: "gestionnaire", permissions: ["stats.read"] });
    await admin.put(`/api/team/${manager._id}/permissions`, { permissions: ["orders.manage"] });
    const [entry] = await entries("manager.permissions_changed");
    expect(String(entry.actor)).toBe(String(superadmin._id));
    expect(String(entry.targetId)).toBe(String(manager._id));
    expect(entry.meta).toEqual({ before: ["stats.read"], after: ["orders.read", "orders.manage"] });
  });

  it("désactivation et suppression d'un client, changement de statut d'une réservation", async () => {
    const { client: admin } = await loggedInSuperadmin();
    const { client, user } = await loggedIn();
    const kia = { brand: "Kia", model: "Picanto", price: 15_000, year: 2023, type: "thermal" };
    const vehicle = await admin.post("/api/vehicles", kia);
    const order = await client.post("/api/orders", {
      vehicleId: vehicle.body._id,
      startDate: inDays(2),
      endDate: inDays(4),
      contact: { fullName: "Awa", email: user.email, phone: "0712345678", address: "Abidjan" },
      notes: "",
    });
    await admin.patch(`/api/orders/${order.body._id}/status`, { status: "rejetee" });
    await admin.patch(`/api/admin/clients/${user._id}/status`, { disabled: true });
    await admin.delete(`/api/admin/clients/${user._id}`);
    const [status] = await entries("order.status_changed");
    expect(status).toMatchObject({ targetType: "order", meta: { status: "rejetee" } });
    expect((await entries("vehicle.created"))[0].meta).toEqual({ label: "Kia Picanto 2023" });
    expect((await entries("account.disabled"))[0].meta).toEqual({ role: "client" });
    expect(await entries("account.deleted")).toHaveLength(1);
  });
});

describe("journal non modifiable", () => {
  it("refuse toute modification ou suppression passant par l'application", async () => {
    const entry = await AuditLog.create({ action: "vehicle.created", meta: { label: "A" } });
    const id = { _id: entry._id };
    const attempts = [
      () => AuditLog.updateOne(id, { action: "vehicle.deleted" }),
      () => AuditLog.updateMany({}, { action: "vehicle.deleted" }),
      () => AuditLog.findOneAndUpdate(id, { meta: {} }),
      () => AuditLog.findByIdAndDelete(entry._id),
      () => AuditLog.deleteOne(id),
      () => AuditLog.deleteMany({}),
      () => AuditLog.replaceOne(id, { action: "mfa.reset" }),
      () => AuditLog.bulkWrite([{ deleteOne: { filter: id } }]),
      () => entry.deleteOne(),
      () => entry.updateOne({ action: "mfa.reset" }),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toThrow(/ni modifié ni supprimé/);
    }
    entry.set("ip", "1.2.3.0");
    await expect(entry.save()).rejects.toThrow();
    const saved = await AuditLog.findById(entry._id).lean();
    expect(saved).toMatchObject({ action: "vehicle.created", meta: { label: "A" } });
    expect(saved.ip).toBeUndefined();
  });

  it("purge automatique par index TTL (365 jours par défaut)", async () => {
    await AuditLog.init();
    const indexes = await AuditLog.collection.indexes();
    const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);
    expect(ttl.key).toEqual({ createdAt: 1 });
    expect(ttl.expireAfterSeconds).toBe(365 * 24 * 3600);
  });
});

describe("aucune donnée sensible", () => {
  it("ni mot de passe, ni code, ni email dans le journal", async () => {
    const { client } = await loggedIn({ role: "gestionnaire" });
    const fresh = "NouveauMotDePasse2026";
    await client.put("/api/auth/password", { currentPassword: PASSWORD, newPassword: fresh });
    const { client: admin } = await loggedInSuperadmin();
    const email = "invite.secret@test.local";
    await admin.post("/api/team", { name: "Koffi", email, phone: "", permissions: [] });
    expect(await entries("password.changed")).toHaveLength(1);
    expect(await entries("manager.invited")).toHaveLength(1);
    const dump = JSON.stringify(await AuditLog.find().lean());
    for (const secret of [PASSWORD, fresh, email]) expect(dump).not.toContain(secret);
  });

  it("le nettoyage écarte les clés sensibles et les objets imbriqués", () => {
    const meta = { password: "x", resetToken: "y", code: "123456", nested: { a: 1 }, ok: "oui" };
    expect(cleanMeta(meta)).toEqual({ ok: "oui" });
    expect(cleanMeta({ long: "a".repeat(500) }).long).toHaveLength(100);
  });

  it("une erreur du journal ne fait jamais échouer l'action", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(audit({ ip: "1.2.3.4" }, "action.inconnue")).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
