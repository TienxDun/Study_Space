// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminHtml } from "./load-admin-html";

const html = loadAdminHtml();
const bodyHtml = html
  .slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/gi, "");
const script = readFileSync(
  resolve(__dirname, "../../../../admin-host/scripts/dashboard.js"),
  "utf8",
);

type Call = { url: string; init?: RequestInit };

const AUDIT: Array<Record<string, any>> = [
  {
    id: 2,
    actorEmail: "admin@example.com",
    action: "feedback.delete",
    target: "feedback-0001",
    detail: '{"kind":"bug"}',
    createdAt: 1700000000000,
  },
  {
    id: 1,
    actorEmail: "admin@example.com",
    action: "flags.update",
    target: "cfg:flags",
    detail: "{}",
    createdAt: 1699999999000,
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function fakeApi() {
  const calls: Call[] = [];
  const state = { audit: AUDIT.slice() };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const method = init?.method || "GET";
      if (url === "/api/admin/overview") return json({ error: "d1_error" }, 500);
      if (url.startsWith("/api/admin/audit?")) {
        return json({ ok: true, items: state.audit, nextBefore: null });
      }
      if (url === "/api/admin/audit" && method === "DELETE") {
        const deleted = state.audit.length;
        state.audit = [];
        return json({ ok: true, deleted, audited: true });
      }
      return json({ error: "not_found" }, 404);
    }),
  );
  return { calls, state };
}

function el<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function auditRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll("#audit-rows tr")) as HTMLElement[];
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function boot() {
  document.body.innerHTML = bodyHtml;
  (window as any).AdminDialog = { confirm: vi.fn(async () => true) };
  new Function(script)();
  await flush();
}

beforeEach(() => {
  fakeApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("panel Chẩn đoán — nhật ký thao tác", () => {
  it("hiện 50 dòng gần nhất với nhãn hành động tiếng Việt", async () => {
    await boot();
    expect(auditRows()).toHaveLength(2);
    expect(el("audit-state").textContent).toBe("2 dòng");
    expect(auditRows()[0].textContent).toContain("Xóa góp ý");
    expect(auditRows()[0].textContent).toContain("feedback-0001");
    expect(auditRows()[1].textContent).toContain("Đổi cờ hệ thống");
  });

  it("nút xoá nhật ký lỗi tắt khi không đọc được overview", async () => {
    await boot();
    expect(el<HTMLButtonElement>("errors-clear").disabled).toBe(true);
    expect(el("errors-note").textContent).toContain("Không đọc được nhật ký lỗi");
  });

  it("xoá nhật ký thao tác gọi DELETE rồi tải lại danh sách", async () => {
    const api = fakeApi();
    await boot();

    const clear = el<HTMLButtonElement>("audit-clear");
    expect(clear.disabled).toBe(false);
    clear.click();
    await flush();

    const del = api.calls.find(
      (call) => call.url === "/api/admin/audit" && call.init?.method === "DELETE",
    );
    expect(del).toBeTruthy();
    expect(auditRows()).toHaveLength(1);
    expect(auditRows()[0].textContent).toContain("Chưa có thao tác nào");
    expect(el("audit-note").textContent).toContain("Đã xóa 2 dòng");
  });

  it("lỗi đọc nhật ký hiện cảnh báo và tắt nút xoá", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        if (String(input) === "/api/admin/overview") return json({ error: "x" }, 500);
        return json({ error: "d1_error" }, 500);
      }),
    );
    await boot();
    expect(el("audit-state").textContent).toContain("Lỗi đọc");
    expect(el<HTMLButtonElement>("audit-clear").disabled).toBe(true);
  });
});
