import mongoose from "mongoose";
import { env } from "./env.js";

// Refuse les opérateurs MongoDB ($gt, $ne…) cachés dans les filtres : bloque l'injection NoSQL
mongoose.set("sanitizeFilter", true);
mongoose.set("strictQuery", true);

export default async function connectDB(uri = env.MONGO_URI) {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connecté");
  } catch (error) {
    console.error("Connexion MongoDB impossible :", error.message);
    process.exit(1);
  }
}
