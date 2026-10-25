import express from "express";
import { getStats } from "../controllers/adminController.js";
import {
  deleteClient,
  inviteClient,
  listClients,
  updateClientStatus,
} from "../controllers/clientController.js";
import { authorize, protect } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { idParam } from "../schemas/common.js";
import { accountStatusSchema, clientListQuery, inviteClientSchema } from "../schemas/team.js";

const router = express.Router();
const withId = validate(idParam, "params");

// Chaque route exige une permission précise, relue en base à chaque requête
router.use(protect);

router.get("/stats", authorize("stats.read"), getStats);

router.get("/clients", authorize("clients.read"), validate(clientListQuery, "query"), listClients);
router.post("/clients", authorize("clients.manage"), validate(inviteClientSchema), inviteClient);
router.patch(
  "/clients/:id/status",
  authorize("clients.manage"),
  withId,
  validate(accountStatusSchema),
  updateClientStatus
);
router.delete("/clients/:id", authorize("clients.manage"), withId, deleteClient);

export default router;
