import { z } from "zod";
import { CODE_PATTERN } from "../services/resetCode.js";
import {
  anyPassword,
  email,
  freeText,
  isoDate,
  name,
  objectId,
  optionalPhone,
  optionalText,
  phone,
  strongPassword,
} from "./common.js";

// z.strictObject : tout champ non prévu (role, isAdmin, totalPrice…) fait échouer la requête
export const registerSchema = z.strictObject({
  name: name("Le nom", 100),
  firstName: name("Le prénom", 50),
  lastName: name("Le nom", 50),
  email,
  phone: optionalPhone,
  address: optionalText(200),
  password: strongPassword,
});

export const loginSchema = z.strictObject({ email, password: anyPassword });

export const profileSchema = z.strictObject({
  name: name("Le nom", 100),
  firstName: name("Le prénom", 50),
  lastName: name("Le nom", 50),
  phone: optionalPhone,
  address: optionalText(200),
});

export const passwordSchema = z.strictObject({
  currentPassword: anyPassword,
  newPassword: strongPassword,
});

export const forgotSchema = z.strictObject({ email });

// Code reçu par email : majuscules, sans espaces ni tirets (saisie tolérante, contrôle strict)
const resetCode = z
  .string()
  .max(20)
  .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
  .pipe(z.string().regex(CODE_PATTERN, "Code invalide ou expiré. Refaites une demande."));

export const resetSchema = z.strictObject({ email, code: resetCode, password: strongPassword });

export const acceptInviteSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,100}$/, "Lien d'invitation invalide ou expiré"),
  password: strongPassword,
});

export const orderSchema = z.strictObject({
  vehicleId: objectId,
  startDate: isoDate,
  endDate: isoDate,
  contact: z.strictObject({
    fullName: name("Le nom", 100),
    email,
    phone,
    address: name("L'adresse", 300),
  }),
  notes: freeText(500),
});

export const statusSchema = z.strictObject({
  status: z.enum(["validee", "rejetee", "terminee", "annulee"]),
});

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
