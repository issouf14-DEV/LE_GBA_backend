// Relais de la boîte d'envoi : publie sur le bus les événements en attente, dans l'ordre.
// Chaque événement est réclamé atomiquement avec un bail : deux relais ne publient jamais le même,
// et un événement réclamé par un relais arrêté en cours de route est repris à l'expiration du bail.
import mongoose from "mongoose";
import OutboxEvent from "../models/OutboxEvent.js";

const toMessage = (event) => ({
  id: String(event._id),
  type: event.type,
  payload: event.payload,
  occurredAt: event.createdAt.toISOString(),
});

function claimNext(leaseMs) {
  const now = new Date();
  return OutboxEvent.findOneAndUpdate(
    {
      status: "pending",
      $or: [{ lockedUntil: null }, { lockedUntil: mongoose.trusted({ $lt: now }) }],
    },
    { lockedUntil: new Date(now.getTime() + leaseMs), $inc: { attempts: 1 } },
    { sort: { createdAt: 1 }, new: true }
  );
}

// Publie au plus `limit` événements ; renvoie le nombre d'événements publiés
export async function relayBatch(bus, { limit = 50, leaseMs = 30_000 } = {}) {
  let published = 0;
  while (published < limit) {
    const event = await claimNext(leaseMs);
    if (!event) break;
    try {
      await bus.publish(toMessage(event));
    } catch (error) {
      // Le bail reste posé : l'événement sera repris à son expiration. On arrête le tour, le
      // bus est probablement indisponible
      await OutboxEvent.updateOne(
        { _id: event._id },
        { lastError: String(error?.message || error).slice(0, 500) }
      );
      console.error(
        `Relais : publication de l'événement ${event._id} impossible :`,
        error?.message
      );
      break;
    }
    await OutboxEvent.updateOne(
      { _id: event._id },
      { status: "published", publishedAt: new Date(), $unset: { lockedUntil: 1 } }
    );
    published += 1;
  }
  return published;
}

// Boucle du relais : un tour toutes les `intervalMs` (tout de suite si le tour était plein).
// Un tour en échec (base indisponible…) est journalisé sans arrêter la boucle.
export function startRelay(bus, { intervalMs = 1000, limit = 50, leaseMs } = {}) {
  let stopped = false;
  let timer;
  let current = Promise.resolve();

  const tick = async () => {
    let published = 0;
    try {
      published = await relayBatch(bus, { limit, leaseMs });
    } catch (error) {
      console.error("Relais : tour en échec :", error?.message);
    }
    if (stopped) return;
    timer = setTimeout(
      () => {
        current = tick();
      },
      published >= limit ? 0 : intervalMs
    );
  };

  current = tick();
  return {
    stop: async () => {
      stopped = true;
      clearTimeout(timer);
      await current;
    },
  };
}
