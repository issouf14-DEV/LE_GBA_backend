// Chiffrement des secrets 2FA en base (AES-256-GCM) : une copie volée de la base ne suffit pas
// à générer les codes de l'équipe, il faut aussi la clé TOTP_ENC_KEY, qui ne quitte pas le serveur
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { httpError } from "../middlewares/errorMiddleware.js";

const VERSION = "v1";

function key() {
  if (!env.TOTP_ENC_KEY) {
    throw httpError(503, "Double authentification indisponible : serveur mal configuré");
  }
  return Buffer.from(env.TOTP_ENC_KEY, "base64");
}

// `context` (l'identifiant du compte) est authentifié avec le chiffré : un secret recopié
// sur le compte de quelqu'un d'autre est refusé au déchiffrement
export function seal(plain, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), data]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

// Renvoie null si le chiffré est absent, altéré ou lié à un autre compte
export function unseal(sealed, context) {
  const [version, iv, tag, data] = String(sealed ?? "").split(".");
  if (version !== VERSION || !iv || !tag || !data) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
  } catch (error) {
    if (error.isHttpError) throw error;
    return null;
  }
}
