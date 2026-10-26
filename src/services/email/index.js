// Emails métier : déclenchés uniquement par le serveur, à partir des données en base
import { env } from "../../config/env.js";
import { button, date, escapeHtml, layout, price, row } from "./layout.js";
import { sendEmail } from "./sender.js";

const vehicleName = (order) =>
  `${order.vehicleSnapshot?.brand || ""} ${order.vehicleSnapshot?.model || ""}`.trim() ||
  "Véhicule";
const reference = (order) => String(order._id).slice(-8).toUpperCase();

const orderRows = (order) =>
  [
    row("Réservation", `#${reference(order)}`),
    row("Véhicule", vehicleName(order)),
    row("Du", date(order.startDate)),
    row("Au", date(order.endDate)),
    row("Total", price(order.totalPrice)),
  ].join("");

export const sendNewOrderToAdmin = (order) => {
  if (!env.ADMIN_EMAIL) return Promise.resolve(false);
  return sendEmail({
    kind: "nouvelle commande",
    to: env.ADMIN_EMAIL,
    subject: `Nouvelle réservation #${reference(order)}`,
    html: layout(
      "Nouvelle réservation",
      `${orderRows(order)}${row("Client", order.contact.fullName)}${row("Email", order.contact.email)}${row("Téléphone", order.contact.phone)}${button("Gérer les réservations", "/admin/orders")}`
    ),
  });
};

const STATUS_MESSAGES = {
  validee: [
    "Réservation confirmée",
    "Bonne nouvelle : votre réservation est confirmée. Le paiement se fait à la remise du véhicule.",
  ],
  rejetee: [
    "Réservation refusée",
    "Nous ne pouvons malheureusement pas honorer cette réservation. Contactez-nous pour trouver une alternative.",
  ],
  annulee: ["Réservation annulée", "Votre réservation a bien été annulée."],
  terminee: ["Location terminée", "Merci d'avoir choisi LE-GBA. À bientôt !"],
};

// `to` : adresse du compte client (jamais l'email libre saisi dans le formulaire de commande,
// sinon le site pourrait servir à envoyer des emails à n'importe qui)
export const sendOrderStatusEmail = (order, to) => {
  const [title, text] = STATUS_MESSAGES[order.status] || STATUS_MESSAGES.annulee;
  return sendEmail({
    kind: `statut ${order.status}`,
    to,
    subject: `${title} - #${reference(order)}`,
    html: layout(
      title,
      `<p>Bonjour ${escapeHtml(order.contact.fullName)},</p><p>${escapeHtml(text)}</p>${orderRows(order)}${button("Voir mes réservations", "/profile/orders")}`
    ),
  });
};

export const sendPaymentReminderEmail = (order, to) =>
  sendEmail({
    kind: "rappel de paiement",
    to,
    subject: `Rappel - réservation #${reference(order)}`,
    html: layout(
      "Rappel de paiement",
      `<p>Le règlement de votre réservation se fait à la remise du véhicule.</p>${orderRows(order)}`
    ),
  });

export const sendRentalSummaryEmail = (order, to) =>
  sendEmail({
    kind: "récapitulatif",
    to,
    subject: `Récapitulatif - réservation #${reference(order)}`,
    html: layout("Récapitulatif de location", orderRows(order)),
  });
