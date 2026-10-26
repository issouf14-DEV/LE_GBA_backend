// Fournisseur CinetPay (API « checkout » v2) : initialisation du paiement et vérification de
// son état. Les clés ne sont jamais écrites dans les journaux ni renvoyées au navigateur.
import { env, publicSiteUrl } from "../../config/env.js";
import { httpError } from "../../middlewares/errorMiddleware.js";

export const CINETPAY_API = "https://api-checkout.cinetpay.com/v2";
const TIMEOUT_MS = 10_000;

// Page de paiement attendue : https sur un domaine CinetPay, rien d'autre
export const isCinetpayUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)cinetpay\.com$/.test(url.hostname);
  } catch {
    return false;
  }
};

const unavailable = () => httpError(503, "Le service de paiement est indisponible. Réessayez.");

async function post(path, body) {
  let response;
  try {
    response = await fetch(`${CINETPAY_API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        apikey: env.CINETPAY_API_KEY,
        site_id: env.CINETPAY_SITE_ID,
        ...body,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return await response.json();
  } catch (error) {
    // Message seul (jamais le corps de la requête, qui contient la clé)
    console.error(`CinetPay ${path} injoignable :`, error.name);
    throw unavailable();
  }
}

// État CinetPay -> état local ; tout état inconnu reste « en cours »
function mapStatus(code, status) {
  const value = String(status || "").toUpperCase();
  if (String(code) === "00" && value === "ACCEPTED") return "accepted";
  if (value === "REFUSED") return "refused";
  if (value.includes("CANCEL")) return "cancelled";
  return "pending";
}

const short = (value, max) => (typeof value === "string" ? value.slice(0, max) : undefined);

export const cinetpay = {
  name: "cinetpay",

  async initialize({ payment, order }) {
    const reference = String(order._id).slice(-8).toUpperCase();
    const res = await post("/payment", {
      transaction_id: payment.transactionId,
      amount: payment.amount,
      currency: payment.currency,
      // Sans caractères spéciaux (refusés par CinetPay)
      description: `Acompte reservation LEGBA ${reference}`,
      notify_url: `${publicSiteUrl}/api/payments/cinetpay/notify`,
      return_url: `${publicSiteUrl}/api/payments/cinetpay/return?order=${order._id}`,
      channels: "MOBILE_MONEY",
      lang: "fr",
      metadata: String(order._id),
    });
    const url = res?.data?.payment_url;
    if (String(res?.code) !== "201" || !isCinetpayUrl(url)) {
      console.error("CinetPay : initialisation refusée", res?.code, short(res?.message, 80));
      throw unavailable();
    }
    return { paymentUrl: url, providerRef: short(res.data.payment_token, 100) };
  },

  async check(payment) {
    const res = await post("/payment/check", { transaction_id: payment.transactionId });
    const data = res?.data || {};
    return {
      status: mapStatus(res?.code, data.status),
      amount: Number(data.amount),
      currency: String(data.currency || ""),
      paymentMethod: short(data.payment_method, 40),
      providerStatus: short(data.status || res?.message, 60),
      providerRef: short(data.operator_id, 100),
    };
  },
};
