// Compteurs des limites de tentatives stockés dans MongoDB : ils survivent aux redémarrages et
// aux redéploiements (en mémoire, ils repartaient de zéro à chaque redémarrage)
import mongoose from "mongoose";

const collection = () => mongoose.connection.collection("ratelimits");
let indexReady = false;

export class MongoStore {
  constructor(prefix) {
    this.prefix = prefix;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    if (!indexReady) {
      indexReady = true;
      // Suppression automatique des compteurs expirés
      await collection()
        .createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 })
        .catch(() => {});
    }
    const now = new Date();
    const active = { $gt: ["$resetAt", now] };
    // Mise à jour atomique : +1 dans la fenêtre en cours, sinon nouvelle fenêtre
    const doc = await collection().findOneAndUpdate(
      { _id: `${this.prefix}:${key}` },
      [
        {
          $set: {
            hits: { $cond: [active, { $add: ["$hits", 1] }, 1] },
            resetAt: { $cond: [active, "$resetAt", new Date(now.getTime() + this.windowMs)] },
          },
        },
      ],
      { upsert: true, returnDocument: "after" }
    );
    return { totalHits: doc.hits, resetTime: doc.resetAt };
  }

  // Appelé après la réponse (connexion réussie non comptée) : un échec ici est sans gravité,
  // il ne doit pas devenir une erreur non interceptée
  async decrement(key) {
    await collection()
      .updateOne({ _id: `${this.prefix}:${key}` }, { $inc: { hits: -1 } })
      .catch(() => {});
  }

  async resetKey(key) {
    await collection().deleteOne({ _id: `${this.prefix}:${key}` });
  }
}
