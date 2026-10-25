import { z } from "zod";
import { OWN_IMAGE } from "../services/vehicles.js";
import { name, optionalText } from "./common.js";

const CURRENT_YEAR = new Date().getFullYear();
const MAX_IMAGE_LENGTH = 2_900_000; // ~2 Mo une fois encodé en base64

const image = z
  .string()
  .trim()
  .max(MAX_IMAGE_LENGTH, "Image trop lourde (2 Mo maximum)")
  .refine(
    (value) =>
      !value ||
      OWN_IMAGE.test(value) ||
      /^(https:\/\/[^\s"'<>]+|data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/.test(value),
    "Image invalide (URL https ou fichier JPEG/PNG/WebP)"
  )
  .default("");

export const vehicleSchema = z.strictObject({
  brand: name("La marque", 50),
  model: name("Le modèle", 80),
  price: z.coerce.number().positive("Prix invalide").max(100_000_000, "Prix invalide"),
  year: z.coerce
    .number()
    .int()
    .min(1950)
    .max(CURRENT_YEAR + 1),
  type: z.enum(["thermal", "electric", "hybrid"]),
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
  image,
});

export const vehicleQuery = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  type: z.enum(["thermal", "electric", "hybrid"]).optional(),
  brand: z.string().trim().max(50).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(["priceAsc", "priceDesc", "yearAsc", "yearDesc", "recent"]).default("recent"),
});
