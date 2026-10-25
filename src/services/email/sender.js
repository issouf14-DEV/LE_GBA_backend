import { env } from "../../config/env.js";
import { emailConfig, PROVIDERS } from "./providers.js";

const config = emailConfig(env);
let warned = false;

// Un échec d'envoi n'interrompt jamais la requête de l'utilisateur. Les journaux indiquent le
// type d'email et la raison du refus, jamais le contenu ni la clé
export async function sendEmail({ to, subject, html, kind }) {
  if (!config.enabled) {
    if (env.NODE_ENV !== "test" && !warned) {
      warned = true;
      console.warn(
        `Emails désactivés : renseignez EMAIL_PROVIDER, la clé API (${config.provider}) et EMAIL_FROM`
      );
    }
    return false;
  }
  // Compte supprimé entre-temps, ou adresse absente : rien à envoyer
  if (!to) return false;
  try {
    await PROVIDERS[config.provider]({ ...config, to, subject, html });
    return true;
  } catch (error) {
    console.error(`Échec de l'email « ${kind} » :`, error.message);
    return false;
  }
}
