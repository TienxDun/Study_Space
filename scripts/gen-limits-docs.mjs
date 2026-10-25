import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// Sinh docs/guides/SYSTEM_LIMITS.md từ src/data/admin/hit-limits.ts.
// Không thêm dependency: dùng typescript.transpileModule rồi chạy phần exports.

const root = process.cwd();
const sourcePath = path.join(root, "src/data/admin/hit-limits.ts");
const outPath = path.join(root, "docs/guides/SYSTEM_LIMITS.md");

const source = fs.readFileSync(sourcePath, "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;

const mod = { exports: {} };
new Function("exports", "module", js)(mod.exports, mod);

const items = mod.exports.SYSTEM_HIT_LIMITS;
if (!Array.isArray(items) || items.length === 0) {
  console.error("Không đọc được SYSTEM_HIT_LIMITS từ src/data/admin/hit-limits.ts");
  process.exit(1);
}

const CATEGORY_LABELS = {
  ai: "AI & Chat",
  backend: "Backend",
  storage: "Lưu trữ",
  realtime: "Realtime",
  client: "Client",
  embed: "Nhúng ngoài",
};

const SEVERITY_LABELS = {
  critical: "Nghiêm trọng",
  warning: "Cảnh báo",
  info: "Tham khảo",
};

function cell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function list(value) {
  return Array.isArray(value) && value.length > 0 ? value.join("; ") : "—";
}

function renderItem(item) {
  const lines = [];
  lines.push(`### ${item.service} — ${item.component}`);
  lines.push("");
  lines.push(`- **Mức độ:** ${SEVERITY_LABELS[item.severity] || item.severity}`);
  lines.push(`- **Gói hiện tại:** ${item.currentTier}`);
  lines.push(`- **Hạn mức:** ${item.quotaDescription}`);
  lines.push(`- **Ngưỡng:** ${item.rateLimits.map((r) => `${r.label} — ${r.value}`).join("; ")}`);
  lines.push(`- **Dấu hiệu chạm trần:** ${list(item.hitLimitSymptoms)}`);
  if (item.errorCode) lines.push(`- **Mã lỗi:** \`${item.errorCode}\``);
  lines.push(`- **Cơ chế dự phòng:** ${item.fallbackMechanism}`);
  lines.push(`- **Cách xử lý:** ${item.remedyAction}`);
  lines.push(`- **Chu kỳ reset:** ${item.resetCycle}`);
  if (item.docUrl) lines.push(`- **Tài liệu:** ${item.docUrl}`);
  if (Array.isArray(item.troubleshootingSteps) && item.troubleshootingSteps.length > 0) {
    lines.push("- **Các bước kiểm tra:**");
    item.troubleshootingSteps.forEach((step, index) => {
      lines.push(`  ${index + 1}. ${step}`);
    });
  }
  lines.push("");
  return lines;
}

const categories = [...new Set(items.map((item) => item.category))];
const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
  now.getDate(),
).padStart(2, "0")}`;

const out = [];
out.push("# Hạn mức hệ thống ZenStudy");
out.push("");
out.push(
  "> Sinh tự động từ `src/data/admin/hit-limits.ts` — đừng sửa tay. Chạy `npm run gen:limits` sau khi đổi hạn mức.",
);
out.push(`> Cập nhật: ${today} · ${items.length} mục.`);
out.push("");
out.push("## Tổng quan");
out.push("");
out.push("| Dịch vụ | Thành phần | Gói | Ngưỡng chính | Mức độ |");
out.push("|---|---|---|---|---|");
for (const item of items) {
  out.push(
    `| ${cell(item.service)} | ${cell(item.component)} | ${cell(item.currentTier)} | ${cell(
      item.rateLimits.map((r) => `${r.label}: ${r.value}`).join("; "),
    )} | ${SEVERITY_LABELS[item.severity] || item.severity} |`,
  );
}
out.push("");

for (const category of categories) {
  out.push(`## ${CATEGORY_LABELS[category] || category}`);
  out.push("");
  for (const item of items.filter((entry) => entry.category === category)) {
    out.push(...renderItem(item));
  }
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out.join("\n").trimEnd() + "\n", "utf8");
console.log(`Đã sinh ${path.relative(root, outPath)} (${items.length} mục).`);
