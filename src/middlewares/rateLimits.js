import { createHash } from "node:crypto";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";
import { MongoStore } from "./rateLimitStore.js";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const ip = (req) => ipKeyGenerator(req.ip);
// L'email visé est haché : il n'est jamais stocké en clair dans les compteurs
const email = (req) =>
  typeof req.body?.email === "string" ? hash(req.body.email.toLowerCase()) : "";

const limiter = (name, { minutes, limit, message, key = ip, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs: minutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { message },
    keyGenerator: key,
    skipSuccessfulRequests,
    store: new MongoStore(name),
    // Les tests automatiques enchaînent des centaines de requêtes depuis la même adresse
    skip: () => env.NODE_ENV === "test" && !process.env.TEST_RATE_LIMITS,
  });

const TOO_MANY = "Trop de tentatives. Réessayez dans 15 minutes.";

// Toute l'API : protège contre le déni de service et le scraping massif
export const apiLimiter = limiter("api", {
  minutes: 15,
  limit: 300,
  message: "Trop de requêtes. Réessayez dans quelques minutes.",
});

// Connexion : 5 échecs par compte ET par adresse IP. Un attaquant ne peut donc pas bloquer
// la victime (elle se connecte depuis une autre adresse) ; une connexion réussie ne compte pas.
export const loginLimiter = limiter("login", {
  minutes: 15,
  limit: 5,
  message: TOO_MANY,
  key: (req) => `${email(req)}:${ip(req)}`,
  skipSuccessfulRequests: true,
});

// Connexion : 30 échecs par IP, tous comptes confondus (plusieurs clients derrière un même
// réseau mobile ne se bloquent pas entre eux)
export const loginIpLimiter = limiter("login-ip", {
  minutes: 15,
  limit: 30,
  message: TOO_MANY,
  skipSuccessfulRequests: true,
});

// Inscription : création de comptes en masse
export const registerLimiter = limiter("register", {
  minutes: 60,
  limit: 10,
  message: "Trop d'inscriptions depuis cette adresse. Réessayez plus tard.",
});

// Changement et réinitialisation du mot de passe
export const passwordLimiter = limiter("password", { minutes: 15, limit: 10, message: TOO_MANY });

// Emails déclenchés par un utilisateur (mot de passe oublié, renvoi) : contre le spam
export const emailLimiter = limiter("email", {
  minutes: 60,
  limit: 5,
  message: "Trop de demandes d'email. Réessayez plus tard.",
});

// Mot de passe oublié : 3 emails par heure au maximum vers une même adresse
export const forgotEmailLimiter = limiter("forgot", {
  minutes: 60,
  limit: 3,
  message: "Trop de demandes pour cette adresse. Réessayez plus tard.",
  key: (req) => email(req) || ip(req),
});

// Réservations : 10 par heure et par compte (contre le blocage du catalogue par des robots)
export const orderLimiter = limiter("order", {
  minutes: 60,
  limit: 10,
  message: "Trop de réservations. Réessayez plus tard.",
  key: (req) => String(req.user?._id || ip(req)),
});

// Après une réinitialisation réussie, le compte repart sans tentatives comptées
export const clearLoginLimits = (userEmail, req) =>
  loginLimiter.resetKey(`${hash(userEmail.toLowerCase())}:${ip(req)}`);
