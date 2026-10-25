// Gestion des clients par l'équipe (permissions clients.read / clients.manage)
import mongoose from "mongoose";
import { httpError } from "../middlewares/errorMiddleware.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { deleteAccount, findManageable, inviteAccount, setDisabled } from "../services/accounts.js";
import { escapeRegex } from "../utils/escape.js";

const CLIENT = "client";
// Anciens comptes clients (« user ») tant que la migration n'a pas été appliquée
const CLIENT_ROLES = { $in: ["client", "user"] };

export async function listClients(req, res) {
  const { page, limit, q } = req.validated.query;
  const filter = { role: CLIENT_ROLES };
  if (q) {
    // Recherche échappée : aucune expression régulière piégée (ReDoS) ne peut être injectée
    const pattern = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }
  // Filtre écrit uniquement par le serveur (texte recherché échappé) : la protection
  // anti-injection, qui bloquerait $in et $or, peut être levée ici
  const query = User.find(filter).setOptions({ sanitizeFilter: false });
  const [clients, total] = await Promise.all([
    query
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter).setOptions({ sanitizeFilter: false }),
  ]);
  res.json({ users: clients.map((client) => client.toPublic()), total, page, limit });
}

// Compte client créé par l'équipe : invitation par email (le client choisit son mot de passe)
export async function inviteClient(req, res) {
  const user = await inviteAccount({ role: CLIENT, data: req.body, invitedBy: req.user._id });
  res.status(201).json(user.toPublic());
}

export async function updateClientStatus(req, res) {
  const target = await findManageable(req.user, req.validated.params.id, CLIENT);
  res.json((await setDisabled(target, req.body.disabled)).toPublic());
}

// Un client avec une réservation en attente ou validée ne peut pas être supprimé :
// la réservation perdrait son propriétaire. Son historique terminé est conservé.
export async function deleteClient(req, res) {
  const target = await findManageable(req.user, req.validated.params.id, CLIENT);
  const active = await Order.exists({
    user: target._id,
    status: mongoose.trusted({ $in: ["en_attente", "validee"] }),
  });
  if (active) {
    throw httpError(
      409,
      "Ce client a des réservations en cours : traitez-les avant de supprimer le compte"
    );
  }
  await deleteAccount(target);
  res.status(204).end();
}
