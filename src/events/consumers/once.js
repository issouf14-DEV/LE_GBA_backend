// Idempotence des consommateurs : un message déjà traité (même identifiant d'événement, même
// consommateur) est ignoré. Si le traitement échoue, rien n'est noté : le nouvel essai le refera.
import ProcessedEvent from "../../models/ProcessedEvent.js";

const DUPLICATE_KEY = 11000;

export const once = (consumer, handler) => async (message, ctx) => {
  const eventId = String(message.id);
  if (await ProcessedEvent.exists({ eventId, consumer })) return;
  await handler(message, ctx);
  try {
    await ProcessedEvent.create({ eventId, consumer });
  } catch (error) {
    // Deux livraisons simultanées du même message : l'autre l'a déjà noté
    if (error?.code !== DUPLICATE_KEY) throw error;
  }
};
