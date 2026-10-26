// Cohérence des variables du paiement en ligne, vérifiée au démarrage (le serveur refuse de
// démarrer plutôt que d'accepter des paiements mal configurés)
const CINETPAY_KEYS = ["CINETPAY_API_KEY", "CINETPAY_SITE_ID", "CINETPAY_SECRET_KEY"];

export function paymentEnvIssue(config) {
  if (config.PAYMENT_PROVIDER === "fake" && config.NODE_ENV === "production") {
    return "PAYMENT_PROVIDER=fake (paiement simulé) est interdit en production";
  }
  if (config.PAYMENT_PROVIDER === "cinetpay") {
    const missing = CINETPAY_KEYS.filter((key) => !config[key]);
    if (missing.length > 0) return `${missing.join(", ")} manquant (PAYMENT_PROVIDER=cinetpay)`;
  }
  return null;
}
