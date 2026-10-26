import express from "express";
import { getAvailability } from "../controllers/availabilityController.js";
import {
  createVehicle,
  deleteVehicle,
  getVehicleById,
  getVehicleImage,
  getVehicles,
  updateVehicle,
} from "../controllers/vehicleController.js";
import {
  deletePhoto,
  getPhoto,
  updatePhotoOrder,
  uploadPhoto,
} from "../controllers/vehiclePhotoController.js";
import { authorize, protect } from "../middlewares/auth.js";
import { limiter } from "../middlewares/rateLimits.js";
import { jsonBody } from "../middlewares/security.js";
import { validate } from "../middlewares/validate.js";
import { availabilityQuery } from "../schemas/availability.js";
import { idParam } from "../schemas/common.js";
import {
  photoOrderSchema,
  photoParams,
  photoSchema,
  vehicleQuery,
  vehicleSchema,
} from "../schemas/vehicle.js";

const router = express.Router();
const withId = validate(idParam, "params");
const withPhoto = validate(photoParams, "params");
// Gestion du catalogue : session + permission vehicles.manage, AVANT toute lecture du corps
const canManage = [protect, authorize("vehicles.manage")];
const smallJson = jsonBody("100kb");
// Photo en base64 : corps jusqu'à 3 Mo, lu seulement pour un membre autorisé
const photoJson = jsonBody("3mb");

// Public
router.get("/", validate(vehicleQuery, "query"), getVehicles);
router.get("/:id", withId, getVehicleById);
router.get("/:id/image", withId, getVehicleImage);
router.get("/:id/photos/:photoId", withPhoto, getPhoto);

// Calendrier de disponibilité : 120 consultations par quart d'heure et par adresse IP
const availabilityLimiter = limiter("availability", {
  minutes: 15,
  limit: 120,
  message: "Trop de consultations du calendrier. Réessayez dans quelques minutes.",
});
router.get(
  "/:id/availability",
  availabilityLimiter,
  withId,
  validate(availabilityQuery, "query"),
  getAvailability
);

// Administration du catalogue
router.post("/", ...canManage, smallJson, validate(vehicleSchema), createVehicle);
router.put("/:id", ...canManage, withId, smallJson, validate(vehicleSchema), updateVehicle);
router.delete("/:id", ...canManage, withId, deleteVehicle);

// Photos (8 maximum, la première est la photo principale)
router.post("/:id/photos", ...canManage, withId, photoJson, validate(photoSchema), uploadPhoto);
router.put(
  "/:id/photos/order",
  ...canManage,
  withId,
  smallJson,
  validate(photoOrderSchema),
  updatePhotoOrder
);
router.delete("/:id/photos/:photoId", ...canManage, withPhoto, deletePhoto);

export default router;
