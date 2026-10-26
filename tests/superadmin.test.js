// Création du super-administrateur (commande npm run create-superadmin et démarrage)
import { describe, expect, it } from "vitest";
import { PERMISSION_KEYS } from "../src/config/permissions.js";
import User from "../src/models/User.js";
import { createSuperadmin, SuperadminError } from "../src/services/superadmin.js";
import { browser, createUser, useDatabase } from "./helpers/app.js";

useDatabase();

const VALID = { name: "Issouf Fofana", email: "Chef@Test.Local", password: "SuperSecret2026x" };

describe("création du super-administrateur", () => {
  it("crée le compte avec toutes les permissions et un mot de passe haché", async () => {
    const user = await createSuperadmin(VALID);
    expect(user.role).toBe("superadmin");
    expect(user.email).toBe("chef@test.local");
    expect(user.toPublic().permissions).toEqual(PERMISSION_KEYS);
    const saved = await User.findById(user._id).select("+password");
    expect(saved.password).not.toBe(VALID.password);
    expect(saved.password).toMatch(/^\$2[aby]\$12\$/);
  });

  it("le compte créé se connecte, puis doit activer sa double authentification", async () => {
    const user = await createSuperadmin(VALID);
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    const res = await browser().post("/api/auth/login", {
      email: VALID.email.toLowerCase(),
      password: VALID.password,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ mfa: "enroll" });
  });

  it("refuse un mot de passe de moins de 12 caractères, faible ou publié", async () => {
    for (const password of ["Court2026a", "sanschiffre-long", "Password123"]) {
      await expect(createSuperadmin({ ...VALID, password })).rejects.toThrow(SuperadminError);
    }
    expect(await User.countDocuments()).toBe(0);
  });

  it("refuse un email invalide ou un champ en trop (ex : rôle)", async () => {
    await expect(createSuperadmin({ ...VALID, email: "pas-un-email" })).rejects.toThrow(
      SuperadminError
    );
    await expect(createSuperadmin({ ...VALID, role: "client" })).rejects.toThrow(SuperadminError);
  });

  it("ne touche jamais à un compte existant avec le même email", async () => {
    const existing = await createUser({ email: "chef@test.local", role: "client" });
    await expect(createSuperadmin(VALID)).rejects.toThrow(/existe déjà/);
    expect((await User.findById(existing._id)).role).toBe("client");
  });
});
