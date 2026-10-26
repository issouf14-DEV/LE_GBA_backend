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
  enableMfa,
  regenerateBackupCodes,
  setupMfa,
  verifyMfa,
} from "../controllers/mfaController.js";
import {
  acceptInvitation,
  changePassword,
  forgotPassword,
  resetPassword,
} from "../controllers/passwordController.js";
import { resendEmailCode, verifyEmail } from "../controllers/verificationController.js";
import { protect } from "../middlewares/auth.js";
import { requireMfaTicket } from "../middlewares/mfaTicket.js";
import {
  emailCodeLimiter,
  emailCodeResendLimiter,
  emailLimiter,
  forgotEmailLimiter,
  loginIpLimiter,
  loginLimiter,
  mfaLimiter,
  passwordLimiter,
  registerLimiter,
  resetCodeLimiter,
} from "../middlewares/rateLimits.js";
import { validate } from "../middlewares/validate.js";
import {
  acceptInviteSchema,
  forgotSchema,
  loginSchema,
  passwordSchema,
  profileSchema,
  registerSchema,
  resetSchema,
} from "../schemas/index.js";
import { emailCodeSchema, secondFactorSchema, totpCodeSchema } from "../schemas/mfa.js";

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
router.post(
  "/reset-password",
  passwordLimiter,
  validate(resetSchema),
  resetCodeLimiter,
  resetPassword
);
router.post("/accept-invitation", passwordLimiter, validate(acceptInviteSchema), acceptInvitation);

// Double authentification de l'équipe : 2e étape de connexion, avec le ticket (cookie) reçu
// après le bon mot de passe ; puis, une fois connecté, renouvellement des codes de secours
const enroll = [mfaLimiter, requireMfaTicket("enroll")];
router.post("/mfa/setup", ...enroll, setupMfa);
router.post("/mfa/enable", ...enroll, validate(totpCodeSchema), enableMfa);
router.post(
  "/mfa/verify",
  mfaLimiter,
  requireMfaTicket("verify"),
  validate(secondFactorSchema),
  verifyMfa
);
router.post("/backup-codes", protect, mfaLimiter, validate(totpCodeSchema), regenerateBackupCodes);

// Vérification de l'adresse email (clients)
router.post("/verify-email", protect, emailCodeLimiter, validate(emailCodeSchema), verifyEmail);
router.post("/verify-email/resend", protect, emailCodeResendLimiter, resendEmailCode);

export default router;
