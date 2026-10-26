// Textes des notifications de l'application : courts, écrits par le serveur, sans donnée
// personnelle (ni nom, ni email, ni téléphone), avec un lien vers une page interne du site
import { EVENTS } from "../../events/topology.js";

const dateFormat = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Abidjan" });
const formatDate = (value) => (value ? dateFormat.format(new Date(value)) : "");

// « Toyota Corolla, du 12/11/2026 au 14/11/2026 »
export function rentalSummary(order) {
  const vehicle = [order.vehicleSnapshot?.brand, order.vehicleSnapshot?.model]
    .filter(Boolean)
    .join(" ");
  const dates = `du ${formatDate(order.startDate)} au ${formatDate(order.endDate)}`;
  return `${vehicle || "Véhicule"}, ${dates}`;
}

export const newOrderMessage = (order) => ({
  kind: "order.created",
  title: "Nouvelle réservation",
  body: `${rentalSummary(order)}. En attente de validation.`,
  link: "/admin/orders",
});

const STATUS_TEXTS = {
  validee: ["Réservation confirmée", "est confirmée."],
  rejetee: ["Réservation refusée", "n'a pas pu être acceptée."],
  annulee: ["Réservation annulée", "est annulée."],
  terminee: ["Location terminée", "est terminée. Merci d'avoir choisi LE-GBA."],
};

// null : statut sans notification (retour en attente)
export function orderStatusMessage(order, status) {
  const texts = Object.hasOwn(STATUS_TEXTS, status) ? STATUS_TEXTS[status] : null;
  if (!texts) return null;
  return {
    kind: "order.status",
    title: texts[0],
    body: `Votre réservation (${rentalSummary(order)}) ${texts[1]}`,
    link: "/profile/orders",
  };
}

const security = (title, body) => ({ kind: "security", title, body, link: "/profile" });

export const SECURITY_MESSAGES = {
  [EVENTS.passwordChanged]: security(
    "Mot de passe modifié",
    "Le mot de passe de votre compte vient d'être changé. Si ce n'est pas vous, contactez-nous."
  ),
  [EVENTS.mfaEnabled]: security(
    "Double authentification activée",
    "Votre compte est désormais protégé par un code à usage unique."
  ),
  [EVENTS.mfaReset]: security(
    "Double authentification réinitialisée",
    "Configurez-la de nouveau à votre prochaine connexion. Si ce n'est pas vous, contactez-nous."
  ),
};
