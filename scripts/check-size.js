// Règles du projet : 150 lignes maximum par fichier, aucun émoji dans le code
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_LINES = 150;
const EMOJI = /\p{Extended_Pictographic}/u;

const listFiles = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : path.endsWith(".js") ? [path] : [];
  });

const problems = [];
for (const file of ["src", "scripts", "tests"].flatMap(listFiles)) {
  const content = readFileSync(file, "utf8");
  const lines = content.split("\n").length;
  if (lines > MAX_LINES) problems.push(`${file} : ${lines} lignes (maximum ${MAX_LINES})`);
  if (EMOJI.test(content)) problems.push(`${file} : contient un émoji`);
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("check-size : OK");
