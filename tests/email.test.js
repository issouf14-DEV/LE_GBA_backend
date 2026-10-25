// Envoi des emails : requêtes envoyées aux fournisseurs (fetch simulé, aucun envoi réel)
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailError, emailConfig, PROVIDERS } from "../src/services/email/providers.js";

const MESSAGE = { to: "client@test.local", subject: "Sujet", html: "<p>Bonjour</p>" };
const FROM = { email: "contact@le-gba.test", name: "LE-GBA" };

function mockFetch(status = 201, body = "") {
  const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("configuration", () => {
  it("Brevo par défaut, désactivé sans clé ou sans expéditeur", () => {
    expect(emailConfig({}).provider).toBe("brevo");
    expect(emailConfig({ BREVO_API_KEY: "k" }).enabled).toBe(false);
    expect(emailConfig({ BREVO_API_KEY: "k", EMAIL_FROM: "a@b.co" }).enabled).toBe(true);
  });

  it("accepte l'ancien nom EMAIL_USER et choisit la clé du bon fournisseur", () => {
    const config = emailConfig({
      EMAIL_PROVIDER: "sendgrid",
      SENDGRID_API_KEY: "sg",
      BREVO_API_KEY: "br",
      EMAIL_USER: "a@b.co",
    });
    expect(config.apiKey).toBe("sg");
    expect(config.from.email).toBe("a@b.co");
  });
});

describe("Brevo", () => {
  it("appelle l'API transactionnelle avec la clé dans l'en-tête api-key", async () => {
    const fetchMock = mockFetch(201, '{"messageId":"x"}');
    await PROVIDERS.brevo({ apiKey: "cle-brevo", from: FROM, ...MESSAGE });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(options.headers["api-key"]).toBe("cle-brevo");
    expect(JSON.parse(options.body)).toEqual({
      sender: FROM,
      to: [{ email: MESSAGE.to }],
      subject: MESSAGE.subject,
      htmlContent: MESSAGE.html,
    });
  });

  it("transforme un refus en erreur claire (statut + message du fournisseur)", async () => {
    mockFetch(401, '{"code":"unauthorized","message":"Key not found"}');
    const error = await PROVIDERS.brevo({ apiKey: "x", from: FROM, ...MESSAGE }).catch((e) => e);
    expect(error).toBeInstanceOf(EmailError);
    expect(error.status).toBe(401);
    expect(error.message).toContain("Key not found");
  });
});

describe("SendGrid", () => {
  it("appelle l'API v3 avec un jeton Bearer", async () => {
    const fetchMock = mockFetch(202);
    await PROVIDERS.sendgrid({ apiKey: "cle-sg", from: FROM, ...MESSAGE });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(options.headers.Authorization).toBe("Bearer cle-sg");
    expect(JSON.parse(options.body).personalizations[0].to[0].email).toBe(MESSAGE.to);
  });

  it("signale un compte gratuit expiré (403)", async () => {
    mockFetch(403, "You are not authorized to send from this account");
    const error = await PROVIDERS.sendgrid({ apiKey: "x", from: FROM, ...MESSAGE }).catch((e) => e);
    expect(error.status).toBe(403);
  });
});
