// Super-administrateur qui a perdu son téléphone ET ses codes de secours :
//   npm run reset-mfa -- adresse@email.com
// Réservé à l'exploitant du serveur (accès à la base) : la 2FA du compte est effacée, toutes
// ses sessions sont fermées, et elle sera reconfigurée à la prochaine connexion.
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import User from "../src/models/User.js";
import { resetMfa } from "../src/services/mfa.js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage : npm run reset-mfa -- adresse@email.com");
  process.exit(1);
}

await mongoose.connect(env.MONGO_URI);
try {
  const user = await User.findOne({ email });
  if (!user) {
    console.error("Aucun compte avec cet email.");
    process.exitCode = 1;
  } else {
    await resetMfa(user._id);
    console.log(`2FA réinitialisée pour ${email} : reconfiguration à la prochaine connexion.`);
  }
} finally {
  await mongoose.disconnect();
}
