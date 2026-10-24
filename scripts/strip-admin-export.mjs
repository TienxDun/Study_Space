import { existsSync, rmSync } from "node:fs";
import path from "node:path";

// Bản web public không được chứa trang admin hay API nội bộ.
// Chạy sau `next build` (CF_PAGES=1 khi build ở máy local).
const root = process.cwd();
const outDir = path.join(root, "out");

if (!existsSync(outDir)) {
  console.error("Không thấy thư mục out/. Chạy next build trước rồi mới xóa.");
  process.exit(1);
}

const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/^\/+|\/+$/g, "");
const roots = [outDir, ...(basePath ? [path.join(outDir, basePath)] : [])];
const removed = [];

for (const dir of roots) {
  for (const name of ["admin", "api", "dev"]) {
    const full = path.join(dir, name);
    if (!existsSync(full)) continue;
    rmSync(full, { recursive: true, force: true });
    removed.push(path.relative(root, full).replace(/\\/g, "/"));
  }
}

if (removed.length > 0) {
  console.log(`Đã xóa khỏi bản web: ${removed.join(", ")}`);
} else {
  console.log("Bản web không có thư mục admin/dev — không cần xóa.");
}
