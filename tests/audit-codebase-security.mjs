import fs from "fs";
import path from "path";

const DIRS_TO_SCAN = ["app", "lib", "utils", "components"];
const SENSITIVE_TABLES = ["users", "jadwal", "tugas", "ujian", "kelas_pengganti"];

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (/\.(ts|tsx|js|mjs)$/.test(file)) {
      results.push(fullPath);
    }
  }
  return results;
}

let violations = [];
let scannedCount = 0;

for (const dir of DIRS_TO_SCAN) {
  if (!fs.existsSync(dir)) continue;
  const files = getFiles(dir);
  scannedCount += files.length;
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const table of SENSITIVE_TABLES) {
      // Regex looking for .from("table") or .from('table')
      const regex = new RegExp(`\\.from\\(\\s*["'\`]${table}["'\`]\\s*\\)`, "g");
      if (regex.test(content)) {
        violations.push({ file, table });
      }
    }
  }
}

console.log(`Scanned ${scannedCount} files across ${DIRS_TO_SCAN.join(", ")}`);
if (violations.length === 0) {
  console.log("PASS: 0 PostgREST queries on sensitive tables found in the application code.");
} else {
  console.error("FAIL: Found PostgREST queries on sensitive tables:");
  violations.forEach(v => console.error(`  - ${v.file}: .from("${v.table}")`));
  process.exit(1);
}

