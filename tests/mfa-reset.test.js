// Double authentification : nouveaux codes de secours, réinitialisation par le superadmin
import { describe, expect, it } from "vitest";
import User from "../src/models/User.js";
import {
  browser,
  createUser,
  loggedInSuperadmin,
  login,
  PASSWORD,
  totpNow,
  useDatabase,
} from "./helpers/app.js";

useDatabase();

const passwordStep = (client, user) =>
  client.post("/api/auth/login", { email: user.email, password: PASSWORD });

describe("codes de secours et réinitialisation", () => {
  it("nouveaux codes de secours seulement avec un code de l'application", async () => {
    const user = await createUser({ role: "gestionnaire" });
    const client = browser();
    await login(client, user);
    expect((await client.post("/api/auth/backup-codes", { code: "000000" })).status).toBe(400);
    await User.updateOne({ _id: user._id }, { mfaLastStep: -1 });
    const res = await client.post("/api/auth/backup-codes", { code: totpNow() });
    expect(res.body.backupCodes).toHaveLength(10);
  });

  it("le superadmin réinitialise la 2FA d'un gestionnaire : sessions fermées, réactivation", async () => {
    const { client: admin } = await loggedInSuperadmin();
    const manager = await createUser({ role: "gestionnaire" });
    const session = browser();
    await login(session, manager);

    const res = await admin.post(`/api/team/${manager._id}/mfa/reset`);
    expect(res.status).toBe(204);
    expect((await session.get("/api/auth/profile")).status).toBe(401);
    expect((await passwordStep(browser(), manager)).body).toEqual({ mfa: "enroll" });
  });

  it("un gestionnaire ne peut pas réinitialiser la 2FA d'un autre", async () => {
    const manager = await createUser({ role: "gestionnaire", permissions: ["clients.manage"] });
    const client = browser();
    await login(client, manager);
    const other = await createUser({ role: "gestionnaire" });
    expect((await client.post(`/api/team/${other._id}/mfa/reset`)).status).toBe(403);
  });
});
