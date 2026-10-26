import mongoose from "mongoose";

// Photo d'un véhicule envoyée par l'équipe. Stockée à part : les listes de véhicules ne
// transportent que les identifiants des photos, jamais leur contenu (jusqu'à 2 Mo chacune).
const vehiclePhotoSchema = new mongoose.Schema(
  {
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true, index: true },
    type: { type: String, enum: ["image/png", "image/jpeg", "image/webp"], required: true },
    data: { type: Buffer, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.models.VehiclePhoto || mongoose.model("VehiclePhoto", vehiclePhotoSchema);
