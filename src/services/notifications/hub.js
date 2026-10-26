// Flux SSE ouverts dans ce processus, rangés par utilisateur. Une notification n'est remise
// qu'aux flux de son destinataire : un compte ne reçoit jamais celles d'un autre.

export const MAX_STREAMS_PER_USER = 5;

// userId (chaîne) -> Set de connexions { send(notification), close() }
const streams = new Map();

// false si l'utilisateur a déjà le nombre maximal de flux ouverts (onglets, appareils)
export function addStream(userId, connection) {
  const key = String(userId);
  const set = streams.get(key) ?? new Set();
  if (set.size >= MAX_STREAMS_PER_USER) return false;
  set.add(connection);
  streams.set(key, set);
  return true;
}

export function removeStream(userId, connection) {
  const key = String(userId);
  const set = streams.get(key);
  if (!set) return;
  set.delete(connection);
  if (set.size === 0) streams.delete(key);
}

// Remet une notification (document inséré) aux flux ouverts de son destinataire
export function dispatch(notification) {
  const set = streams.get(String(notification?.user));
  if (!set) return 0;
  for (const connection of [...set]) {
    try {
      connection.send(notification);
    } catch {
      connection.close();
    }
  }
  return set.size;
}

export const connectedUserIds = () => [...streams.keys()];

export const streamCount = () => [...streams.values()].reduce((sum, set) => sum + set.size, 0);

// Arrêt du serveur : tous les flux sont fermés (sinon server.close attendrait indéfiniment)
export function closeAllStreams() {
  for (const set of [...streams.values()]) {
    for (const connection of [...set]) connection.close();
  }
  streams.clear();
}
