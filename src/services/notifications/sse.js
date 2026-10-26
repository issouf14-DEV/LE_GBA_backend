// Flux SSE (text/event-stream) des notifications d'un utilisateur connecté. Ouvert après
// `protect` (session vérifiée), revérifié à chaque ping, fermé à l'expiration du jeton d'accès :
// le navigateur rafraîchit alors sa session puis rouvre le flux.
import { env } from "../../config/env.js";
import Notification, { publicNotification } from "../../models/Notification.js";
import User from "../../models/User.js";
import { isSessionActive } from "../tokens.js";
import { ensureFeed } from "./feed.js";
import { addStream, MAX_STREAMS_PER_USER, removeStream } from "./hub.js";

// Délai de reconnexion conseillé au navigateur (directive retry:)
export const RETRY_MS = 10_000;
// Client trop lent qui n'absorbe plus les données : flux fermé plutôt que mémoire qui gonfle
const MAX_BUFFER = 256 * 1024;
// setTimeout est limité à environ 24,8 jours
const MAX_TIMER = 2 ** 31 - 1;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

// Même contrôle que `protect` : compte actif, session ouverte, mot de passe inchangé
async function sessionStillValid(req) {
  const [user, active] = await Promise.all([
    User.findById(req.user._id).select("tokenVersion disabledAt").lean(),
    isSessionActive(req.auth.sid),
  ]);
  return Boolean(
    user && !user.disabledAt && active && (user.tokenVersion ?? 0) === (req.user.tokenVersion ?? 0)
  );
}

export async function openNotificationStream(req, res) {
  const userId = String(req.user._id);
  let closed = false;
  const timers = [];

  const write = (chunk) => {
    if (closed) return;
    res.write(chunk);
    if (res.writableLength > MAX_BUFFER) connection.close();
  };
  const event = (name, data) => write(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);

  const connection = {
    send: (doc) => event("notification", publicNotification(doc)),
    close: () => {
      if (closed) return;
      closed = true;
      for (const timer of timers) clearTimeout(timer);
      removeStream(userId, connection);
      res.end();
    },
  };

  if (!addStream(userId, connection)) {
    closed = true;
    return res.status(429).json({
      message: `${MAX_STREAMS_PER_USER} connexions ouvertes au maximum. Fermez un onglet.`,
    });
  }
  // Onglet fermé, réseau coupé : `close` de la réponse (celui de la requête arrive dès sa lecture)
  res.on("close", connection.close);

  res.status(200).set(SSE_HEADERS);
  res.flushHeaders();
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  write(`retry: ${RETRY_MS}\n\n`);
  try {
    await ensureFeed();
    const unread = await Notification.countDocuments({ user: req.user._id, readAt: null });
    event("ready", { unread });
  } catch {
    // En-têtes déjà envoyés : pas de réponse d'erreur JSON possible, le navigateur se reconnecte
    return connection.close();
  }
  if (closed) return;

  // Ping : garde la connexion ouverte à travers les proxys (Vercel coupe après ~120 s sans
  // données) et revérifie la session (déconnexion, compte désactivé, mot de passe changé)
  const ping = setInterval(async () => {
    write(": ping\n\n");
    // Base momentanément injoignable : le flux reste ouvert (l'expiration du jeton le fermera)
    const valid = await sessionStillValid(req).catch(() => true);
    if (!valid) connection.close();
  }, env.SSE_PING_MS);
  // Jeton d'accès expiré : le flux est fermé, le navigateur renouvelle sa session et se reconnecte
  const remaining = Math.min(Math.max(req.auth.exp * 1000 - Date.now(), 0), MAX_TIMER);
  const expiry = setTimeout(() => {
    event("reauth", {});
    connection.close();
  }, remaining);
  timers.push(ping, expiry);
}
