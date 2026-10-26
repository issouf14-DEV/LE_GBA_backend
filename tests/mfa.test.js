// Double authentification de l'équipe : activation, connexion, anti-rejeu, verrouillage
import { describe, expect, it } from "vitest";
import { loadMfaUser } from "../src/services/mfa.js";
import { seal, unseal } from "../src/services/secretBox.js";
import { issueSession } from "../src/services/tokens.js";
import { currentStep, totpAt } from "../src/services/totp.js";
import {
  browser,
  cookieNames,
  cookieValue,
  createUser,
  PASSWORD,
  raw,
  totpNow,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const passwordStep = (client, user) =>
  client.post("/api/auth/login", { email: user.email, password: PASSWORD });

describe("première connexion de l'équipe : activation obligatoire", () => {
  it("le mot de passe seul n'ouvre aucune session, seulement l'étape d'activation", async () => {
    const user = await createUser({ role: "gestionnaire", mfa: false });
    const client = browser();
    const res = await passwordStep(client, user);
    expect(res.body).toEqual({ mfa: "enroll" });
    expect(cookieNames(res)).toEqual(["gba_mfa"]);
    expect(res.headers["set-cookie"][0]).toMatch(/Path=\/api\/auth\/mfa;.*HttpOnly/);
    expect((await client.get("/api/auth/profile")).status).toBe(401);
    expect((await client.post("/api/auth/mfa/verify", { code: "123456" })).status).toBe(401);
  });

  it("QR code, puis le premier code active la 2FA et donne 10 codes de secours", async () => {
    const user = await createUser({ role: "gestionnaire", mfa: false });
    const client = browser();
    await passwordStep(client, user);
    const setup = await client.post("/api/auth/mfa/setup");
    expect(setup.body.otpauthUrl).toMatch(/^otpauth:\/\/totp\/LE-GBA:/);
    const pending = await loadMfaUser(user._id);
    const secret = unseal(pending.mfaPendingSecret, `mfa:${user._id}`);

    expect((await client.post("/api/auth/mfa/enable", { code: "000000" })).status).toBe(400);
    const res = await client.post("/api/auth/mfa/enable", { code: totpAt(secret, currentStep()) });
    expect(res.status).toBe(200);
    expect(res.body.backupCodes).toHaveLength(10);
    expect(res.body.mfaEnabled).toBe(true);
    expect((await client.get("/api/auth/profile")).status).toBe(200);
    // En base : secret chiffré, codes de secours hachés
    const saved = await loadMfaUser(user._id).select("+mfaBackupHashes");
    expect(saved.mfaSecret).not.toContain(setup.body.secret);
    expect(saved.mfaBackupHashes).not.toContain(res.body.backupCodes[0]);
  });
});

describe("connexion avec la 2FA active", () => {
  it("code de l'application exigé ; le même code ne sert qu'une fois", async () => {
    const user = await createUser({ role: "gestionnaire" });
    const client = browser();
    expect((await passwordStep(client, user)).body).toEqual({ mfa: "verify" });
    const code = totpNow();
    expect((await client.post("/api/auth/mfa/verify", { code })).status).toBe(200);
    expect((await client.get("/api/auth/profile")).status).toBe(200);

    const thief = browser();
    await passwordStep(thief, user);
    expect((await thief.post("/api/auth/mfa/verify", { code })).status).toBe(400);
  });

  it("un code de secours fonctionne une seule fois", async () => {
    const user = await createUser({ role: "gestionnaire", mfa: false });
    const client = browser();
    await passwordStep(client, user);
    await client.post("/api/auth/mfa/setup");
    const pending = await loadMfaUser(user._id);
    const secret = unseal(pending.mfaPendingSecret, `mfa:${user._id}`);
    const enabled = await client.post("/api/auth/mfa/enable", {
      code: totpAt(secret, currentStep()),
    });
    const [backup] = enabled.body.backupCodes;

    const first = browser();
    await passwordStep(first, user);
    expect((await first.post("/api/auth/mfa/verify", { code: backup })).status).toBe(200);
    const second = browser();
    await passwordStep(second, user);
    expect((await second.post("/api/auth/mfa/verify", { code: backup })).status).toBe(400);
  });

  it("5 codes faux verrouillent le compte, même avec le bon code ensuite", async () => {
    const user = await createUser({ role: "gestionnaire" });
    const client = browser();
    await passwordStep(client, user);
    for (let i = 0; i < 5; i++) await client.post("/api/auth/mfa/verify", { code: "000000" });
    expect((await client.post("/api/auth/mfa/verify", { code: totpNow() })).status).toBe(429);
  });

  it("le ticket n'est jamais accepté comme session", async () => {
    const user = await createUser({ role: "superadmin" });
    const res = await passwordStep(browser(), user);
    const ticket = cookieValue(res, "gba_mfa");
    const profile = await raw().get("/api/auth/profile").set("Cookie", `gba_at=${ticket}`);
    expect(profile.status).toBe(401);
  });

  it("une session de l'équipe ouverte sans 2FA (avant son activation) est refusée", async () => {
    const user = await createUser({ role: "gestionnaire", mfa: false });
    const { accessToken } = await issueSession(user);
    const profile = await raw().get("/api/auth/profile").set("Cookie", `gba_at=${accessToken}`);
    expect(profile.status).toBe(401);
  });

  it("un secret chiffré recopié sur un autre compte est inutilisable", () => {
    const sealed = seal(Buffer.from("secret-totp-test-20o"), "mfa:compte-a");
    expect(unseal(sealed, "mfa:compte-a")).not.toBeNull();
    expect(unseal(sealed, "mfa:compte-b")).toBeNull();
    expect(unseal(`${sealed.slice(0, -2)}AA`, "mfa:compte-a")).toBeNull();
  });
});
