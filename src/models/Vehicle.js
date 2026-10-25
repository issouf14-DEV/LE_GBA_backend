import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    brand: { type: String, required: true, trim: true, maxlength: 50 },
    model: { type: String, required: true, trim: true, maxlength: 80 },
    year: Number,
    type: { type: String, enum: ["thermal", "electric", "hybrid"], default: "thermal" },
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
    // URL https d'une image hébergée ailleurs
    image: { type: String, default: "" },
    // Photo envoyée depuis l'administration (base64) : jamais incluse dans les listes,
    // servie à part par GET /api/vehicles/:id/image
    imageData: { type: String, select: false },
    imageType: { type: String, enum: ["image/png", "image/jpeg", "image/webp"], select: false },
    hasImageData: { type: Boolean, default: false },
    photos: [String],
    description: { type: String, maxlength: 1000 },
    tags: [{ type: String, maxlength: 30 }],
    available: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.models.Vehicle || mongoose.model("Vehicle", vehicleSchema);
