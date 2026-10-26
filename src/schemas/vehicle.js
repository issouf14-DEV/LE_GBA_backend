import { z } from "zod";
import { VEHICLE_TYPES } from "../models/Vehicle.js";
import { name, objectId, optionalText } from "./common.js";

const CURRENT_YEAR = new Date().getFullYear();
export const vehicleSchema = z.strictObject({
  brand: name("La marque", 50),
  model: name("Le modèle", 80),
  price: z.coerce.number().positive("Prix invalide").max(100_000_000, "Prix invalide"),
  year: z.coerce
    .number()
    .int()
    .min(1950)
    .max(CURRENT_YEAR + 1),
  // Catégorie obligatoire
  type: z.enum(VEHICLE_TYPES, {
    message: "Choisissez la catégorie : thermique, électrique ou hybride",
  }),
  fuel: optionalText(30),
  transmission: optionalText(30),
  power: optionalText(30),
  engineSize: optionalText(30),
  color: optionalText(30),
  doors: z.coerce.number().int().min(2).max(5).default(5),
  seats: z.coerce.number().int().min(2).max(9).default(5),
  mileage: z.coerce.number().int().min(0).max(2_000_000).default(0),
  available: z.boolean().default(true),
  featured: z.boolean().default(false),
  tags: z
    .array(
      z
        .string()
        .trim()
        .max(30)
        .regex(/^[^<>]*$/)
    )
    .max(10)
    .default([]),
  description: optionalText(1000),
});

// Photo envoyée par l'équipe (déjà compressée par le navigateur) : contenu vérifié par le serveur
// (2 Mo maximum une fois décodée, soit environ 2,8 millions de caractères en base64)
export const photoSchema = z.strictObject({
  image: z.string().max(2_900_000, "Image trop lourde (2 Mo maximum)"),
});

export const photoOrderSchema = z.strictObject({
  order: z.array(objectId).max(8),
});

export const photoParams = z.object({ id: objectId, photoId: objectId });

export const vehicleQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(VEHICLE_TYPES).optional(),
  brand: z.string().trim().max(50).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(["priceAsc", "priceDesc", "yearAsc", "yearDesc", "recent"]).default("recent"),
});
