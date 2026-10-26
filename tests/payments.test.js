// Paiement de l'acompte (fournisseur simulé « fake ») : montant serveur, accès, idempotence
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { paymentEnvIssue } from "../src/config/paymentEnv.js";
import Order from "../src/models/Order.js";
import OutboxEvent from "../src/models/OutboxEvent.js";
import Payment from "../src/models/Payment.js";
import { depositAmount } from "../src/services/payments/amount.js";
import { fake } from "../src/services/payments/providers.js";
import { browser, loggedIn, loggedInManager, useDatabase } from "./helpers/app.js";
import { confirmedOrder, usePaymentEnv } from "./helpers/payments.js";

useDatabase();
usePaymentEnv({ PAYMENT_PROVIDER: "fake", PAYMENT_DEPOSIT_PERCENT: 30 });

const pay = (client, order) => client.post(`/api/payments/orders/${order._id}`);
const state = (client, order) => client.get(`/api/payments/orders/${order._id}`);

describe("montant de l'acompte", () => {
  it("arrondit au multiple de 5 supérieur", () => {
    expect(depositAmount(75_000, 30)).toBe(22_500);
    expect(depositAmount(10_001, 30)).toBe(3005);
    expect(depositAmount(33_333, 30)).toBe(10_000);
    expect(depositAmount(1000, 100)).toBe(1000);
  });

  it("est calculé par le serveur : un montant envoyé par le navigateur est ignoré", async () => {
    const { client, user } = await loggedIn();
    const order = await confirmedOrder(user);
    const res = await client.post(`/api/payments/orders/${order._id}`, { amount: 5 });
    expect(res.status).toBe(201);
    expect(res.body.payment.amount).toBe(22_500);
    expect((await Payment.findOne()).amount).toBe(22_500);
  });
});

describe("parcours simulé", () => {
  it("renvoie l'adresse interne puis marque l'acompte payé à la lecture de l'état", async () => {
    const { client, user } = await loggedIn();
    const order = await confirmedOrder(user);
    const res = await pay(client, order);
    expect(res.body.paymentUrl).toBe(
      `https://legba-zeta.vercel.app/payment/return?order=${order._id}`
    );
    expect(res.body.payment.status).toBe("pending");

    const after = await state(client, order);
    expect(after.status).toBe(200);
    expect(after.body.paymentStatus).toBe("deposit_paid");
    expect(after.body.payment.status).toBe("accepted");
    expect((await Order.findById(order._id)).paymentStatus).toBe("deposit_paid");
    const events = await OutboxEvent.find({ type: "payment.accepted" });
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({ orderId: String(order._id) });

    // Lectures répétées : aucun second événement, nouvelle tentative refusée
    await state(client, order);
    expect(await OutboxEvent.countDocuments({ type: "payment.accepted" })).toBe(1);
    expect((await pay(client, order)).status).toBe(409);
  });

  it("une seule tentative active : un second clic reprend la même transaction", async () => {
    const { client, user } = await loggedIn();
    const order = await confirmedOrder(user);
    // Paiement pas encore effectué chez le fournisseur : la tentative reste en cours
    const original = fake.check;
    fake.check = async () => ({ status: "pending" });
    try {
      const first = await pay(client, order);
      const second = await pay(client, order);
      expect(second.status).toBe(201);
      expect(second.body.payment._id).toBe(first.body.payment._id);
      expect(await Payment.countDocuments()).toBe(1);
    } finally {
      fake.check = original;
    }
  });
});

describe("accès", () => {
  it("refuse la réservation d'un autre client (404, pas d'IDOR)", async () => {
    const { user } = await loggedIn();
    const order = await confirmedOrder(user);
    const { client: other } = await loggedIn();
    expect((await pay(other, order)).status).toBe(404);
    expect((await state(other, order)).status).toBe(404);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it("refuse l'équipe, les visiteurs et une réservation non confirmée", async () => {
    const { user, client } = await loggedIn();
    const order = await confirmedOrder(user);
    const { client: staff } = await loggedInManager(["payments.manage", "orders.manage"]);
    expect((await pay(staff, order)).status).toBe(403);
    expect((await pay(browser(), order)).status).toBe(401);
    const pending = await confirmedOrder(user, { status: "en_attente" });
    expect((await pay(client, pending)).status).toBe(409);
  });

  it("liste des paiements : permission payments.read exigée, sans adresse de paiement", async () => {
    const { client, user } = await loggedIn();
    await pay(client, await confirmedOrder(user));
    expect((await client.get("/api/payments")).status).toBe(403);
    expect(
      (await (await loggedInManager(["orders.read"])).client.get("/api/payments")).status
    ).toBe(403);
    const { client: staff } = await loggedInManager(["payments.read"]);
    const res = await staff.get("/api/payments?page=1&limit=10");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.payments[0].user.name).toBe("Awa Koné");
    expect(res.body.payments[0].paymentUrl).toBeUndefined();
    expect((await staff.get("/api/payments?status=pirate")).status).toBe(400);
  });
});

describe("désactivé", () => {
  it("configuration publique, création et état refusés avec un message clair", async () => {
    env.PAYMENT_PROVIDER = "none";
    const config = await browser().get("/api/payments/config");
    expect(config.body).toEqual({ enabled: false, depositPercent: 0 });
    const { client, user } = await loggedIn();
    const order = await confirmedOrder(user);
    const res = await pay(client, order);
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/pas activé/);
    expect((await state(client, order)).status).toBe(503);
  });

  it("configuration au démarrage : fake interdit en production, clés CinetPay exigées", () => {
    expect(paymentEnvIssue({ PAYMENT_PROVIDER: "fake", NODE_ENV: "production" })).toMatch(
      /interdit/
    );
    expect(paymentEnvIssue({ PAYMENT_PROVIDER: "cinetpay" })).toMatch(/CINETPAY_API_KEY/);
    expect(paymentEnvIssue({ PAYMENT_PROVIDER: "none", NODE_ENV: "production" })).toBeNull();
  });
});
