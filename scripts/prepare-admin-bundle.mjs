import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
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
// Copy cả thư mục: shell tách thành index.html + admin.css + admin.js.
cpSync(shellDir, path.join(dist, "admin"), { recursive: true });

const favicon = path.join(shellDir, "favicon.svg");
if (existsSync(favicon)) {
  cpSync(favicon, path.join(dist, "favicon.svg"));
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

console.log("Đã dựng dist-admin/: admin/ (index.html, admin.css, admin.js, favicon), _redirects, _headers");
