// Variables d'environnement validées au démarrage : le serveur refuse de démarrer sans elles
import dotenv from "dotenv";
import { z } from "zod";
import { paymentEnvIssue } from "./paymentEnv.js";

// En test, le fichier .env n'est JAMAIS lu : les tests ne doivent ni toucher la vraie base ni
// envoyer de vrais emails avec les clés du développeur
if (process.env.NODE_ENV !== "test") dotenv.config({ quiet: true });

const secret = (name) =>
  z.string().min(32, `${name} doit contenir au moins 32 caractères aléatoires`);

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(5000),
  MONGO_URI: z.string().min(1, "MONGO_URI manquant"),
  JWT_ACCESS_SECRET: secret("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: secret("JWT_REFRESH_SECRET"),
  // Une ou plusieurs URL exactes du frontend, séparées par des virgules
  FRONTEND_URL: z.string().min(1, "FRONTEND_URL manquant"),
  // Nombre de proxys devant le serveur (0 en local, 2 derrière Vercel + Northflank). Par défaut 0 :
  // sans proxy déclaré, l'en-tête X-Forwarded-For (falsifiable) est ignoré
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
  // Secret partagé avec le proxy Vercel (en-tête X-Proxy-Auth). Défini en production :
  // l'API refuse alors tout appel qui ne passe pas par le site
  PROXY_SECRET: z.string().min(32, "PROXY_SECRET doit contenir au moins 32 caractères").optional(),
  // Ancien secret, accepté pendant un changement de secret (supprimez-le une fois Vercel à jour)
  PROXY_SECRET_PREVIOUS: z.string().min(32).optional(),
  // Durée de validité du code « mot de passe oublié » (30 s à 15 min)
  RESET_CODE_TTL_SECONDS: z.coerce.number().int().min(30).max(900).default(30),
  // Clé de chiffrement des secrets 2FA (32 octets en base64), obligatoire en production.
  // Générer : node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  TOTP_ENC_KEY: z
    .string()
    .refine((value) => Buffer.from(value, "base64").length === 32, "32 octets encodés en base64")
    .optional(),
  // Nom affiché dans l'application d'authentification du téléphone
  MFA_ISSUER: z.string().max(40).default("LE-GBA"),
  // Bus d'événements (worker) : amqps://... en production. Absent en développement : bus en
  // mémoire et worker intégré à l'API
  RABBITMQ_URL: z
    .string()
    .regex(/^amqps?:\/\//, "doit commencer par amqp:// ou amqps://")
    .optional(),
  RABBITMQ_PREFETCH: z.coerce.number().int().min(1).max(100).default(10),
  RELAY_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1000),
  // Notifications de l'application : durée de conservation (jours) et intervalle du ping SSE
  // (le CDN Vercel coupe une réponse sans données au bout d'environ 120 s)
  NOTIFICATION_TTL_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  SSE_PING_MS: z.coerce.number().int().min(1000).max(100_000).default(25_000),
  ADMIN_NAME: z.string().optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().optional(),
  // Envoi des emails : Brevo (gratuit, 300/jour) par défaut, SendGrid possible
  EMAIL_PROVIDER: z.enum(["brevo", "sendgrid"]).default("brevo"),
  BREVO_API_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  // Adresse d'expédition, vérifiée chez le fournisseur (EMAIL_USER : ancien nom, encore accepté)
  EMAIL_FROM: z.string().email().optional(),
  EMAIL_USER: z.string().email().optional(),
  EMAIL_FROM_NAME: z.string().max(60).optional(),
  // Journal d'audit : durée de conservation en jours (purge automatique au-delà)
  AUDIT_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(365),
  // Paiement en ligne de l'acompte (Mobile Money) : désactivé par défaut, « fake » = simulé
  PAYMENT_PROVIDER: z.enum(["none", "fake", "cinetpay"]).default("none"),
  PAYMENT_DEPOSIT_PERCENT: z.coerce.number().int().min(1).max(100).default(30),
  CINETPAY_API_KEY: z.string().min(10).optional(),
  CINETPAY_SITE_ID: z
    .string()
    .regex(/^\d{1,20}$/, "identifiant numérique")
    .optional(),
  CINETPAY_SECRET_KEY: z.string().min(10).optional(),
});

// Une variable laissée vide (« PROXY_SECRET= ») compte comme absente
const defined = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== undefined && value.trim() !== "")
);
const parsed = schema.safeParse(defined);
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(`Configuration invalide : ${issue.path.join(".")} - ${issue.message}`);
  }
  process.exit(1);
}

// Sans clé, l'équipe ne pourrait plus se connecter (2FA obligatoire) : refus de démarrer
if (parsed.data.NODE_ENV === "production" && !parsed.data.TOTP_ENC_KEY) {
  console.error("Configuration invalide : TOTP_ENC_KEY manquant (obligatoire en production)");
  process.exit(1);
}

// Paiement : clés CinetPay obligatoires si activé, paiement simulé interdit en production
const paymentIssue = paymentEnvIssue(parsed.data);
if (paymentIssue) {
  console.error(`Configuration invalide : ${paymentIssue}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const frontendOrigins = env.FRONTEND_URL.split(",").map((url) =>
  url.trim().replace(/\/$/, "")
);
export const publicSiteUrl = frontendOrigins[0];
