// Crée le compte super-administrateur :  npm run create-superadmin
// Le nom, l'email et le mot de passe sont demandés dans le terminal (mot de passe masqué) :
// ils ne passent ni par un fichier, ni par l'historique du terminal, ni par une variable.
import { createInterface } from "node:readline";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { countSuperadmins, createSuperadmin, SuperadminError } from "../src/services/superadmin.js";

dotenv.config();

function ask(question, { hidden = false } = {}) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    // Remplace chaque caractère tapé par rien : le mot de passe ne s'affiche pas
    rl._writeToOutput = (text) => {
      if (text.includes(question)) process.stdout.write(question);
    };
  }
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      // Un mot de passe est gardé tel quel (espaces compris) ; nom et email sont nettoyés
      resolve(hidden ? answer : answer.trim());
    });
  });
}

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI manquant : ajoutez-le dans le fichier .env du backend.");
  process.exit(1);
}
if (!process.stdin.isTTY) {
  console.error(
    "Terminal non interactif : lancez la commande dans PowerShell ou l'invite de commandes\n" +
      "(dans Git Bash : « winpty npm.cmd run create-superadmin »)."
  );
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
try {
  const existing = await countSuperadmins();
  if (existing > 0) console.log(`Attention : ${existing} super-administrateur(s) existe(nt) déjà.`);

  const name = await ask("Nom complet : ");
  const email = await ask("Email : ");
  const password = await ask("Mot de passe (12 caractères min., lettres et chiffres) : ", {
    hidden: true,
  });
  const confirm = await ask("Confirmez le mot de passe : ", { hidden: true });
  if (password !== confirm) throw new SuperadminError("Les mots de passe ne correspondent pas");

  const user = await createSuperadmin({ name, email, password });
  console.log(`Super-administrateur créé : ${user.email}`);
  console.log("Connectez-vous sur le site, puis gardez ce mot de passe dans un gestionnaire.");
} catch (error) {
  console.error(`ÉCHEC : ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
