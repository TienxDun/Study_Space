import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

// Dựng thư mục publish cho project Cloudflare Pages `zenstudy-admin`.
// P0: chỉ có shell tĩnh + worker API (khi admin-worker/ đã có).
const root = process.cwd();
const dist = path.join(root, "dist-admin");
const shell = path.join(root, "admin-host", "index.html");

if (!existsSync(shell)) {
  console.error("Thiếu admin-host/index.html — không có gì để publish.");
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(path.join(dist, "admin"), { recursive: true });
cpSync(shell, path.join(dist, "admin", "index.html"));

writeFileSync(
  path.join(dist, "_redirects"),
  ["/ /admin/ 302", "/admin /admin/ 301", ""].join("\n"),
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

const written = ["admin/index.html", "_redirects", "_headers"];

const worker = path.join(root, "admin-worker", "_worker.js");
const routes = path.join(root, "admin-worker", "_routes.json");

if (existsSync(worker)) {
  cpSync(worker, path.join(dist, "_worker.js"));
  written.push("_worker.js");

  if (existsSync(routes)) {
    cpSync(routes, path.join(dist, "_routes.json"));
    written.push("_routes.json");
  } else {
    writeFileSync(
      path.join(dist, "_routes.json"),
      JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2) + "\n",
      "utf-8"
    );
    written.push("_routes.json (mặc định)");
    console.warn("admin-worker/_routes.json không có — đã dùng cấu hình mặc định /api/*.");
  }
} else {
  console.warn("Chưa có admin-worker/_worker.js — host admin chỉ có trang tĩnh (B4 sẽ thêm API).");
}

console.log(`Đã dựng dist-admin/: ${written.join(", ")}`);
