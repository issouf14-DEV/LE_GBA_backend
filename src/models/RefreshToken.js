import mongoose from "mongoose";

// Jetons de renouvellement : seul leur hash SHA-256 est stocké (une fuite de la base ne donne
// aucune session). Une « famille » regroupe les jetons issus d'une même connexion.
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    // Remplacé par un nouveau jeton (rotation), et non révoqué par une déconnexion
    rotatedAt: { type: Date },
  },
  { timestamps: true }
);

// Suppression automatique par MongoDB après expiration
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.models.RefreshToken || mongoose.model("RefreshToken", refreshTokenSchema);
