// Journal d'audit (permission audit.read) : consultation seule, aucune route d'écriture
import { listAuditEntries } from "../services/auditEntries.js";

export async function listAudit(req, res) {
  res.json(await listAuditEntries(req.validated.query));
}
