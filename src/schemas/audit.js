// Filtres de la page « Journal d'audit » : liste fermée, toute autre valeur est refusée
import { z } from "zod";
import { AUDIT_ACTIONS, AUDIT_TARGET_TYPES } from "../models/AuditLog.js";
import { isoDate, objectId } from "./common.js";

export const auditListQuery = z
  .strictObject({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    action: z.enum(AUDIT_ACTIONS, { message: "Action inconnue" }).optional(),
    actor: objectId.optional(),
    targetType: z.enum(AUDIT_TARGET_TYPES, { message: "Type de cible inconnu" }).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: "La date de début doit précéder la date de fin",
    path: ["from"],
  });
