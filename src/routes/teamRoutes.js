import express from "express";
import {
  deleteManager,
  inviteManager,
  listPermissions,
  listTeam,
  updateManagerStatus,
  updatePermissions,
} from "../controllers/teamController.js";
import { protect, superadminOnly } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { idParam } from "../schemas/common.js";
import { accountStatusSchema, inviteManagerSchema, permissionsSchema } from "../schemas/team.js";

const router = express.Router();
const withId = validate(idParam, "params");

// Gestion de l'équipe : réservée au superadmin. Aucune permission de gestionnaire n'y donne
// accès, ce qui rend impossible toute élévation de privilèges par un gestionnaire.
router.use(protect, superadminOnly);

router.get("/permissions", listPermissions);
router.get("/", listTeam);
router.post("/", validate(inviteManagerSchema), inviteManager);
router.put("/:id/permissions", withId, validate(permissionsSchema), updatePermissions);
router.patch("/:id/status", withId, validate(accountStatusSchema), updateManagerStatus);
router.delete("/:id", withId, deleteManager);

export default router;
