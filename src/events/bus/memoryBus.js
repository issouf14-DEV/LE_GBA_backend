// Bus en mémoire : même interface et même sémantique que le bus RabbitMQ (tests, développement).
// Routage selon les bindings des files, messages gardés tant qu'aucun consommateur n'est abonné,
// livraison asynchrone, nouvel essai avec délai puis file morte après MAX_ATTEMPTS tentatives.
import { MAX_ATTEMPTS, QUEUES, RETRY_DELAYS_MS, retryDelay } from "../topology.js";

// Copie par JSON : imite la sérialisation réelle (dates en chaînes, pas de référence partagée)
const copy = (value) => JSON.parse(JSON.stringify(value));

export function createMemoryBus({ retryDelaysMs = RETRY_DELAYS_MS, logger = console } = {}) {
  const queues = new Map(
    Object.keys(QUEUES).map((key) => [key, { handler: null, waiting: [], dead: [] }])
  );
  const timers = new Set();
  const running = new Set();
  let active = 0; // livraisons programmées + nouveaux essais en attente + handlers en cours
  let drainWaiters = [];
  let closed = false;

  const queueOf = (queueKey) => {
    const queue = queues.get(queueKey);
    if (!queue) throw new Error(`File inconnue : ${queueKey}`);
    return queue;
  };

  const settle = () => {
    active -= 1;
    if (active > 0) return;
    const waiters = drainWaiters;
    drainWaiters = [];
    for (const resolve of waiters) resolve();
  };

  const retryLater = (queue, entry) => {
    if (closed) return;
    active += 1;
    const timer = setTimeout(
      () => {
        timers.delete(timer);
        enqueue(queue, { body: entry.body, attempt: entry.attempt + 1 });
        settle();
      },
      retryDelay(retryDelaysMs, entry.attempt)
    );
    timers.add(timer);
  };

  async function run(queue, entry) {
    try {
      await queue.handler(copy(entry.body), { attempt: entry.attempt });
    } catch (err) {
      const { id, type } = entry.body;
      if (entry.attempt >= MAX_ATTEMPTS) {
        logger.error(`Événement ${id} (${type}) en file morte après ${entry.attempt} tentatives`);
        queue.dead.push(entry.body);
      } else {
        logger.warn(
          `Événement ${id} (${type}) en échec (tentative ${entry.attempt}) : ${err.message}`
        );
        retryLater(queue, entry);
      }
    }
  }

  function deliver(queue, entry) {
    active += 1;
    setImmediate(() => {
      if (closed) return settle();
      const task = run(queue, entry).finally(() => {
        running.delete(task);
        settle();
      });
      running.add(task);
    });
  }

  function enqueue(queue, entry) {
    if (closed) return;
    if (queue.handler) deliver(queue, entry);
    else queue.waiting.push(entry);
  }

  return {
    async publish(message) {
      if (closed) throw new Error("Bus fermé");
      const body = copy(message);
      for (const [key, queue] of queues) {
        if (QUEUES[key].bindings.includes(body.type))
          enqueue(queue, { body: copy(body), attempt: 1 });
      }
    },

    async consume(queueKey, handler) {
      const queue = queueOf(queueKey);
      if (queue.handler) throw new Error(`La file ${queueKey} a déjà un consommateur`);
      queue.handler = handler;
      for (const entry of queue.waiting.splice(0)) deliver(queue, entry);
    },

    deadLetters(queueKey) {
      return copy(queueOf(queueKey).dead);
    },

    drain() {
      if (active === 0) return Promise.resolve();
      return new Promise((resolve) => drainWaiters.push(resolve));
    },

    async close() {
      if (closed) return;
      closed = true;
      for (const timer of timers) {
        clearTimeout(timer);
        settle();
      }
      timers.clear();
      await Promise.allSettled([...running]);
    },
  };
}
