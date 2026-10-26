// Contrat partagé du bus d'événements : noms RabbitMQ, types d'événements et politique de nouvel essai.
// Les messages ne transportent que des identifiants : les consommateurs relisent la base.

export const EXCHANGE = "gba.events";
export const DEAD_LETTER_EXCHANGE = "gba.dlx";
export const MAX_ATTEMPTS = 5;
// Délai avant le nouvel essai, après la 1re, 2e, 3e, 4e tentative
export const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000];

// Délai avant le nouvel essai qui suit la tentative donnée (le dernier délai au-delà de la liste)
export const retryDelay = (delays, attempt) => delays[Math.min(attempt, delays.length) - 1] ?? 0;

// Une file d'attente par délai (ex. gba.email.retry.5000ms) : RabbitMQ n'expire les messages qu'en
// tête de file ; avec un seul délai par file, un essai à 5 s n'attend jamais derrière un essai à 10 min
export const retryQueueName = (queue, delayMs) => `${queue.retry}.${delayMs}ms`;

// Types d'événements (routing keys) du projet
export const EVENTS = {
  orderCreated: "order.created", // payload { orderId }
  orderStatusChanged: "order.status_changed", // payload { orderId, status }
  passwordChanged: "user.password_changed", // payload { userId }
  mfaEnabled: "user.mfa_enabled", // payload { userId }
  mfaReset: "user.mfa_reset", // payload { userId }
  paymentAccepted: "payment.accepted", // payload { orderId, paymentId }
};

export const QUEUES = {
  email: {
    name: "gba.email",
    retry: "gba.email.retry",
    dead: "gba.email.dead",
    bindings: [
      EVENTS.orderCreated,
      EVENTS.orderStatusChanged,
      EVENTS.passwordChanged,
      EVENTS.mfaEnabled,
      EVENTS.mfaReset,
      EVENTS.paymentAccepted,
    ],
  },
  // Notifications de l'application (cloche), poussées en temps réel par l'API (SSE)
  inapp: {
    name: "gba.inapp",
    retry: "gba.inapp.retry",
    dead: "gba.inapp.dead",
    bindings: [
      EVENTS.orderCreated,
      EVENTS.orderStatusChanged,
      EVENTS.passwordChanged,
      EVENTS.mfaEnabled,
      EVENTS.mfaReset,
    ],
  },
};
