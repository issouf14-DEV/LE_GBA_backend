// Briques de validation côté serveur : le serveur ne fait jamais confiance au frontend
import { createHash } from "node:crypto";
import { z } from "zod";

// Messages d'erreur génériques en français (le site est entièrement en français)
z.config(z.locales.fr());

const NO_MARKUP = /^[^<>]*$/;

export const name = (label, max = 100) =>
  z
    .string()
    .trim()
    .min(1, `${label} est obligatoire`)
    .max(max, `${label} : ${max} caractères maximum`)
    .regex(NO_MARKUP, "Les caractères < et > ne sont pas autorisés");

export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .regex(NO_MARKUP, "Les caractères < et > ne sont pas autorisés")
    .default("");

export const freeText = (max) =>
  z.string().trim().max(max, `${max} caractères maximum`).default("");

export const email = z.string().trim().toLowerCase().max(254).email("Adresse email invalide");

export const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9\s.-]{8,20}$/, "Numéro de téléphone invalide")
  .refine((value) => value.replace(/\D/g, "").length >= 8, "Au moins 8 chiffres");

export const optionalPhone = z.union([z.literal(""), phone]).default("");

// Mots de passe publiés ou essayés en premier par les robots, dont l'ancien mot de passe admin.
// Seules leurs empreintes SHA-256 (en minuscules) sont écrites ici : aucun n'est lisible
const COMPROMISED = new Set([
  "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9",
  "ac9689e2272427085e35b9d3e3e8bed88cb3434828b43b86fc0596cad4c6e270",
  "0b14d501a594442a01c6859541bcb3e8164d183d32937b851835442f69d5c94e",
  "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f",
  "15cbf0d3fcb06da3bdf98d0370a38f00343d0747eecdf416d27556c0f3812fd6",
  "f3029a66c61b61b41b428963a2fc134154a5383096c776f3b4064733c5463d90",
  "6388d75d23fb06dea534746820444d9b06aba3095839c358322d38ecabff4486",
  "daaad6e5604e8e17bd9f108d91e26afe6281dac8fda0091040a7a6d7bd9b43b5",
  "14f8f4bb8c0e79a02670a5fea5682da717a5b3d3dc7b1706f7a4bab9afae18c2",
  "e9cee71ab932fde863338d08be4de9dfe39ea049bdafb342ce659ec5450b69ae",
  "2285877fbec4bb1ad6466a6d3596f3a369646db03a02d4f74a2616a50d457a0c",
  "3648d3e305230a48c038a1c436cfa8fea011652796203b9805817bba3e8700ef",
  "9b0eb22aef89516d6fb4b31ccf008a68abe0d10a3fc606316389613eccf96854",
  "a68349561396ec264a350847024a4521d00beaa3358660c2709a80f31c7acdd0",
]);
const fingerprint = (value) =>
  createHash("sha256").update(String(value).toLowerCase()).digest("hex");

export const isCompromisedPassword = (value) =>
  COMPROMISED.has(fingerprint(value)) || /^(.)\1+$/.test(String(value));

export const strongPassword = z
  .string()
  .min(8, "Au moins 8 caractères")
  .max(128, "128 caractères maximum")
  .regex(/[A-Za-z]/, "Au moins une lettre")
  .regex(/[0-9]/, "Au moins un chiffre")
  .refine(
    (value) => !isCompromisedPassword(value),
    "Ce mot de passe est trop connu, choisissez-en un autre"
  )
  // bcrypt ignore tout ce qui dépasse 72 octets : refusé plutôt que tronqué en silence
  .refine((value) => Buffer.byteLength(value) <= 72, "Mot de passe trop long (72 octets maximum)");

export const anyPassword = z.string().min(1, "Mot de passe obligatoire").max(128);

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Identifiant invalide");

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ)")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Date invalide");

export const idParam = z.object({ id: objectId });
