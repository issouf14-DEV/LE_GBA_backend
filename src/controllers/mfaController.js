// Double authentification de l'équipe : activation, connexion, codes de secours, réinitialisation

import { recordEvent } from "../events/outbox.js";
import { EVENTS } from "../events/topology.js";
import { httpError } from "../middlewares/errorMiddleware.js";
import { findManageable } from "../services/accounts.js";
import { audit } from "../services/audit.js";
import { isBackupCode } from "../services/backupCodes.js";
import {
  clearMfaFailures,
  completeEnrollment,
  loadMfaUser,
  registerMfaFailure,
  renewBackupCodes,
  resetMfa,
  startEnrollment,
  verifyAppCode,
  verifySecondFactor,
} from "../services/mfa.js";
import { clearMfaTicket } from "../services/mfaTicket.js";
import { revokeAllSessions } from "../services/tokens.js";
import { startSession } from "./authController.js";

const WRONG_CODE = "Code incorrect. Vérifiez-le et réessayez.";

// `step` : étape où le code faux a été saisi (activation, connexion, codes de secours)
async function rejectCode(req, step) {
  await registerMfaFailure(req.user._id);
  await audit(req, "mfa.failed", { targetType: "user", targetId: req.user._id, meta: { step } });
  throw httpError(400, WRONG_CODE);
}

const auditLogin = (req, factor) =>
  audit(req, "auth.login_succeeded", {
    targetType: "user",
    targetId: req.user._id,
    meta: { factor },
  });

// Premier passage : QR code à scanner (le secret n'est montré qu'à cette étape)
export async function setupMfa(req, res) {
  res.json(await startEnrollment(req.user));
}

// Le premier code confirme l'activation. Les sessions ouvertes avant (sans 2FA) sont fermées.
export async function enableMfa(req, res) {
  const backupCodes = await completeEnrollment(req.user, req.body.code);
  if (!backupCodes) return rejectCode(req, "enroll");
  await revokeAllSessions(req.user._id);
  clearMfaTicket(res);
  await recordEvent(EVENTS.mfaEnabled, { userId: req.user._id });
  await audit(req, "mfa.enabled", { targetType: "user", targetId: req.user._id });
  await auditLogin(req, "enrollment");
  const user = await loadMfaUser(req.user._id);
  await startSession(res, user, 200, { backupCodes });
}

export async function verifyMfa(req, res) {
  if (!(await verifySecondFactor(req.user, req.body.code))) return rejectCode(req, "verify");
  await clearMfaFailures(req.user._id);
  clearMfaTicket(res);
  await auditLogin(req, isBackupCode(req.body.code) ? "backup_code" : "app");
  await startSession(res, req.user);
}

// Nouveaux codes de secours, sur présentation d'un code de l'application (session déjà ouverte)
export async function regenerateBackupCodes(req, res) {
  const user = await loadMfaUser(req.user._id);
  if (!(await verifyAppCode(user, req.body.code))) return rejectCode(req, "backup_codes");
  res.json({ backupCodes: await renewBackupCodes(user._id) });
}

// Superadmin : téléphone perdu par un gestionnaire
export async function resetManagerMfa(req, res) {
  const target = await findManageable(req.user, req.validated.params.id, "gestionnaire");
  await resetMfa(target._id);
  await recordEvent(EVENTS.mfaReset, { userId: target._id });
  await audit(req, "mfa.reset", { targetType: "user", targetId: target._id });
  res.status(204).end();
}
