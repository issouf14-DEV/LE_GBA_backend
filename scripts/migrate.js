// Migration des données de l'ancienne version vers la nouvelle.
//   npm run migrate            -> simulation : affiche ce qui changerait, ne modifie rien
//   npm run migrate -- --apply -> applique les changements (faites d'abord « npm run backup »)
// Options de suppression (définitives, à ajouter explicitement) :
//   --remove-old-admins           supprime les anciens comptes administrateurs
//   --remove-imageless-vehicles   supprime les anciens véhicules sans aucune image
import dotenv from "dotenv";
import mongoose from "mongoose";
import { migrateEmailVerified } from "./migrations/emailVerified.js";
import { migrateOrders } from "./migrations/orders.js";
import { migrateRoles } from "./migrations/roles.js";
import { migrateVehicles } from "./migrations/vehicles.js";

dotenv.config();
const apply = process.argv.includes("--apply");
// Suppressions définitives : seulement si elles sont demandées explicitement
const options = {
  removeOldAdmins: process.argv.includes("--remove-old-admins"),
  removeImageless: process.argv.includes("--remove-imageless-vehicles"),
};
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI manquant (fichier .env)");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const { db } = mongoose.connection;
console.log(apply ? "Migration : APPLICATION" : "Migration : SIMULATION (ajoutez --apply)");

for (const step of [migrateRoles, migrateOrders, migrateVehicles, migrateEmailVerified]) {
  console.log(`- ${await step(db, apply, options)}`);
}

await mongoose.disconnect();
console.log(apply ? "Terminé." : "Rien n'a été modifié.");
