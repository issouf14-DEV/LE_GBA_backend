import { env } from "./env.js";
import mongoose from "./mongoose.js";

export default async function connectDB(uri = env.MONGO_URI) {
  try {
    await mongoose.connect(uri);
    console.log("MongoDB connecté");
  } catch (error) {
    console.error("Connexion MongoDB impossible :", error.message);
    process.exit(1);
  }
}
