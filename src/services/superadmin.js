// Création du super-administrateur : réservée à l'exploitant du serveur (accès à la base),
// jamais possible depuis l'API. Utilisé par le démarrage (variables ADMIN_*) et par la
// commande `npm run create-superadmin`.
import mongoose from "mongoose";
import { z } from "zod";
import User from "../models/User.js";
import { email, name, strongPassword } from "../schemas/common.js";

// Compte le plus sensible de l'application : 12 caractères minimum (au lieu de 8)
const superadminSchema = z.strictObject({
  name: name("Le nom", 100),
  email,
  password: strongPassword.refine((value) => value.length >= 12, "Au moins 12 caractères"),
});

export class SuperadminError extends Error {}

export async function createSuperadmin(input) {
  const parsed = superadminSchema.safeParse(input);
  if (!parsed.success) throw new SuperadminError(parsed.error.issues[0].message);

  const { name: fullName, email: address, password } = parsed.data;
  if (await User.exists({ email: address })) {
    throw new SuperadminError(
      "Un compte existe déjà avec cet email : aucun compte n'a été modifié"
    );
  }
  const [firstName = "", ...rest] = fullName.split(" ");
  return User.create({
    name: fullName,
    firstName,
    lastName: rest.join(" "),
    email: address,
    password,
    role: "superadmin",
    // Compte créé par l'exploitant du serveur : adresse considérée comme vérifiée
    emailVerifiedAt: new Date(),
  });
}

export const countSuperadmins = () =>
  User.countDocuments({ role: mongoose.trusted({ $in: ["superadmin", "admin"] }) });
