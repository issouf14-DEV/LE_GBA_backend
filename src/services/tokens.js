// Jetons de session : accès court (JWT 15 min) + renouvellement opaque (7 jours, usage unique)
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { ACCESS_TTL_MS, REFRESH_TTL_MS } from "../config/cookies.js";
import { env } from "../config/env.js";
import RefreshToken from "../models/RefreshToken.js";

// Deux onglets qui renouvellent la session au même instant présentent le même jeton :
// pendant ce court délai, ce n'est pas un vol (le navigateur a déjà reçu le nouveau cookie)
const ROTATION_GRACE_MS = 30_000;

const JWT_OPTIONS = { algorithm: "HS256", issuer: "le-gba", audience: "le-gba-web" };

// Empreinte HMAC avec un secret du serveur : même avec une copie de la base, impossible de
// vérifier un jeton deviné sans ce secret
export const hashToken = (token) =>
  createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest("hex");

// `sid` : famille de la session. Déconnexion ou vol détecté -> famille révoquée -> le jeton
// d'accès est refusé immédiatement (sans attendre ses 15 minutes)
export function signAccessToken(user, family) {
  const payload = { sub: String(user._id), ver: user.tokenVersion ?? 0, sid: family };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    ...JWT_OPTIONS,
    expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
  });
}

// Lève une erreur si le jeton est invalide, expiré, ou signé avec un autre algorithme
export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { ...JWT_OPTIONS, algorithms: ["HS256"] });
}

async function storeRefreshToken(userId, family) {
  const token = randomBytes(48).toString("base64url");
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(token),
    family,
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return token;
}

// Nouvelle connexion : nouvelle famille de jetons
export async function issueSession(user) {
  const family = randomUUID();
  return {
    accessToken: signAccessToken(user, family),
    refreshToken: await storeRefreshToken(user._id, family),
  };
}

// La session (famille) est-elle encore ouverte ?
export const isSessionActive = (family) =>
  typeof family === "string" && RefreshToken.exists({ family, revokedAt: null });

// Rotation : l'ancien jeton est consommé. S'il est présenté une seconde fois, c'est qu'il a été
// volé : toute la famille est révoquée et le voleur comme la victime sont déconnectés.
export async function rotateRefreshToken(token) {
  if (typeof token !== "string" || token.length > 200) return null;
  const record = await RefreshToken.findOne({ tokenHash: hashToken(token) });
  if (!record || record.expiresAt <= new Date()) return null;

  if (record.revokedAt) {
    if (record.rotatedAt && Date.now() - record.rotatedAt.getTime() < ROTATION_GRACE_MS) {
      return { userId: record.user, family: record.family, concurrent: true };
    }
    await RefreshToken.updateMany({ family: record.family }, { revokedAt: new Date() });
    return null;
  }

  const now = new Date();
  const consumed = await RefreshToken.findOneAndUpdate(
    { _id: record._id, revokedAt: null },
    { revokedAt: now, rotatedAt: now }
  );
  if (!consumed) return { userId: record.user, family: record.family, concurrent: true };

  return {
    userId: record.user,
    family: record.family,
    refreshToken: await storeRefreshToken(record.user, record.family),
  };
}

// Déconnexion : toute la famille est fermée (jeton d'accès compris, via `sid`)
export async function revokeRefreshToken(token) {
  if (typeof token !== "string" || token.length > 200) return;
  const record = await RefreshToken.findOne({ tokenHash: hashToken(token) });
  if (record) await RefreshToken.updateMany({ family: record.family }, { revokedAt: new Date() });
}

// Changement / réinitialisation du mot de passe, suppression du compte : toutes les sessions
export async function revokeAllSessions(userId) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}
