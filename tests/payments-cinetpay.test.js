// Paiement via CinetPay (API simulée) : initialisation, notification signée (x-token),
// confirmation obligatoire par payment/check, idempotence, montant contrôlé
import { describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import Order from "../src/models/Order.js";
import OutboxEvent from "../src/models/OutboxEvent.js";
import Payment from "../src/models/Payment.js";
import { loggedIn, raw, useDatabase } from "./helpers/app.js";
import {
  CINETPAY_TEST,
  confirmedOrder,
  mockCinetpay,
  notification,
  usePaymentEnv,
} from "./helpers/payments.js";

useDatabase();
usePaymentEnv({ PAYMENT_PROVIDER: "cinetpay", PAYMENT_DEPOSIT_PERCENT: 30, ...CINETPAY_TEST });

// Notification envoyée par CinetPay : formulaire, SANS l'en-tête anti-CSRF du site
const notify = ({ fields, token }) =>
  raw().post("/api/payments/cinetpay/notify").type("form").set("x-token", token).send(fields);

async function started() {
  const cinetpay = mockCinetpay();
  const { client, user } = await loggedIn();
  const order = await confirmedOrder(user);
  const res = await client.post(`/api/payments/orders/${order._id}`);
  const payment = await Payment.findOne({ order: order._id });
  cinetpay.calls.length = 0;
  return { cinetpay, client, order, payment, res };
}

const paidEvents = () => OutboxEvent.countDocuments({ type: "payment.accepted" });

describe("initialisation", () => {
  it("envoie les champs documentés et renvoie la page de paiement CinetPay", async () => {
    const cinetpay = mockCinetpay();
    const { client, user } = await loggedIn();
    const order = await confirmedOrder(user);
    const res = await client.post(`/api/payments/orders/${order._id}`);
    expect(res.status).toBe(201);
    expect(res.body.paymentUrl).toBe("https://checkout.cinetpay.com/payment/jeton-test");
    const { url, body } = cinetpay.calls[0];
    expect(url).toBe("https://api-checkout.cinetpay.com/v2/payment");
    expect(body).toMatchObject({
      apikey: CINETPAY_TEST.CINETPAY_API_KEY,
      site_id: "123456",
      amount: 22_500,
      currency: "XOF",
      channels: "MOBILE_MONEY",
      notify_url: "https://legba-zeta.vercel.app/api/payments/cinetpay/notify",
    });
    expect(body.transaction_id).toMatch(/^GBA[A-F0-9]{24}$/);
    expect(JSON.stringify(res.body)).not.toContain(CINETPAY_TEST.CINETPAY_API_KEY);
  });

  it("refuse une adresse de paiement hors du domaine CinetPay", async () => {
    mockCinetpay();
    const pirate = { code: "201", data: { payment_url: "https://cinetpay.com.pirate.ci/x" } };
    globalThis.fetch.mockImplementationOnce(async () => Response.json(pirate));
    const { client, user } = await loggedIn();
    const order = await confirmedOrder(user);
    expect((await client.post(`/api/payments/orders/${order._id}`)).status).toBe(503);
    expect((await Payment.findOne()).status).toBe("cancelled");
  });
});

describe("notification", () => {
  it("accepte une notification signée, confirmée par payment/check (idempotent)", async () => {
    const { cinetpay, order, payment } = await started();
    cinetpay.check = { code: "00", data: { status: "ACCEPTED", amount: "22500", currency: "XOF" } };
    const message = notification(payment.transactionId, 22_500);
    expect((await notify(message)).status).toBe(200);
    expect(cinetpay.calls[0].url).toBe("https://api-checkout.cinetpay.com/v2/payment/check");
    expect(cinetpay.calls[0].body.transaction_id).toBe(payment.transactionId);
    expect((await Payment.findById(payment._id)).status).toBe("accepted");
    expect((await Order.findById(order._id)).paymentStatus).toBe("deposit_paid");

    // Même notification reçue de nouveau : aucun second traitement
    expect((await notify(message)).status).toBe(200);
    expect(cinetpay.calls).toHaveLength(1);
    expect(await paidEvents()).toBe(1);
  });

  it("refuse un mauvais x-token, un champ modifié ou un autre site_id", async () => {
    const { cinetpay, payment } = await started();
    const good = notification(payment.transactionId, 22_500);
    const tampered = { ...good, fields: { ...good.fields, cpm_amount: "5" } };
    expect((await notify({ ...good, token: "0".repeat(64) })).status).toBe(401);
    expect((await notify({ ...good, token: "pas-un-jeton" })).status).toBe(401);
    expect((await notify(tampered)).status).toBe(401);
    expect(
      (await notify(notification(payment.transactionId, 22_500, { cpm_site_id: "9" }))).status
    ).toBe(401);
    expect(cinetpay.calls).toHaveLength(0);
    expect((await Payment.findById(payment._id)).status).toBe("pending");
  });

  it("ne croit pas la notification seule : check refusé ou en cours -> non payé", async () => {
    const { cinetpay, order, payment } = await started();
    cinetpay.check = { code: "662", data: { status: "WAITING_CUSTOMER_PAYMENT" } };
    await notify(notification(payment.transactionId, 22_500));
    expect((await Payment.findById(payment._id)).status).toBe("pending");
    cinetpay.check = { code: "600", data: { status: "REFUSED", amount: "22500", currency: "XOF" } };
    await notify(notification(payment.transactionId, 22_500));
    expect((await Payment.findById(payment._id)).status).toBe("refused");
    expect((await Order.findById(order._id)).paymentStatus).toBe("none");
    expect(await paidEvents()).toBe(0);
  });

  it("refuse un montant confirmé différent du montant attendu", async () => {
    const { cinetpay, order, payment } = await started();
    cinetpay.check = { code: "00", data: { status: "ACCEPTED", amount: "100", currency: "XOF" } };
    await notify(notification(payment.transactionId, 100));
    const after = await Payment.findById(payment._id);
    expect(after.status).toBe("refused");
    expect(after.raw.anomaly).toBe("amount_mismatch");
    expect((await Order.findById(order._id)).paymentStatus).toBe("none");
  });

  it("API de vérification injoignable : 503 pour que CinetPay renvoie la notification", async () => {
    const { payment } = await started();
    globalThis.fetch.mockRejectedValueOnce(new Error("délai dépassé"));
    expect((await notify(notification(payment.transactionId, 22_500))).status).toBe(503);
    expect((await Payment.findById(payment._id)).status).toBe("pending");
  });

  it("transaction inconnue : 200 sans effet ; route introuvable si CinetPay n'est pas actif", async () => {
    const { cinetpay } = await started();
    expect((await notify(notification(`GBA${"A".repeat(24)}`, 22_500))).status).toBe(200);
    expect(cinetpay.calls).toHaveLength(0);
    env.PAYMENT_PROVIDER = "fake";
    expect((await notify(notification(`GBA${"A".repeat(24)}`, 22_500))).status).toBe(404);
  });

  it("retour du client : redirection vers la page du site, sans rien modifier", async () => {
    const id = "a".repeat(24);
    const res = await raw()
      .post(`/api/payments/cinetpay/return?order=${id}`)
      .type("form")
      .send({ token: "x" });
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`https://legba-zeta.vercel.app/payment/return?order=${id}`);
    const bad = await raw().get("/api/payments/cinetpay/return?order=javascript:alert(1)");
    expect(bad.headers.location).toBe("https://legba-zeta.vercel.app/payment/return");
  });
});
