// Fournisseurs d'envoi d'emails, appelés directement par leur API HTTPS (aucun SDK à installer).
// Chaque fonction lève une EmailError claire en cas de refus : statut HTTP + message du fournisseur.

export class EmailError extends Error {
  constructor(provider, status, detail) {
    super(`${provider} a refusé l'envoi (HTTP ${status}) : ${detail}`);
    this.provider = provider;
    this.status = status;
    this.detail = detail;
  }
}

const TIMEOUT_MS = 10_000;

async function post(provider, url, headers, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.ok) return;
  const text = await response.text().catch(() => "");
  // Message du fournisseur raccourci : utile au diagnostic, sans inonder les journaux
  throw new EmailError(provider, response.status, text.slice(0, 300) || response.statusText);
}

// Brevo (offre gratuite : 300 emails par jour) — https://developers.brevo.com
function brevo({ apiKey, from, to, subject, html }) {
  return post(
    "Brevo",
    "https://api.brevo.com/v3/smtp/email",
    { "api-key": apiKey },
    { sender: from, to: [{ email: to }], subject, htmlContent: html }
  );
}

// SendGrid (offre payante depuis mai 2025) — https://www.twilio.com/docs/sendgrid
function sendgrid({ apiKey, from, to, subject, html }) {
  return post(
    "SendGrid",
    "https://api.sendgrid.com/v3/mail/send",
    { Authorization: `Bearer ${apiKey}` },
    {
      personalizations: [{ to: [{ email: to }] }],
      from,
      subject,
      content: [{ type: "text/html", value: html }],
    }
  );
}

export const PROVIDERS = { brevo, sendgrid };

// Configuration d'envoi : fournisseur choisi + sa clé + adresse d'expédition vérifiée chez lui
export function emailConfig(source) {
  const provider = source.EMAIL_PROVIDER || "brevo";
  const apiKey = provider === "sendgrid" ? source.SENDGRID_API_KEY : source.BREVO_API_KEY;
  const fromEmail = source.EMAIL_FROM || source.EMAIL_USER;
  return {
    provider,
    apiKey,
    from: { email: fromEmail, name: source.EMAIL_FROM_NAME || "LE-GBA" },
    enabled: Boolean(PROVIDERS[provider] && apiKey && fromEmail),
  };
}
