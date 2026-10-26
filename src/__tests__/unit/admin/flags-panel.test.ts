// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(__dirname, "../../../../admin-host/index.html"), "utf8");
// Bỏ thẻ script: bài test tự import admin.js, không để happy-dom tải file.
const bodyHtml = html
  .slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/gi, "");
const scriptPath = resolve(__dirname, "../../../../admin-host/admin.js");

const overview = (flags: Record<string, unknown>) => ({
  generatedAt: new Date().toISOString(),
  email: "admin@example.com",
  degraded: false,
  health: { ok: true, checks: [] },
  chat: { ok: true, day: "2026-10-26", total: 4, users: 1, dailyLimit: 30 },
  sync: { ok: true, users: 1, lastAt: null, maxBytes: 0 },
  livekit: { ok: true, month: "2026-10", usedMinutes: 1, limitMinutes: 4500, roomsOpen: 0, participants: 0 },
  errors: { ok: true, items: [] },
  r2: { ok: true, bytes: 0, objects: 0, partial: false },
  flags: { ok: true, updatedAt: 0, updatedBy: "", ...flags },
  limits: { chatDaily: 30, snapshotMaxBytes: 2_000_000, r2: "10 GB", r2Bytes: 10_000_000_000 },
});

type FetchCall = { url: string; init?: RequestInit };

function stubApi(overviewBody: Record<string, any>, saveResponse?: unknown) {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      const isSave = String(url).endsWith("/api/admin/flags");
      let body: unknown = overviewBody;
      if (isSave) {
        if (saveResponse !== undefined) {
          body = saveResponse;
        } else {
          const sent = JSON.parse(String(init?.body || "{}"));
          const saved = { ...sent, updatedAt: Date.now(), updatedBy: "admin@example.com" };
          overviewBody.flags = { ...overviewBody.flags, ...saved };
          body = { ok: true, flags: saved };
        }
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  return calls;
}

// admin.js là script thuần (IIFE), không phải module: chạy trong ngữ cảnh happy-dom.
const adminScript = readFileSync(scriptPath, "utf8");
function runAdminScript() {
  new Function(adminScript)();
}

async function boot() {
  document.body.innerHTML = bodyHtml;
  const auto = document.getElementById("auto-refresh-check") as HTMLInputElement;
  auto.checked = false;
  runAdminScript();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function el<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

beforeEach(() => {
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("panel Cờ hệ thống", () => {
  it("đổ cờ từ overview và khóa nút Lưu khi chưa đổi gì", async () => {
    stubApi(
      overview({
        chatEnabled: true,
        roomsEnabled: false,
        maintenance: false,
        banner: "Bảo trì 30 phút",
        chatDailyLimit: 45,
      }),
    );
    await boot();

    expect((el("flag-chat") as HTMLInputElement).checked).toBe(true);
    expect((el("flag-rooms") as HTMLInputElement).checked).toBe(false);
    expect((el("flag-banner") as HTMLInputElement).value).toBe("Bảo trì 30 phút");
    expect((el("flag-limit") as HTMLInputElement).value).toBe("45");
    expect(el("flag-limit-current").textContent).toBe("45");
    expect(el("flags-state").textContent).toBe("Đang tắt bớt");
    expect((el("flags-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("đổi cờ mới bật nút Lưu; lưu gửi đúng 5 trường và hỏi xác nhận hậu quả", async () => {
    const calls = stubApi(
      overview({ chatEnabled: true, roomsEnabled: true, maintenance: false, banner: "", chatDailyLimit: 30 }),
    );
    await boot();

    (el("flag-chat") as HTMLInputElement).click();
    (el("flag-banner") as HTMLInputElement).value = "Thử banner";
    (el("flag-banner") as HTMLInputElement).dispatchEvent(new Event("input"));
    (el("flag-limit") as HTMLInputElement).value = "35";
    (el("flag-limit") as HTMLInputElement).dispatchEvent(new Event("input"));

    expect(el("flag-banner-count").textContent).toBe("10");
    expect((el("flags-save") as HTMLButtonElement).disabled).toBe(false);

    (el("flags-save") as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(confirm).toHaveBeenCalledTimes(1);
    const dialog = String((confirm as unknown as { mock: { calls: string[][] } }).mock.calls[0][0]);
    expect(dialog).toContain("Tắt chat sẽ chặn tất cả người dùng ngay");

    const save = calls.find((call) => call.url.endsWith("/api/admin/flags"));
    expect(save?.init?.method).toBe("POST");
    expect(JSON.parse(String(save?.init?.body))).toEqual({
      chatEnabled: false,
      roomsEnabled: true,
      maintenance: false,
      banner: "Thử banner",
      chatDailyLimit: 35,
    });
    expect((el("flag-chat") as HTMLInputElement).checked).toBe(false);
    expect(el("flags-state").textContent).toBe("Đang tắt bớt");
    expect(el("flags-note").textContent).toContain("bởi admin@example.com");
  });

  it("hạn mức ngoài 1–200 thì không gửi và báo rõ", async () => {
    const calls = stubApi(overview({ chatEnabled: true, roomsEnabled: true, maintenance: false, banner: "", chatDailyLimit: 30 }));
    await boot();

    (el("flag-limit") as HTMLInputElement).value = "0";
    (el("flag-limit") as HTMLInputElement).dispatchEvent(new Event("input"));
    (el("flags-save") as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.some((call) => call.url.endsWith("/api/admin/flags"))).toBe(false);
    expect(el("flags-note").textContent).toContain("từ 1 đến 200");
  });

  it("không xác nhận thì không gọi API", async () => {
    const calls = stubApi(overview({ chatEnabled: true, roomsEnabled: true, maintenance: false, banner: "", chatDailyLimit: 30 }));
    (confirm as unknown as { mockReturnValue: (value: boolean) => void }).mockReturnValue(false);
    await boot();

    (el("flag-maintenance") as HTMLInputElement).click();
    (el("flags-save") as HTMLButtonElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls.some((call) => call.url.endsWith("/api/admin/flags"))).toBe(false);
  });

  it("cờ đọc lỗi thì panel đỏ và khóa mọi ô nhập", async () => {
    stubApi(overview({}));
    await boot();

    expect(el("flags-card").classList.contains("is-degraded")).toBe(false);

    document.body.innerHTML = bodyHtml;
    stubApi({ ...overview({}), flags: { ok: false, error: "missing_binding" } });
    runAdminScript();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(el("flags-card").classList.contains("is-degraded")).toBe(true);
    expect(el("flags-state").textContent).toBe("Không đọc được");
    expect(el("flags-note").textContent).toContain("chưa gắn kho cấu hình");
    expect((el("flag-chat") as HTMLInputElement).disabled).toBe(true);
    expect((el("flag-limit") as HTMLInputElement).disabled).toBe(true);
    expect((el("flags-save") as HTMLButtonElement).disabled).toBe(true);
  });
});
