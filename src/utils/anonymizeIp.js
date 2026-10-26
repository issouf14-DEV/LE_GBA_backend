// Adresse IP tronquée pour le journal d'audit : assez précise pour repérer un réseau, pas assez
// pour identifier une personne. IPv4 sans le dernier octet, IPv6 réduite à son préfixe /48.
import { isIPv4, isIPv6 } from "node:net";

const MAPPED_V4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

function truncateV4(ip) {
  return `${ip.split(".").slice(0, 3).join(".")}.0`;
}

// Développe la notation courte (« :: ») pour lire les trois premiers groupes de 16 bits
function truncateV6(ip) {
  // Partie IPv4 finale éventuelle (2 groupes) : sans effet sur les 48 premiers bits
  const address = ip.replace(/\d+\.\d+\.\d+\.\d+$/, "0:0");
  const [head, tail = ""] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = address.includes("::") ? 8 - left.length - right.length : 0;
  const groups = [...left, ...Array(missing).fill("0"), ...right];
  const prefix = groups.slice(0, 3).map((group) => Number.parseInt(group || "0", 16).toString(16));
  return `${prefix.join(":")}::/48`;
}

export function anonymizeIp(value) {
  if (typeof value !== "string") return undefined;
  // Identifiant de zone (« fe80::1%eth0 ») retiré
  const ip = value.trim().split("%")[0];
  const mapped = ip.match(MAPPED_V4);
  if (mapped && isIPv4(mapped[1])) return truncateV4(mapped[1]);
  if (isIPv4(ip)) return truncateV4(ip);
  if (isIPv6(ip)) return truncateV6(ip);
  return undefined;
}
