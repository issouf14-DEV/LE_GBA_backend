// Écriture d'un événement métier dans la boîte d'envoi (outbox). Avec `session`, l'événement est
// enregistré dans la même transaction que l'action : les deux existent, ou aucun.
import OutboxEvent from "../models/OutboxEvent.js";
import { EVENTS } from "./topology.js";

const KNOWN_TYPES = new Set(Object.values(EVENTS));

// Le bus ne transporte que des identifiants : chaque valeur est convertie en chaîne, et tout
// objet imbriqué est refusé (aucune donnée personnelle ne doit y transiter par erreur)
function cleanPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Événement invalide : le contenu doit être un objet d'identifiants");
  }
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => {
      if (
        value === null ||
        value === undefined ||
        (typeof value === "object" && !value._bsontype)
      ) {
        throw new Error(`Événement invalide : « ${key} » doit être un identifiant`);
      }
      return [key, String(value)];
    })
  );
}

export async function recordEvent(type, payload, { session } = {}) {
  if (!KNOWN_TYPES.has(type)) throw new Error(`Type d'événement inconnu : ${type}`);
  const [event] = await OutboxEvent.create([{ type, payload: cleanPayload(payload) }], { session });
  return event;
}
