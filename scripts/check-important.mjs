// B2 guard: cam !important moi.
// Quy tac: !important chi duoc nam giua
//   IMPORTANT-ALLOWED-START ... IMPORTANT-ALLOWED-END
// trong src/app/globals.css va src/app/styles/*.css,
// va cam tuyet doi trong *.ts/*.tsx/*.css khac.
// Chay: npm run lint:css
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const STYLES_DIR = join(ROOT, "src/app/styles");
const ALLOWED_CSS = new Set(
  [join(ROOT, "src/app/globals.css")].concat(
    readdirSync(STYLES_DIR)
      .filter((name) => name.endsWith(".css"))
      .map((name) => join(STYLES_DIR, name))
  )
);

let failed = false;
const violations = [];
let allowed = 0;

// 1. File kieu dang duoc phep: !important ngoai vung cho phep
const checkAllowedFile = (file) => {
  const lines = readFileSync(file, "utf8").split("\n");
  let depth = 0;
  lines.forEach((line, i) => {
    const isMarker = line.includes("IMPORTANT-ALLOWED");
    if (line.includes("IMPORTANT-ALLOWED-START")) depth += 1;
    if (line.includes("IMPORTANT-ALLOWED-END"))
      depth = Math.max(0, depth - 1);
    if (isMarker) return; // bo qua chu "!important" trong dong marker
    if (line.includes("!important")) {
      if (depth > 0) {
        allowed += 1;
      } else {
        failed = true;
        violations.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`);
      }
    }
  });
  if (depth !== 0) {
    failed = true;
    violations.push(`${relative(ROOT, file)}: Marker IMPORTANT-ALLOWED START/END lech nhau.`);
  }
};

for (const file of ALLOWED_CSS) checkAllowedFile(file);

// 2. Moi file src khac: cam !important
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
    } else if (/\.(ts|tsx|css)$/.test(name) && !ALLOWED_CSS.has(p)) {
      readFileSync(p, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (line.includes("!important")) {
            failed = true;
            violations.push(`${relative(ROOT, p)}:${i + 1}: ${line.trim()}`);
          }
        });
    }
  }
};
walk(join(ROOT, "src"));

console.log(`!important trong vung cho phep: ${allowed}`);
if (failed) {
  console.error("VI PHAM !important:");
  for (const v of violations) console.error(" - " + v);
  process.exit(1);
}
console.log("lint:css OK");
