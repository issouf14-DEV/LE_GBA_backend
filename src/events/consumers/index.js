// Abonnement des consommateurs aux files du bus
import { handleEmailEvent } from "./email.js";
import { handleInappEvent } from "./inapp.js";
import { once } from "./once.js";

export async function startConsumers(bus) {
  await bus.consume("email", once("email", handleEmailEvent));
  await bus.consume("inapp", once("inapp", handleInappEvent));
}
