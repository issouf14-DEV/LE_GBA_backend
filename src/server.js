import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./config/db.js";
import User from "./models/User.js";
import bcrypt from "bcryptjs";
// import { importCarsFromVehicleDatabase } from "./services/vehicleDatabaseService.js"; // ✅ ajoute ton service

dotenv.config();
const PORT = process.env.PORT || 5000;

// Connexion à la DB
connectDB();

const createAdmin = async () => {
  try {
    const adminExist = await User.findOne({ email: process.env.ADMIN_EMAIL });
    if (!adminExist) {
      const admin = new User({
        name: process.env.ADMIN_NAME,
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
        role: "admin",
      });
      await admin.save(); // ⚠️ Save déclenche le hash bcrypt
      console.log("✅ Admin créé");
    }
  } catch (error) {
    console.error("❌ Erreur création admin :", error.message);
  }
};

// ⚡ Importer les véhicules automatiquement
// const importVehicles = async () => {
//   try {
//     const result = await importCarsFromVehicleDatabase();
//     console.log(`🚗 Import terminé : ${result.imported} véhicules`);
//   } catch (error) {
//     console.error("❌ Erreur import véhicules :", error.message);
//   }
// };

// Exécution au démarrage
(async () => {
  try {
    await createAdmin();
    // await importVehicles();
    
    app.listen(PORT, () => {
      console.log(`🚀 Serveur lancé sur le port ${PORT}`);
      console.log(`🌍 Environnement: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error("❌ Erreur au démarrage du serveur:", error.message);
    process.exit(1);
  }
})();
