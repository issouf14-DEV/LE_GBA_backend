// Entrées des routes de paiement : aucun montant n'est jamais accepté du navigateur
import { z } from "zod";
import { PAYMENT_STATUSES } from "../models/Payment.js";

export const paymentListQuery = z.strictObject({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(PAYMENT_STATUSES).optional(),
});

// Page de retour CinetPay : seul l'identifiant de la réservation est repris
export const returnQuery = z.object({
  order: z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .optional()
    .catch(undefined),
});

// Notification CinetPay : identifiant de transaction au format créé par le serveur
export const transactionIdSchema = z.string().regex(/^GBA[A-F0-9]{24}$/);
