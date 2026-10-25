// Validation des actions de l'équipe : gestionnaires (superadmin) et clients
import { z } from "zod";
import { PERMISSION_KEYS } from "../config/permissions.js";
import { email, name, optionalPhone } from "./common.js";

const permissions = z
  .array(z.enum(PERMISSION_KEYS, { message: "Permission inconnue" }))
  .max(PERMISSION_KEYS.length)
  .default([]);

// Le rôle n'est jamais fourni par le navigateur : il est fixé par la route appelée
const invitee = { name: name("Le nom", 100), email, phone: optionalPhone };

export const inviteManagerSchema = z.strictObject({ ...invitee, permissions });

export const inviteClientSchema = z.strictObject(invitee);

export const permissionsSchema = z.strictObject({ permissions });

export const accountStatusSchema = z.strictObject({ disabled: z.boolean() });

export const clientListQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(100).optional(),
});
