import express from "express";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { protect } from "../middlewares/auth.js";
import { limiter } from "../middlewares/rateLimits.js";
import { validate } from "../middlewares/validate.js";
import { idParam } from "../schemas/common.js";
import { notificationListQuery } from "../schemas/notification.js";
import { openNotificationStream } from "../services/notifications/sse.js";

const router = express.Router();

// Ouvertures du flux temps réel : 60 par quart d'heure et par compte (reconnexions comprises)
const streamLimiter = limiter("notification-stream", {
  minutes: 15,
  limit: 60,
  message: "Trop de reconnexions. Réessayez dans quelques minutes.",
  key: (req) => String(req.user._id),
});

// Tout utilisateur connecté (client ou équipe) ; chacun n'accède qu'à ses propres notifications
router.use(protect);

router.get("/", validate(notificationListQuery, "query"), listNotifications);
router.get("/stream", streamLimiter, openNotificationStream);
router.post("/read-all", markAllNotificationsRead);
router.patch("/:id/read", validate(idParam, "params"), markNotificationRead);

export default router;
