// Diagnostic de l'envoi des emails :  npm run email:test -- destinataire@exemple.com
// Lit la configuration du fichier .env et affiche la cause exacte d'un échec (jamais la clé).
import dotenv from "dotenv";
import { EmailError, emailConfig, PROVIDERS } from "../src/services/email/providers.js";

dotenv.config();
const to = process.argv[2];
const config = emailConfig(process.env);

const fail = (message) => {
  console.error(`ÉCHEC : ${message}`);
  process.exit(1);
};

if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
  fail("indiquez une adresse : npm run email:test -- vous@exemple.com");
}
if (!PROVIDERS[config.provider]) fail(`EMAIL_PROVIDER inconnu : « ${config.provider} »`);
if (!config.apiKey) {
  const name = config.provider === "sendgrid" ? "SENDGRID_API_KEY" : "BREVO_API_KEY";
  fail(`${name} est vide dans .env`);
}
if (!config.from.email)
  fail("EMAIL_FROM est vide dans .env (adresse vérifiée chez le fournisseur)");

console.log(`Fournisseur : ${config.provider} | Expéditeur : ${config.from.email} | Vers : ${to}`);
try {
  await PROVIDERS[config.provider]({
    ...config,
    to,
    subject: "Test d'envoi LE-GBA",
    html: "<p>Si vous lisez ce message, l'envoi des emails fonctionne.</p>",
  });
  console.log("OK : email accepté par le fournisseur. Vérifiez aussi le dossier Spam.");
} catch (error) {
  if (!(error instanceof EmailError)) fail(`réseau ou délai dépassé : ${error.message}`);
  const hints = {
    401: "clé API invalide ou révoquée",
    403: "compte suspendu, offre expirée, ou adresse d'expédition non vérifiée",
  };
  fail(`${error.message}${hints[error.status] ? `\n→ Piste : ${hints[error.status]}` : ""}`);
}
