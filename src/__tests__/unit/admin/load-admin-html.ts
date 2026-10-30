import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(__dirname, "../../../../admin-host");
const INCLUDE_RE = /<!--\s*include:\s*([^\s]+)\s*-->/g;

function expand(file: string): string {
  return readFileSync(file, "utf8").replace(INCLUDE_RE, (_match, rel) =>
    expand(resolve(dirname(file), rel)),
  );
}

/** Đọc index.html và mở rộng các include giống bước build admin. */
export function loadAdminHtml(): string {
  return expand(resolve(root, "index.html"));
}
