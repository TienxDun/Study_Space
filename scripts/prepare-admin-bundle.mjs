import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

// Dựng thư mục asset cho Worker `zenstudy-admin` (wrangler.admin.jsonc).
// Script chỉ tạo file tĩnh; wrangler lo phần deploy.
const root = process.cwd();
const dist = path.join(root, "dist-admin");
const shellDir = path.join(root, "admin-host");
const shell = path.join(shellDir, "index.html");

if (!existsSync(shell)) {
  console.error("Thiếu admin-host/index.html — không có gì để publish.");
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, "admin"), { recursive: true });

// Copy shell và mở rộng các `<!-- include: ... -->` trong file HTML.
// Partial nằm ở admin-host/panels/ chỉ dùng lúc build, không publish.
const INCLUDE_RE = /<!--\s*include:\s*([^\s]+)\s*-->/g;

function expandIncludes(text, baseDir, seen = new Set()) {
  return text.replace(INCLUDE_RE, (_match, rel) => {
    const target = path.resolve(baseDir, rel);
    if (!target.startsWith(`${shellDir}${path.sep}`)) {
      throw new Error(`include nằm ngoài admin-host: ${rel}`);
    }
    if (seen.has(target)) throw new Error(`include vòng lặp: ${rel}`);
    const body = readFileSync(target, "utf8");
    return expandIncludes(body, path.dirname(target), new Set([...seen, target]));
  });
}

function copyShellDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.name === "panels" || entry.name === "assets") continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyShellDir(from, to);
    } else if (entry.name.endsWith(".html")) {
      writeFileSync(
        to,
        expandIncludes(readFileSync(from, "utf8"), src, new Set([from])),
        "utf8"
      );
    } else {
      cpSync(from, to);
    }
  }
}

copyShellDir(shellDir, path.join(dist, "admin"));

const favicon = path.join(shellDir, "assets", "favicon.svg");
if (existsSync(favicon)) {
  cpSync(favicon, path.join(dist, "favicon.svg"));
  // Giữ đường dẫn cũ /admin/favicon.svg cho _redirects và bookmark.
  cpSync(favicon, path.join(dist, "admin", "favicon.svg"));
}

// P2c: bộ nội dung đóng gói sẵn để nút "Nạp bộ nội dung ban đầu" gửi lên Worker.
const seedDir = path.join(dist, "admin", "seed");
mkdirSync(seedDir, { recursive: true });
for (const name of ["scenes.json", "sounds.json", "tracks.json"]) {
  const source = path.join(root, "src", "data", "assets", name);
  if (!existsSync(source)) {
    console.error(`Thiếu src/data/assets/${name} — không dựng được bộ nội dung ban đầu.`);
    process.exit(1);
  }
  cpSync(source, path.join(seedDir, name));
}

writeFileSync(
  path.join(dist, "_redirects"),
  [
    "/ /admin/ 302",
    "/admin /admin/ 301",
    "/favicon.ico /favicon.svg 302",
    "/admin/favicon.ico /admin/favicon.svg 302",
    "",
  ].join("\n"),
  "utf-8"
);

writeFileSync(
  path.join(dist, "_headers"),
  [
    "/*",
    "  X-Robots-Tag: noindex, nofollow",
    "  X-Content-Type-Options: nosniff",
    "  X-Frame-Options: DENY",
    "  Referrer-Policy: no-referrer",
    "  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()",
    "",
  ].join("\n"),
  "utf-8"
);

console.log("Đã dựng dist-admin/: admin/ (index.html đã mở rộng include, CSS/JS, favicon), _redirects, _headers");
