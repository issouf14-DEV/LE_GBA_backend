// Codes de secours de la double authentification : 10 codes à usage unique, montrés une seule
// fois, pour se connecter si le téléphone est perdu. Seules leurs empreintes sont gardées.
import { randomInt } from "node:crypto";
import User from "../models/User.js";
import { hashToken } from "./tokens.js";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const BACKUP_CODE_COUNT = 10;
const BACKUP_PATTERN = new RegExp(`^[${ALPHABET}]{8}$`);

// « abcd-2345 », « ABCD 2345 » et « ABCD2345 » désignent le même code
const normalize = (code) =>
  String(code ?? "")
    .toUpperCase()
    .replace(/[\s-]/g, "");
export const isBackupCode = (code) => BACKUP_PATTERN.test(normalize(code));

// Empreinte liée au compte : un code de secours ne vaut que pour son propriétaire
const hashBackupCode = (userId, code) => hashToken(`backup:${userId}:${normalize(code)}`);

// Renvoie les codes en clair (à afficher une fois) et leurs empreintes (à enregistrer)
export function generateBackupCodes(userId) {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, () => {
    let code = "";
    for (let i = 0; i < 8; i++) code += ALPHABET[randomInt(ALPHABET.length)];
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
  return { codes, hashes: codes.map((code) => hashBackupCode(userId, code)) };
}

// Consommation atomique : deux requêtes simultanées avec le même code, une seule réussit
export async function consumeBackupCode(userId, code) {
  if (!isBackupCode(code)) return false;
  const hash = hashBackupCode(userId, code);
  const result = await User.updateOne(
    { _id: userId, mfaBackupHashes: hash },
    { $pull: { mfaBackupHashes: hash } }
  );
  return result.modifiedCount === 1;
}
