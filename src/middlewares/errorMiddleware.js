import { isProduction } from "../config/env.js";

export const notFound = (_req, res) => {
  res.status(404).json({ message: "Ressource introuvable" });
};

// Erreur métier avec un code HTTP explicite (ex : throw httpError(404, "Commande introuvable"))
// Son message est écrit par nous : il peut être montré au client, même pour un code 5xx (503)
export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  error.isHttpError = true;
  return error;
}

const KNOWN_ERRORS = [
  [(err) => err.type === "entity.parse.failed", 400, "Corps de requête invalide"],
  [(err) => err.type === "entity.too.large", 413, "Requête trop volumineuse"],
  [(err) => err.type === "encoding.unsupported", 415, "Corps compressé non accepté"],
  [(err) => err.type === "charset.unsupported", 415, "Encodage non accepté"],
  [(err) => err.name === "CastError", 400, "Identifiant invalide"],
  [(err) => err.name === "ValidationError", 400, "Données invalides"],
  [(err) => err.code === 11000, 409, "Cette valeur est déjà utilisée"],
];

// Les détails techniques restent dans les logs du serveur : le client ne reçoit qu'un message sûr
export const errorHandler = (err, req, res, _next) => {
  const known = KNOWN_ERRORS.find(([match]) => match(err));
  if (known) return res.status(known[1]).json({ message: known[2] });

  // Erreur créée par httpError : code et message maîtrisés. Autre erreur avec un code < 500
  // (bibliothèque) : code conservé. Tout le reste : 500 générique, détails dans les journaux.
  const exposed = Number.isInteger(err.status) && (err.isHttpError || err.status < 500);
  const status = exposed ? err.status : 500;
  if (status >= 500) console.error(`[${req.method} ${req.path}]`, err.message);

  return res.status(status).json({
    message: exposed ? err.message : "Erreur interne du serveur",
    ...(isProduction || exposed ? {} : { stack: err.stack }),
  });
};
