import express from "express";
import {
  createVehicle,
  deleteVehicle,
  getVehicleById,
  getVehicleImage,
  getVehicles,
  updateVehicle,
} from "../controllers/vehicleController.js";
import { authorize, protect } from "../middlewares/auth.js";
import { jsonBody } from "../middlewares/security.js";
import { validate } from "../middlewares/validate.js";
import { idParam } from "../schemas/common.js";
import { vehicleQuery, vehicleSchema } from "../schemas/vehicle.js";

const router = express.Router();
const withId = validate(idParam, "params");
// Gestion du catalogue : permission vehicles.manage
const canManage = authorize("vehicles.manage");
// Photos en base64 : corps jusqu'à 3 Mo, lu uniquement pour un admin authentifié
const photoJson = jsonBody("3mb");

// Public
router.get("/", validate(vehicleQuery, "query"), getVehicles);
router.get("/:id", withId, getVehicleById);
router.get("/:id/image", withId, getVehicleImage);

// Administration
router.post("/", protect, canManage, photoJson, validate(vehicleSchema), createVehicle);
router.put("/:id", protect, canManage, withId, photoJson, validate(vehicleSchema), updateVehicle);
router.delete("/:id", protect, canManage, withId, deleteVehicle);

export default router;
