import { existsSync, renameSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

// Xuất out/ cho app Android. Máy local có src/app/api (gitignored) làm Next từ chối
// static export, nên tạm cất đi trong lúc build rồi trả lại.
const root = process.cwd();
const apiDir = path.join(root, "src", "app", "api");
const stashDir = path.join(root, ".api-stash");
const hadApi = existsSync(apiDir);

if (existsSync(stashDir)) {
  console.error("Còn thư mục .api-stash từ lần build lỗi trước. Kiểm tra rồi xóa tay.");
  process.exit(1);
}

function safeMove(from, to) {
  try {
    renameSync(from, to);
  } catch (err) {
    if (process.platform === "win32") {
      execSync(`powershell -NoProfile -Command "Move-Item -LiteralPath '${from}' -Destination '${to}' -Force"`);
    } else {
      throw err;
    }
  }
}

if (hadApi) safeMove(apiDir, stashDir);

// Kiểu sinh từ `next dev` vẫn trỏ tới src/app/api vừa cất đi -> typecheck fail.
rmSync(path.join(root, ".next", "dev"), { recursive: true, force: true });

try {
  execSync("npx next build", {
    stdio: "inherit",
    shell: true,
    // NEXT_PUBLIC_MOBILE_SHELL: xuất HTML tĩnh theo giao diện mobile để điện thoại
    // không phải đổi layout sau khi JS chạy xong (gây nháy màn hình lúc khởi động).
    env: { ...process.env, CF_PAGES: "1", NEXT_PUBLIC_MOBILE_SHELL: "1" },
  });
} finally {
  if (hadApi && existsSync(stashDir)) safeMove(stashDir, apiDir);
}

execSync("node scripts/strip-admin-export.mjs", { stdio: "inherit", shell: true });

// Media lấy từ CDN R2 (NEXT_PUBLIC_STUDY_CDN_URL), không nhét 400 MB vào file cài.
rmSync(path.join(root, "out", "study"), { recursive: true, force: true });
