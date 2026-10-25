// Migration des données de l'ancienne version vers la nouvelle.
//   npm run migrate            -> simulation : affiche ce qui changerait, ne modifie rien
//   npm run migrate -- --apply -> applique les changements (faites d'abord une sauvegarde Atlas)
import dotenv from "dotenv";
import mongoose from "mongoose";
import { migrateOrders } from "./migrations/orders.js";
import { migrateRoles } from "./migrations/roles.js";
import { migrateVehicles } from "./migrations/vehicles.js";

dotenv.config();
const apply = process.argv.includes("--apply");
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI manquant (fichier .env)");
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
const { db } = mongoose.connection;
console.log(apply ? "Migration : APPLICATION" : "Migration : SIMULATION (ajoutez --apply)");

for (const step of [migrateRoles, migrateOrders, migrateVehicles]) {
  console.log(`- ${await step(db, apply)}`);
}

await mongoose.disconnect();
console.log(apply ? "Terminé." : "Rien n'a été modifié.");
