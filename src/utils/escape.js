const HTML_ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// Toute valeur insérée dans un email HTML passe par ici (pas d'injection de balises ou de liens)
export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);

// Texte saisi utilisé dans une recherche : les caractères spéciaux deviennent littéraux
// (empêche les expressions régulières piégées qui bloquent le serveur, ReDoS)
export const escapeRegex = (value) =>
  String(value ?? "")
    .slice(0, 80)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
