// Outils des tests de paiement : fournisseur choisi par test, réservation confirmée, faux CinetPay
import { afterEach, beforeEach, vi } from "vitest";
import { env } from "../../src/config/env.js";
import Order from "../../src/models/Order.js";
import { notifyToken } from "../../src/services/payments/cinetpayToken.js";
import { createVehicle } from "./app.js";

const DAY = 86_400_000;
const KEYS = [
  "PAYMENT_PROVIDER",
  "PAYMENT_DEPOSIT_PERCENT",
  "CINETPAY_API_KEY",
  "CINETPAY_SITE_ID",
  "CINETPAY_SECRET_KEY",
];

// Clés factices (aucune vraie clé dans les tests)
export const CINETPAY_TEST = {
  CINETPAY_API_KEY: "cle-api-factice-de-test",
  CINETPAY_SITE_ID: "123456",
  CINETPAY_SECRET_KEY: "secret-hmac-factice-de-test",
};

// Fournisseur actif pendant chaque test du fichier, configuration rétablie ensuite
export function usePaymentEnv(overrides) {
  let saved;
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((key) => [key, env[key]]));
    Object.assign(env, overrides);
  });
  afterEach(() => {
    Object.assign(env, saved);
    vi.restoreAllMocks();
  });
}

export async function confirmedOrder(user, overrides = {}) {
  const vehicle = await createVehicle();
  return Order.create({
    user: user._id,
    vehicle: vehicle._id,
    vehicleSnapshot: { brand: "Toyota", model: "Corolla", year: 2024 },
    startDate: new Date(Date.now() + 2 * DAY),
    endDate: new Date(Date.now() + 5 * DAY),
    days: 3,
    pricePerDay: 25_000,
    totalPrice: 75_000,
    contact: {
      fullName: "Awa Koné",
      email: "awa@test.local",
      phone: "0712345678",
      address: "Cocody",
    },
    status: "validee",
    ...overrides,
  });
}

// Faux CinetPay : réponses de l'API v2 (initialisation, vérification) ; `state.check` modifiable
export function mockCinetpay() {
  const state = { calls: [], check: { code: "00", data: { status: "ACCEPTED" } } };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    const body = JSON.parse(init.body);
    state.calls.push({ url: String(url), body });
    const json = String(url).endsWith("/payment/check")
      ? state.check
      : {
          code: "201",
          message: "CREATED",
          data: {
            payment_token: "jeton-test",
            payment_url: "https://checkout.cinetpay.com/payment/jeton-test",
          },
        };
    return new Response(JSON.stringify(json), { headers: { "Content-Type": "application/json" } });
  });
  return state;
}

// Corps d'une notification CinetPay et son jeton x-token (signé avec la clé de test)
export function notification(transactionId, amount, extra = {}) {
  const fields = {
    cpm_site_id: CINETPAY_TEST.CINETPAY_SITE_ID,
    cpm_trans_id: transactionId,
    cpm_trans_date: "2026-10-26 10:00:00",
    cpm_amount: String(amount),
    cpm_currency: "XOF",
    signature: "signature-test",
    payment_method: "OM",
    cel_phone_num: "0700000000",
    cpm_phone_prefixe: "225",
    cpm_language: "fr",
    cpm_version: "V4",
    cpm_payment_config: "SINGLE",
    cpm_page_action: "PAYMENT",
    cpm_custom: "",
    cpm_designation: "Acompte",
    cpm_error_message: "SUCCES",
    ...extra,
  };
  return { fields, token: notifyToken(fields, CINETPAY_TEST.CINETPAY_SECRET_KEY) };
}
