// Vérification de l'adresse email des clients : un code envoyé par email, à taper sur le site.
// Sans adresse vérifiée, pas de réservation (on ne loue pas à une adresse inventée).
import mongoose from "mongoose";
import User from "../models/User.js";
import { sendEmailCodeEmail } from "./email/verification.js";
import { generateResetCode, safeHashEquals } from "./resetCode.js";
import { hashToken } from "./tokens.js";

export const EMAIL_CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;

// Préfixe « verify » : un code de vérification ne vaut jamais comme code de réinitialisation
export const hashEmailCode = (email, code) => hashToken(`verify:${email.toLowerCase()}:${code}`);

export async function sendVerificationCode(user) {
  const code = generateResetCode();
  await User.updateOne(
    { _id: user._id },
    {
      emailCodeHash: hashEmailCode(user.email, code),
      emailCodeExpires: new Date(Date.now() + EMAIL_CODE_TTL_MINUTES * 60_000),
      emailCodeAttempts: 0,
    }
  );
  sendEmailCodeEmail(user, code, EMAIL_CODE_TTL_MINUTES);
}

// Essai compté AVANT la vérification, de façon atomique : 5 essais au plus, même en parallèle
export async function confirmEmailCode(user, code) {
  const record = await User.findOneAndUpdate(
    {
      _id: user._id,
      emailCodeExpires: mongoose.trusted({ $gt: new Date() }),
      emailCodeAttempts: mongoose.trusted({ $lt: MAX_ATTEMPTS }),
    },
    { $inc: { emailCodeAttempts: 1 } },
    { new: true }
  ).select("+emailCodeHash");
  if (!record || !safeHashEquals(record.emailCodeHash, hashEmailCode(user.email, code))) {
    return false;
  }
  await markEmailVerified(user._id);
  return true;
}

// Aussi appelé quand l'adresse est prouvée autrement (invitation acceptée, code de réinitialisation)
export const markEmailVerified = (userId) =>
  User.updateOne(
    { _id: userId },
    {
      emailVerifiedAt: new Date(),
      $unset: { emailCodeHash: "", emailCodeExpires: "", emailCodeAttempts: "" },
    }
  );
