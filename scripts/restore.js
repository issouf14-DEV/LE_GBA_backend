// Restauration d'une sauvegarde :  npm run restore -- backups/<date>
// ATTENTION : chaque collection présente dans la sauvegarde est VIDÉE puis remplacée par son
// contenu. Une confirmation est demandée (taper RESTAURER) ; rien n'est fait sans elle.
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createInterface } from "node:readline/promises";
import dotenv from "dotenv";
import { BSON } from "mongodb";
import mongoose from "mongoose";

dotenv.config({ quiet: true });
const folder = process.argv[2];
if (!process.env.MONGO_URI || !folder) {
  console.error("Usage : npm run restore -- backups/<date>   (MONGO_URI requis dans .env)");
  process.exit(1);
}

const files = readdirSync(folder).filter((file) => file.endsWith(".json"));
if (files.length === 0) {
  console.error(`Aucune sauvegarde trouvée dans ${folder}`);
  process.exit(1);
}

console.log(
  `Collections qui seront REMPLACÉES : ${files.map((f) => basename(f, ".json")).join(", ")}`
);
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question("Tapez RESTAURER pour confirmer : ");
rl.close();
if (answer.trim() !== "RESTAURER") {
  console.log("Annulé : rien n'a été modifié.");
  process.exit(0);
}

await mongoose.connect(process.env.MONGO_URI);
try {
  const { db } = mongoose.connection;
  for (const file of files) {
    const name = basename(file, ".json");
    const documents = BSON.EJSON.parse(readFileSync(join(folder, file), "utf8"), {
      relaxed: false,
    });
    await db.collection(name).deleteMany({});
    if (documents.length > 0) await db.collection(name).insertMany(documents);
    console.log(`- ${name} : ${documents.length} document(s) restauré(s)`);
  }
  console.log("Restauration terminée.");
} catch (error) {
  console.error(`ÉCHEC : ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
