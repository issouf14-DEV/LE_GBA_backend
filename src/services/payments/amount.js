// Montant de l'acompte : TOUJOURS calculé ici, à partir du prix enregistré de la réservation
// (jamais d'un montant envoyé par le navigateur)
import { env } from "../../config/env.js";

// CinetPay exige un montant en XOF multiple de 5 ; en dessous de 100 FCFA, refusé par les opérateurs
export const MIN_DEPOSIT = 100;

export function depositAmount(totalPrice, percent = env.PAYMENT_DEPOSIT_PERCENT) {
  const total = Math.max(0, Math.round(Number(totalPrice) || 0));
  // Calcul en entiers (pas d'erreur d'arrondi des nombres à virgule), puis multiple de 5 supérieur
  const raw = Math.ceil((total * percent) / 100);
  return Math.ceil(raw / 5) * 5;
}
