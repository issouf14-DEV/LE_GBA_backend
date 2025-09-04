// models/Vehicle.js
import mongoose from "mongoose";

const vehicleSchema = new mongoose.Schema(
  {
    vin: { type: String, unique: true, sparse: true },
    brand: String, // marque
    model: String, // modèle
    year: Number, // année
    drivetrain: String, // ex: "4WD"
    engine: String, // ex: "Diesel"
    fuel: String, // ex: "Diesel"
    transmission: String, // ex: "Automatic"
    exteriorColor: String,
    interiorColor: String,
    doors: Number,
    seats: Number,
    price: Number,
    miles: Number,
    image: String, // ✅ image principale
    photos: [String], // ✅ toutes les photos
    description: String,
    stock: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export default mongoose.model("Vehicle", vehicleSchema);
