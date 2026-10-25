// Gestion des clients par l'équipe et tableau de bord
import { describe, expect, it } from "vitest";
import Order from "../src/models/Order.js";
import User from "../src/models/User.js";
import {
  browser,
  createUser,
  createVehicle,
  inDays,
  loggedInManager,
  loggedInSuperadmin,
  PASSWORD,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const NEW_CLIENT = { name: "Moussa Traoré", email: "moussa@test.local", phone: "" };
const CONTACT = { fullName: "A", email: "a@test.local", phone: "0712345678", address: "Abidjan" };
const orderFor = (user, vehicle, extra = {}) => ({
  user: user._id,
  vehicle: vehicle._id,
  startDate: inDays(2),
  endDate: inDays(4),
  days: 2,
  pricePerDay: 1000,
  totalPrice: 2000,
  contact: CONTACT,
  ...extra,
});

describe("clients", () => {
  it("invite un client sans mot de passe et ne renvoie aucune donnée sensible", async () => {
    const { client } = await loggedInManager(["clients.manage"]);
    const res = await client.post("/api/admin/clients", NEW_CLIENT);
    expect(res.status).toBe(201);
    expect(res.body.role).toBe("client");
    expect(JSON.stringify(res.body)).not.toMatch(/password|reset/i);
    const saved = await User.findOne({ email: NEW_CLIENT.email });
    expect(saved.passwordSetupRequired).toBe(true);
  });

  it("refuse un rôle ou un mot de passe fournis par le navigateur", async () => {
    const { client } = await loggedInSuperadmin();
    for (const extra of [{ role: "superadmin" }, { password: PASSWORD }]) {
      expect((await client.post("/api/admin/clients", { ...NEW_CLIENT, ...extra })).status).toBe(
        400
      );
    }
  });

  it("liste et recherche uniquement les clients (jamais l'équipe)", async () => {
    const { client } = await loggedInManager(["clients.read"]);
    await createUser({ name: "Fatou Bamba" });
    await createUser({ role: "gestionnaire", name: "Fatou Équipe" });
    const res = await client.get("/api/admin/clients?q=fatou");
    expect(res.status).toBe(200);
    expect(res.body.users.map((user) => user.name)).toEqual(["Fatou Bamba"]);
  });

  it("désactiver un client coupe ses sessions et bloque sa connexion", async () => {
    const { client } = await loggedInManager(["clients.manage"]);
    const customer = await createUser();
    const session = browser();
    await session.post("/api/auth/login", { email: customer.email, password: PASSWORD });

    const res = await client.patch(`/api/admin/clients/${customer._id}/status`, { disabled: true });
    expect(res.status).toBe(200);
    expect((await session.get("/api/auth/profile")).status).toBe(401);
    const login = await browser().post("/api/auth/login", {
      email: customer.email,
      password: PASSWORD,
    });
    expect(login.status).toBe(403);
  });

  it("un identifiant de gestionnaire n'est pas accessible par les routes clients", async () => {
    const { client } = await loggedInManager(["clients.manage"]);
    const colleague = await createUser({ role: "gestionnaire" });
    expect((await client.delete(`/api/admin/clients/${colleague._id}`)).status).toBe(404);
  });

  it("refuse de supprimer un client qui a une réservation en cours", async () => {
    const { client } = await loggedInSuperadmin();
    const customer = await createUser();
    await Order.create(orderFor(customer, await createVehicle()));
    expect((await client.delete(`/api/admin/clients/${customer._id}`)).status).toBe(409);
    await Order.updateMany({}, { status: "terminee" });
    expect((await client.delete(`/api/admin/clients/${customer._id}`)).status).toBe(204);
    expect(await Order.countDocuments()).toBe(1);
  });
});

describe("statistiques", () => {
  it("compte toutes les commandes (au-delà d'une page de 100)", async () => {
    const { client } = await loggedInSuperadmin();
    const customer = await createUser();
    const vehicle = await createVehicle();
    const base = orderFor(customer, vehicle, { startDate: new Date(), endDate: new Date() });
    await Order.insertMany([
      ...Array.from({ length: 120 }, () => ({ ...base, status: "validee", totalPrice: 1000 })),
      ...Array.from({ length: 30 }, () => ({ ...base, status: "en_attente", totalPrice: 1000 })),
    ]);
    const { body } = await client.get("/api/admin/stats");
    expect(body.totalOrders).toBe(150);
    expect(body.pendingOrders).toBe(30);
    expect(body.totalRevenue).toBe(120_000);
    expect(body.monthly.at(-1).commandes).toBe(150);
    expect(body.recentOrders).toHaveLength(5);
  });

  it("sans le droit de voir les réservations, pas de noms ni d'emails de clients", async () => {
    const { client } = await loggedInManager(["stats.read"]);
    await Order.create(orderFor(await createUser(), await createVehicle()));
    const { body } = await client.get("/api/admin/stats");
    expect(body.totalOrders).toBe(1);
    expect(body.recentOrders).toEqual([]);
  });
});
