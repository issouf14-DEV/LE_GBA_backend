import mongoose from "mongoose";

export const VEHICLE_TYPES = ["thermal", "electric", "hybrid"];
export const MAX_PHOTOS = 8;

const vehicleSchema = new mongoose.Schema(
  {
    brand: { type: String, required: true, trim: true, maxlength: 50 },
    model: { type: String, required: true, trim: true, maxlength: 80 },
    year: Number,
    // Catégorie obligatoire : thermique, électrique ou hybride
    type: { type: String, enum: VEHICLE_TYPES, required: true },
    fuel: { type: String, maxlength: 30 },
    transmission: { type: String, maxlength: 30 },
    power: { type: String, maxlength: 30 },
    engineSize: { type: String, maxlength: 30 },
    color: { type: String, maxlength: 30 },
    doors: Number,
    seats: Number,
    // Prix de location par jour (FCFA)
    price: { type: Number, required: true, min: 0 },
    mileage: { type: Number, min: 0, default: 0 },
    // Photos envoyées par l'équipe, dans l'ordre d'affichage (la première est la principale).
    // Seuls leurs identifiants sont ici ; le contenu est dans la collection VehiclePhoto.
    gallery: {
      type: [{ _id: { type: mongoose.Schema.Types.ObjectId, required: true } }],
      default: [],
      validate: [(list) => list.length <= MAX_PHOTOS, `${MAX_PHOTOS} photos maximum`],
    },
    // Anciennes images (adresses https d'avant la gestion des photos) : conservées et affichées
    // tant que l'équipe n'a pas ajouté de photo. Plus aucune adresse externe n'est acceptée.
    legacyImages: { type: [String], default: undefined, select: true },
    description: { type: String, maxlength: 1000 },
    tags: [{ type: String, maxlength: 30 }],
    available: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Vehicle || mongoose.model("Vehicle", vehicleSchema);
