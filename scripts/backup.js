// Sauvegarde de toute la base :  npm run backup
// Chaque collection est écrite dans backups/<date>/<collection>.json (format EJSON : les
// identifiants, dates et photos sont conservés exactement). Ces fichiers contiennent des données
// personnelles et des mots de passe hachés : ils restent sur votre PC (dossier ignoré par Git).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
import { BSON } from "mongodb";
import mongoose from "mongoose";

dotenv.config({ quiet: true });
if (!process.env.MONGO_URI) {
  console.error("MONGO_URI manquant : ajoutez-le dans le fichier .env du backend.");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const folder = join("backups", stamp);
mkdirSync(folder, { recursive: true });

// Base vide : le nom de base de MONGO_URI ne correspond sans doute pas à celle des données
async function explainEmpty(db) {
  console.log("Cette base est vide. Le nom de base dans MONGO_URI est probablement incorrect.");
  try {
    const { databases } = await db.admin().listDatabases();
    const names = databases.map((base) => base.name).filter((n) => !["admin", "local"].includes(n));
    console.log(`Bases disponibles : ${names.join(", ") || "(aucune visible)"}`);
    console.log(
      "Mettez le bon nom dans MONGO_URI : ...mongodb.net/NOM_DE_LA_BASE?retryWrites=true"
    );
  } catch {
    console.log("Vérifiez le nom de la base dans Atlas > Browse collections (colonne de gauche).");
  }
}

await mongoose.connect(process.env.MONGO_URI);
try {
  const { db } = mongoose.connection;
  console.log(`Base sauvegardée : « ${db.databaseName} »`);
  const collections = await db.listCollections({}, { nameOnly: true }).toArray();
  if (collections.length === 0) await explainEmpty(db);
  let total = 0;
  for (const { name } of collections) {
    if (name.startsWith("system.")) continue;
    const documents = await db.collection(name).find({}).toArray();
    writeFileSync(
      join(folder, `${name}.json`),
      BSON.EJSON.stringify(documents, { relaxed: false })
    );
    console.log(`- ${name} : ${documents.length} document(s)`);
    total += documents.length;
  }
  console.log(`Sauvegarde terminée : ${total} document(s) dans ${folder}`);
} catch (error) {
  console.error(`ÉCHEC : ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
