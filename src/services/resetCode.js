// Code de réinitialisation du mot de passe : aucun secret dans un lien. L'email contient un code
// à taper sur le site, avec son adresse. Le code est court, à usage unique, limité en essais.
import { randomInt, timingSafeEqual } from "node:crypto";
import { hashToken } from "./tokens.js";

// Sans caractères ambigus (pas de O/0, I/1/L) : 31 symboles, 8 caractères -> 31^8 ≈ 8,5 x 10^11
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;
export const MAX_RESET_ATTEMPTS = 5;
export const CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export function generateResetCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

// Empreinte HMAC liée à l'adresse : le code d'un compte ne vaut rien pour un autre compte
export const hashResetCode = (email, code) => hashToken(`${email.toLowerCase()}:${code}`);

// Comparaison en temps constant : la durée ne révèle pas combien de caractères sont justes
export function safeHashEquals(storedHash, candidateHash) {
  if (typeof storedHash !== "string") return false;
  const expected = Buffer.from(storedHash);
  const received = Buffer.from(candidateHash);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export const matchesResetCode = (email, code, storedHash) =>
  safeHashEquals(storedHash, hashResetCode(email, code));
