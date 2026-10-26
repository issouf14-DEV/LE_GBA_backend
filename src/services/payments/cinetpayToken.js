// Vérification de l'en-tête x-token des notifications CinetPay : HMAC SHA-256 (clé secrète du
// compte marchand) de la concaténation, dans cet ordre, des champs reçus dans le corps
import { createHmac, timingSafeEqual } from "node:crypto";

export const NOTIFY_FIELDS = [
  "cpm_site_id",
  "cpm_trans_id",
  "cpm_trans_date",
  "cpm_amount",
  "cpm_currency",
  "signature",
  "payment_method",
  "cel_phone_num",
  "cpm_phone_prefixe",
  "cpm_language",
  "cpm_version",
  "cpm_payment_config",
  "cpm_page_action",
  "cpm_custom",
  "cpm_designation",
  "cpm_error_message",
];

const asText = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return null; // tableau ou objet : champ répété ou forgé, notification refusée
};

export function notifyToken(fields, secret) {
  const parts = NOTIFY_FIELDS.map((name) => asText(fields?.[name]));
  if (parts.includes(null)) return null;
  return createHmac("sha256", secret).update(parts.join(""), "utf8").digest("hex");
}

// Comparaison à durée constante : le temps de réponse ne révèle rien du jeton attendu
export function isValidNotifyToken(fields, received, secret) {
  if (!secret || typeof received !== "string" || !/^[a-f0-9]{64}$/i.test(received)) return false;
  const expected = notifyToken(fields, secret);
  if (!expected) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"));
}
