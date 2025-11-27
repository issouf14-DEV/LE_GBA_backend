// routes/vehicleRoutes.js
import express from "express";
import {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  searchVehicles,
} from "../controllers/vehicleController.js";
import {
  importVehicleDatabase,
  getAdminVehicles,
  clearAllVehicles,
  getImportStatus,
} from "../controllers/adminController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

// 🚗 Recherche doit venir AVANT /:id
router.get("/search", searchVehicles);

// 🔧 Routes admin pour la gestion des véhicules (protection admin)
router.get("/admin/all", protect, adminOnly, getAdminVehicles); // Voir tous les véhicules (admin)
router.get("/admin/status", protect, adminOnly, getImportStatus); // Statut de l'importation
router.post("/admin/import", protect, adminOnly, importVehicleDatabase); // Importer les véhicules
router.delete("/admin/clear", protect, adminOnly, clearAllVehicles); // Vider la base

// 📋 CRUD véhicules standard
router.get("/", getVehicles); // Voir véhicules (public)
router.get("/:id", getVehicleById); // Voir un véhicule (public)
router.post("/", protect, adminOnly, createVehicle); // Créer véhicule (admin)
router.put("/:id", protect, adminOnly, updateVehicle); // Modifier véhicule (admin)
router.delete("/:id", protect, adminOnly, deleteVehicle); // Supprimer véhicule (admin)

export default router;
