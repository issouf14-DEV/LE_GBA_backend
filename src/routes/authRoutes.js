import express from "express";
import {
  getProfile,
  login,
  logout,
  refresh,
  register,
  updateProfile,
} from "../controllers/authController.js";
import {
  changePassword,
  forgotPassword,
  resetPassword,
} from "../controllers/passwordController.js";
import { protect } from "../middlewares/auth.js";
import {
  emailLimiter,
  forgotEmailLimiter,
  loginIpLimiter,
  loginLimiter,
  passwordLimiter,
  registerLimiter,
} from "../middlewares/rateLimits.js";
import { validate } from "../middlewares/validate.js";
import {
  forgotSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
  registerSchema,
  resetSchema,
} from "../schemas/index.js";

const router = express.Router();

router.post("/register", registerLimiter, validate(registerSchema), register);
// Limites appliquées après validation : l'email est alors normalisé (minuscules)
router.post("/login", validate(loginSchema), loginIpLimiter, loginLimiter, login);
router.post("/logout", logout);
router.post("/refresh", refresh);

router.get("/profile", protect, getProfile);
router.put("/profile", protect, validate(profileSchema), updateProfile);
router.put("/password", protect, passwordLimiter, validate(passwordSchema), changePassword);

router.post(
  "/forgot-password",
  emailLimiter,
  validate(forgotSchema),
  forgotEmailLimiter,
  forgotPassword
);
router.post("/reset-password", passwordLimiter, validate(resetSchema), resetPassword);

export default router;
