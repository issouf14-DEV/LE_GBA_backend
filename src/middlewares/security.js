import { timingSafeEqual } from "node:crypto";
import cors from "cors";
import express from "express";
import { env, frontendOrigins, isProduction } from "../config/env.js";
import { httpError } from "./errorMiddleware.js";

const DEV_ORIGINS = ["http://localhost:5173", "http://localhost:4173"];
const allowedOrigins = new Set([...frontendOrigins, ...(isProduction ? [] : DEV_ORIGINS)]);

// CORS : uniquement les origines exactes du frontend (aucun joker *.vercel.app)
export const corsPolicy = cors({
  origin(origin, callback) {
    // Sans en-tête Origin : requête même-site relayée par le proxy, ou appel serveur
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "X-Requested-With"],
  maxAge: 600,
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Protection CSRF : un formulaire ou une image d'un autre site ne peut pas ajouter cet en-tête.
// Toute requête qui modifie des données doit donc venir du code JavaScript du site lui-même.
export function requireAjax(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (req.get("X-Requested-With") !== "XMLHttpRequest") {
    return res.status(403).json({ message: "Requête refusée" });
  }
  const origin = req.get("Origin");
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ message: "Origine non autorisée" });
  }
  return next();
}

// Profondeur maximale d'un corps JSON : aucun formulaire du site ne dépasse 3 niveaux.
// Au-delà, la requête est refusée (un JSON imbriqué sur des milliers de niveaux bloquait le serveur)
const MAX_DEPTH = 8;

// Supprime les clés MongoDB dangereuses ($where, $gt, a.b…) et __proto__ du corps des requêtes
function stripOperators(value, depth = 0) {
  if (depth > MAX_DEPTH) throw httpError(400, "Corps de requête trop imbriqué");
  if (Array.isArray(value)) return value.map((item) => stripOperators(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !key.startsWith("$") && !key.includes(".") && key !== "__proto__")
        .map(([key, child]) => [key, stripOperators(child, depth + 1)])
    );
  }
  return value;
}

export function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === "object") req.body = stripOperators(req.body);
  next();
}

// Lecture du corps JSON, toujours APRÈS les limites et le contrôle anti-CSRF.
// Corps compressés refusés (inflate: false) : quelques Ko de gzip pouvaient en devenir des Mo.
export const jsonBody = (limit) => [express.json({ limit, inflate: false }), sanitizeBody];

// Secret ajouté par le proxy Vercel : sans lui, l'appel ne vient pas du site (appel direct à
// l'hébergeur, avec une IP inventée dans X-Forwarded-For pour contourner les limites)
const proxySecrets = [env.PROXY_SECRET, env.PROXY_SECRET_PREVIOUS]
  .filter(Boolean)
  .map((value) => Buffer.from(value));

// Comparaison à durée constante (le temps de réponse ne révèle rien du secret)
const matches = (received, secret) =>
  received.length === secret.length && timingSafeEqual(received, secret);

export function requireProxy(req, res, next) {
  if (!env.PROXY_SECRET) return next();
  const received = Buffer.from(req.get("X-Proxy-Auth") || "");
  if (!proxySecrets.some((secret) => matches(received, secret))) {
    return res.status(403).json({ message: "Accès direct refusé" });
  }
  return next();
}
