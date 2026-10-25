// Variables d'environnement validées au démarrage : le serveur refuse de démarrer sans elles
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

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
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  for (const issue of parsed.error.issues) {
    console.error(`Configuration invalide : ${issue.path.join(".")} - ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === "production";
export const frontendOrigins = env.FRONTEND_URL.split(",").map((url) =>
  url.trim().replace(/\/$/, "")
);
export const publicSiteUrl = frontendOrigins[0];
