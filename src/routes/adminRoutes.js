// routes/adminRoutes.js
import express from "express";
import {
  getDashboardStats,
  getAllUsers,
  deleteUser,
  updateUser,
  importVehicleDatabase,
  getAdminVehicles,
  clearAllVehicles,
  getImportStatus,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

// 🔒 Toutes les routes admin nécessitent une authentification admin
router.use(protect);
router.use(adminOnly);

// 📊 Dashboard & Stats
router.get("/dashboard", getDashboardStats);

// 👤 Gestion des utilisateurs
router.get("/users", getAllUsers);
router.put("/users/:id", updateUser);
router.delete("/users/:id", deleteUser);

// 🚗 Gestion des véhicules
router.get("/vehicles", getAdminVehicles); // Voir tous les véhicules
router.get("/vehicles/status", getImportStatus); // Statut de l'importation
router.post("/vehicles/import", importVehicleDatabase); // Importer les véhicules
router.delete("/vehicles/clear", clearAllVehicles); // Vider la base

export default router;
