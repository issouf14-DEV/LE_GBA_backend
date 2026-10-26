import mongoose from "mongoose";

// Événements déjà traités par un consommateur : un message livré deux fois (livraison « au moins
// une fois ») n'est traité qu'une seule fois
const processedEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true },
  consumer: { type: String, required: true },
  processedAt: { type: Date, default: Date.now },
});

processedEventSchema.index({ eventId: 1, consumer: 1 }, { unique: true });
// Au-delà de 30 jours, plus aucun nouvel essai ne peut arriver : purge automatique
processedEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

export default mongoose.models.ProcessedEvent ||
  mongoose.model("ProcessedEvent", processedEventSchema);
