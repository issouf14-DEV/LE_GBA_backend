import express from "express";
import { register, login, getProfile, sendManualWelcomeEmail } from "../controllers/authController.js";
import { protect, adminOnly } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/profile", protect, getProfile);

// Email de bienvenue manuel (pour tests ou renvoi)
router.post("/send-welcome-email", protect, adminOnly, sendManualWelcomeEmail);

export default router;
