// Codes à usage unique : application d'authentification (6 chiffres), codes de secours, email
import { z } from "zod";
import { CODE_PATTERN } from "../services/resetCode.js";

const INVALID = "Code incorrect. Vérifiez-le et réessayez.";
// Saisie tolérante (espaces, tirets, minuscules), contrôle strict ensuite
const cleaned = z
  .string()
  .max(20)
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase());

// Code de l'application uniquement (activation, renouvellement des codes de secours)
export const totpCodeSchema = z.strictObject({
  code: cleaned.pipe(z.string().regex(/^\d{6}$/, INVALID)),
});

// Connexion : code de l'application OU code de secours (8 caractères)
export const secondFactorSchema = z.strictObject({
  code: cleaned.pipe(z.string().regex(/^(\d{6}|[A-Z0-9]{8})$/, INVALID)),
});

// Code de vérification de l'adresse email
export const emailCodeSchema = z.strictObject({
  code: cleaned.pipe(
    z.string().regex(CODE_PATTERN, "Code invalide ou expiré. Demandez-en un nouveau.")
  ),
});
