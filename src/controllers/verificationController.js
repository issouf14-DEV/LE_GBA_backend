// Vérification de l'adresse email d'un client connecté (code reçu par email)
import { httpError } from "../middlewares/errorMiddleware.js";
import User from "../models/User.js";
import { confirmEmailCode, sendVerificationCode } from "../services/emailVerification.js";

export async function verifyEmail(req, res) {
  if (req.user.emailVerifiedAt) return res.json(req.user.toPublic());
  if (!(await confirmEmailCode(req.user, req.body.code))) {
    throw httpError(400, "Code invalide ou expiré. Demandez-en un nouveau.");
  }
  res.json((await User.findById(req.user._id)).toPublic());
}

// Nouveau code : le précédent ne vaut plus rien, compteur d'essais remis à zéro
export async function resendEmailCode(req, res) {
  if (req.user.emailVerifiedAt) throw httpError(409, "Votre adresse email est déjà confirmée.");
  await sendVerificationCode(req.user);
  res.status(204).end();
}
