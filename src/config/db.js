import mongoose from "mongoose";

const GBA_DB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB connecté : ${mongoose.connection.host}`);
  } catch (error) {
    console.error("❌ Erreur connexion DB:", error.message);
    process.exit(1); // Arrête le serveur si la DB ne se connecte pas
  }
};

export default GBA_DB;
