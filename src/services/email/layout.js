import { publicSiteUrl } from "../../config/env.js";
import { escapeHtml } from "../../utils/escape.js";

const priceFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export const price = (value) => `${priceFormatter.format(Number(value) || 0)} FCFA`;

export const date = (value) =>
  value
    ? new Date(value).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

// Ligne « libellé : valeur » ; la valeur est TOUJOURS échappée
export const row = (label, value) =>
  `<p style="margin:6px 0"><strong>${escapeHtml(label)} :</strong> ${escapeHtml(value)}</p>`;

export const button = (label, path) =>
  `<p style="text-align:center;margin:28px 0"><a href="${escapeHtml(publicSiteUrl + path)}"
     style="background:#dc2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;

// Gabarit commun : `title` est échappé, `body` doit être construit avec row()/button()/escapeHtml()
export function layout(title, body) {
  return `<!doctype html><html lang="fr"><body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:28px">
    <h1 style="color:#dc2626;margin:0 0 4px">LE-GBA</h1>
    <p style="color:#6b7280;margin:0 0 24px">Location de véhicules premium</p>
    <h2 style="color:#111827">${escapeHtml(title)}</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">
    <p style="color:#9ca3af;font-size:12px">Email envoyé automatiquement, merci de ne pas y répondre.</p>
  </div></body></html>`;
}

export { escapeHtml };
