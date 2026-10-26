// Source des notifications à pousser : un seul change stream MongoDB par processus API sur les
// insertions de la collection notifications, quel que soit le processus qui les crée (worker
// séparé ou intégré). Repli par interrogation périodique si le change stream est indisponible
// (MongoDB autonome, sans replica set). Démarré à l'ouverture du premier flux SSE.
import mongoose from "mongoose";
import Notification from "../../models/Notification.js";
import { connectedUserIds, dispatch } from "./hub.js";

const RESTART_MS = 2000;
const MAX_FAILURES = 5;
const STABLE_MS = 60_000;
export const POLL_MS = 5000;
// Recouvrement des fenêtres d'interrogation : écart d'horloge entre le worker et l'API
const OVERLAP_MS = 10_000;
// Codes MongoDB : change stream refusé hors replica set / opération non permise
const UNSUPPORTED = new Set([40573, 20]);

let state = null;

const log = (text) => console.warn(`Notifications : ${text}`);

function markReady() {
  state.resolveReady?.();
  state.resolveReady = null;
}

function startPolling(pollMs = POLL_MS) {
  state.mode = "poll";
  state.seen = new Map();
  state.since = Date.now() - OVERLAP_MS;
  const tick = async () => {
    const users = connectedUserIds().filter((id) => mongoose.isValidObjectId(id));
    const from = new Date(state.since - OVERLAP_MS);
    state.since = Date.now();
    if (users.length === 0) return;
    const docs = await Notification.find({
      user: mongoose.trusted({ $in: users }),
      createdAt: mongoose.trusted({ $gt: from }),
    })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    for (const doc of docs) {
      const id = String(doc._id);
      if (state.seen.has(id)) continue;
      state.seen.set(id, doc.createdAt.getTime());
      dispatch(doc);
    }
    for (const [id, time] of state.seen) if (time < from.getTime()) state.seen.delete(id);
  };
  const loop = () => {
    if (state?.mode !== "poll") return;
    tick()
      .catch((error) => log(`interrogation impossible (${error.message})`))
      .finally(() => {
        if (state?.mode === "poll") state.timer = setTimeout(loop, pollMs).unref();
      });
  };
  markReady();
  loop();
}

function closeChangeStream() {
  const stream = state?.stream;
  if (!stream) return;
  // Les écouteurs restent en place (une erreur sans écouteur ferait planter le processus) :
  // ils ignorent tout flux qui n'est plus le flux courant
  state.stream = null;
  Promise.resolve(stream.close()).catch(() => {});
}

function onStreamError(error, stream) {
  if (state?.mode !== "change-stream" || state.stream !== stream) return;
  closeChangeStream();
  // Un change stream resté ouvert longtemps n'est pas un échec répété
  state.failures = Date.now() - state.openedAt > STABLE_MS ? 1 : state.failures + 1;
  if (UNSUPPORTED.has(error?.code) || state.failures >= MAX_FAILURES) {
    log(`change stream indisponible (${error?.message}), repli par interrogation`);
    return startPolling();
  }
  log(`change stream interrompu (${error?.message}), reprise`);
  state.timer = setTimeout(openChangeStream, RESTART_MS).unref();
}

function openChangeStream() {
  if (state?.mode !== "change-stream") return;
  state.openedAt = Date.now();
  // Reprise après une coupure : à partir du dernier jeton connu, sans perdre d'insertion
  const options = state.resumeToken ? { startAfter: state.resumeToken } : {};
  let stream;
  try {
    stream = Notification.watch([{ $match: { operationType: "insert" } }], options);
  } catch (error) {
    return onStreamError(error, state.stream);
  }
  state.stream = stream;
  const current = () => state?.stream === stream;
  stream.on(
    "change",
    (change) => current() && change.fullDocument && dispatch(change.fullDocument)
  );
  // Émis à l'ouverture (jeton initial) puis après chaque lot : le flux est prêt
  stream.on("resumeTokenChanged", (token) => {
    if (!current()) return;
    if (token) state.resumeToken = token;
    markReady();
  });
  stream.on("error", (error) => onStreamError(error, stream));
  stream.on("close", () => onStreamError(new Error("change stream fermé"), stream));
}

// mode "poll" et pollMs : imposés par les tests ; par défaut, change stream
export function ensureFeed({ mode = "change-stream", pollMs = POLL_MS } = {}) {
  if (state) return state.ready;
  state = { mode, failures: 0, stream: null, timer: null, resumeToken: null };
  state.ready = new Promise((resolve) => {
    state.resolveReady = resolve;
  });
  if (mode === "poll") startPolling(pollMs);
  else openChangeStream();
  return state.ready;
}

export const feedMode = () => state?.mode ?? null;

export async function stopFeed() {
  if (!state) return;
  clearTimeout(state.timer);
  closeChangeStream();
  markReady();
  state = null;
}
