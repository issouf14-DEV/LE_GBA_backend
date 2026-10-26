// Outils communs aux tests : base MongoDB en mémoire, clients HTTP avec cookies, comptes de test
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach } from "vitest";
import app from "../../src/app.js";
import { normalizeRole } from "../../src/config/permissions.js";
import User from "../../src/models/User.js";
import Vehicle from "../../src/models/Vehicle.js";
import { seal } from "../../src/services/secretBox.js";
import { currentStep, totpAt } from "../../src/services/totp.js";

export const XHR = { "X-Requested-With": "XMLHttpRequest" };
export const PASSWORD = "MotDePasse2026";

let server;

// À appeler en tête de chaque fichier de test
export function useDatabase() {
  beforeAll(async () => {
    // Premier démarrage lent sous Windows (antivirus) : délai généreux
    // Replica set d'un seul nœud : permet les transactions (outbox des événements), comme Atlas
    server = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      instanceOpts: [{ launchTimeout: 120_000 }],
    });
    await mongoose.connect(server.getUri());
  });
  beforeEach(async () => {
    for (const collection of Object.values(mongoose.connection.collections)) {
      await collection.deleteMany({});
    }
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await server?.stop();
  });
}

// Navigateur simulé : garde les cookies entre les requêtes et envoie l'en-tête anti-CSRF
export function browser() {
  const agent = request.agent(app);
  const send = (method) => (path, body) => agent[method](path).set(XHR).send(body);
  return {
    agent,
    get: (path) => agent.get(path),
    post: send("post"),
    put: send("put"),
    patch: send("patch"),
    delete: send("delete"),
  };
}

export const raw = () => request(app);

// Secret 2FA commun aux comptes de l'équipe des tests (20 octets) et code actuel correspondant
export const TOTP_SECRET = Buffer.from("secret-totp-test-20o");
export const totpNow = (offsetSteps = 0) => totpAt(TOTP_SECRET, currentStep() + offsetSteps);

export async function enableTestMfa(userId) {
  await User.updateOne(
    { _id: userId },
    { mfaSecret: seal(TOTP_SECRET, `mfa:${userId}`), mfaEnabledAt: new Date(), mfaLastStep: -1 }
  );
}

// Par défaut : adresse vérifiée, et 2FA active pour l'équipe (mfa: false pour la désactiver)
export async function createUser({ mfa = true, ...overrides } = {}) {
  const user = await User.create({
    name: "Awa Koné",
    email: `client${Math.random().toString(36).slice(2, 8)}@test.local`,
    password: PASSWORD,
    emailVerifiedAt: new Date(),
    ...overrides,
  });
  if (!mfa || normalizeRole(user.role) === "client") return user;
  await enableTestMfa(user._id);
  return User.findById(user._id);
}

// Connexion complète : mot de passe, puis code 2FA pour l'équipe
export async function login(client, user, password = PASSWORD) {
  const res = await client.post("/api/auth/login", { email: user.email, password });
  if (res.body?.mfa !== "verify") return res;
  // Anti-rejeu : deux connexions de test dans les mêmes 30 secondes réutiliseraient le même code
  await User.updateOne({ _id: user._id }, { mfaLastStep: -1 });
  return client.post("/api/auth/mfa/verify", { code: totpNow() });
}

// Compte créé puis connecté : renvoie le navigateur et l'utilisateur
export async function loggedIn(overrides = {}) {
  const user = await createUser(overrides);
  const client = browser();
  const res = await login(client, user);
  if (res.status !== 200) throw new Error(`Connexion de test impossible : ${res.status}`);
  return {
    client,
    user,
    accessToken: cookieValue(res, "gba_at"),
    refreshToken: cookieValue(res, "gba_rt"),
  };
}

// Super-administrateur (tous les droits) ; loggedInAdmin reste un alias pour les anciens tests
export const loggedInSuperadmin = () => loggedIn({ role: "superadmin", email: "admin@test.local" });
export const loggedInAdmin = loggedInSuperadmin;

// Gestionnaire avec les permissions accordées par le superadmin
export const loggedInManager = (permissions = []) =>
  loggedIn({ role: "gestionnaire", permissions });

export const createVehicle = (overrides = {}) =>
  Vehicle.create({
    brand: "Toyota",
    model: "Corolla",
    year: 2024,
    type: "thermal",
    price: 25_000,
    ...overrides,
  });

// Date AAAA-MM-JJ dans `days` jours
export const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);

// Valeur d'un cookie posé par la réponse
export const cookieValue = (res, name) =>
  (res.headers["set-cookie"] || [])
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split(";")[0]
    .slice(name.length + 1);

export const cookieNames = (res) =>
  (res.headers["set-cookie"] || []).map((cookie) => cookie.split("=")[0]);
