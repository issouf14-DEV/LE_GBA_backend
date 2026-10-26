// Codes de l'application d'authentification (TOTP, RFC 6238) : le téléphone et le serveur
// partagent un secret et calculent le même code à 6 chiffres toutes les 30 secondes.
// Écrit avec node:crypto uniquement : aucune dépendance de plus à surveiller.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
// Un pas de tolérance avant et après : l'horloge du téléphone peut avoir quelques secondes d'écart
const DRIFT_STEPS = 1;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const TOTP_PATTERN = /^\d{6}$/;

// 160 bits aléatoires, la taille recommandée par la RFC 4226
export const generateTotpSecret = () => randomBytes(20);

// Format attendu par les applications (Google Authenticator, Microsoft Authenticator…)
export function toBase32(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = ((value << 8) | byte) & 0xffff;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return bits > 0 ? out + BASE32[(value << (5 - bits)) & 31] : out;
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP_SECONDS);

export function totpAt(secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", secret).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const number = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(number % 10 ** DIGITS).padStart(DIGITS, "0");
}

// Renvoie le pas de temps reconnu, ou null. Un pas déjà utilisé (lastStep) est refusé :
// un code vu par-dessus l'épaule ou intercepté ne peut pas être rejoué
export function verifyTotp(secret, code, lastStep = -1, now = Date.now()) {
  if (typeof code !== "string" || !TOTP_PATTERN.test(code)) return null;
  const step = currentStep(now);
  for (let candidate = step - DRIFT_STEPS; candidate <= step + DRIFT_STEPS; candidate++) {
    const expected = Buffer.from(totpAt(secret, candidate));
    if (candidate > lastStep && timingSafeEqual(expected, Buffer.from(code))) return candidate;
  }
  return null;
}

// Lien lu par l'application quand on scanne le QR code
export function otpauthUrl({ issuer, account, secret }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    secret: toBase32(secret),
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params}`;
}
