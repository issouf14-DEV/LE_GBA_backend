// Choix du fournisseur de paiement (PAYMENT_PROVIDER) et fournisseur simulé « fake »
import { env, publicSiteUrl } from "../../config/env.js";
import { httpError } from "../../middlewares/errorMiddleware.js";
import { cinetpay } from "./cinetpay.js";

// Paiement simulé (développement, démonstration ; refusé en production au démarrage) : la
// « page de paiement » est la page de retour du site, et la vérification accepte le paiement
export const fake = {
  name: "fake",
  async initialize({ order }) {
    return { paymentUrl: `${publicSiteUrl}/payment/return?order=${order._id}` };
  },
  async check(payment) {
    return {
      status: "accepted",
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: "SIMULATION",
      providerStatus: "ACCEPTED",
    };
  },
};

const PROVIDERS = { fake, cinetpay };

export const paymentEnabled = () => Boolean(PROVIDERS[env.PAYMENT_PROVIDER]);

// Fournisseur actif ; un paiement créé avec un autre fournisseur n'est plus vérifié
export const providerFor = (name) =>
  name === env.PAYMENT_PROVIDER ? (PROVIDERS[name] ?? null) : null;

export function activeProvider() {
  const provider = PROVIDERS[env.PAYMENT_PROVIDER];
  if (!provider) throw httpError(503, "Le paiement en ligne n'est pas activé.");
  return provider;
}
