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
  resolve(__dirname, "../../../../admin-host/scripts/users.js"),
  "utf8",
);

type Call = { url: string; init?: RequestInit };
type Row = Record<string, any>;

const USERS: Row[] = [
  {
    uid: "uid_alice",
    email: "alice@example.com",
    displayName: "Bạn An",
    createdAt: 1700000000000,
    lastSignInAt: 1760000000000,
    disabled: false,
    lastSyncAt: 1760500000000,
    syncBytes: 0,
    chatToday: 7,
    aiDisabled: false,
    roomsDisabled: false,
    restrictionNote: "",
  },
  {
    uid: "uid_bob",
    email: "bob@example.com",
    displayName: "",
    createdAt: 1700000001000,
    lastSignInAt: 1760000001000,
    disabled: false,
    lastSyncAt: 0,
    syncBytes: 0,
    chatToday: 0,
    aiDisabled: true,
    roomsDisabled: true,
    restrictionNote: "theo dõi",
  },
];

const XSS = `<img src=x onerror="alert(1)">`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function fakeApi(
  options: {
    nextPageToken?: string;
    lookupMissing?: boolean;
    failList?: boolean;
    failDetail?: boolean;
  } = {},
) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const method = init?.method || "GET";

      if (url.startsWith("/api/admin/users/lookup?")) {
        if (options.lookupMissing) return json({ ok: true, user: null });
        return json({ ok: true, user: { ...USERS[0], email: XSS } });
      }
      if (url === "/api/admin/users/uid_alice/restrictions" && method === "POST") {
        return json({ ok: true, restrictions: { uid: "uid_alice" } });
      }
      if (url === "/api/admin/users/uid_alice/chat-reset" && method === "POST") {
        return json({ ok: true, uid: "uid_alice" });
      }
      if (url.startsWith("/api/admin/users?")) {
        if (options.failList) return json({ ok: false, error: "data_api_unreachable" }, 502);
        return json({
          ok: true,
          users: USERS,
          nextPageToken: options.nextPageToken || "",
        });
      }
      if (url === "/api/admin/users/uid_alice") {
        if (options.failDetail) return json({ ok: false, error: "d1_unavailable" }, 500);
        return json({
          ok: true,
          user: { ...USERS[0], syncBytes: 2 * 1024 * 1024 },
          chatDays: [
            { day: "2026-11-10", count: 4 },
            { day: "2026-11-09", count: 9 },
          ],
          reports: [
            {
              id: "r-1",
              source: "room",
              status: "open",
              reason: "harassment",
              created_at: 300,
              role: "target",
            },
          ],
          blocks: [],
        });
      }
      return json({ error: "not_found" }, 404);
    }),
  );
  return { calls };
}

function el<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll("#users-rows tr")) as HTMLElement[];
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function boot() {
  document.body.innerHTML = bodyHtml;
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

describe("panel Người dùng", () => {
  it("hiện danh sách với email, tên, đăng nhập và chat hôm nay", async () => {
    await boot();
    expect(rows()).toHaveLength(2);
    expect(rows()[0].textContent).toContain("alice@example.com");
    expect(rows()[0].textContent).toContain("Bạn An");
    expect(rows()[0].textContent).toContain("7");
    expect(rows()[0].textContent).toContain("Bình thường");
    expect(rows()[1].textContent).toContain("Khóa AI + phòng");
    expect(el("users-state").textContent).toContain("2 người");
    expect(el<HTMLButtonElement>("users-more").hidden).toBe(true);
  });

  it("mở chi tiết hiện dung lượng, 30 ngày chat và báo cáo liên quan", async () => {
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    expect(el("users-detail").hidden).toBe(false);
    const meta = el("users-detail-meta").textContent || "";
    expect(meta).toContain("alice@example.com");
    expect(meta).toContain("2,00 MB");
    expect(el("users-chat-days").textContent).toContain("4 câu");
    expect(el("users-chat-days").textContent).toContain("9 câu");
    expect(el("users-reports").textContent).toContain("Bị báo cáo");
    expect(el("users-reports").textContent).toContain("harassment");
  });

  it("mở chi tiết ẩn danh sách, quay lại giữ nguyên danh sách đã tải", async () => {
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    expect(el<HTMLElement>("users-list-view").hidden).toBe(true);
    expect(el("users-detail").hidden).toBe(false);
    expect(el("users-detail-title").textContent).toContain("alice@example.com");
    expect(el("users-detail-sub").textContent).toContain("Bạn An");

    el<HTMLButtonElement>("users-detail-close").click();

    expect(el<HTMLElement>("users-list-view").hidden).toBe(false);
    expect(el("users-detail").hidden).toBe(true);
    expect(rows()).toHaveLength(2);
  });

  it("chi tiết lỗi thì báo trong màn chi tiết và giữ nút quay lại", async () => {
    fakeApi({ failDetail: true });
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    expect(el("users-detail").hidden).toBe(false);
    expect(el("users-detail-note").textContent).toContain("D1");
    expect(el<HTMLButtonElement>("users-restrict-save").disabled).toBe(true);

    el<HTMLButtonElement>("users-detail-close").click();
    expect(el<HTMLElement>("users-list-view").hidden).toBe(false);
  });

  it("tải thêm nối trang theo nextPageToken và không lặp người đã có", async () => {
    const api = fakeApi({ nextPageToken: "page-2" });
    await boot();
    expect(rows()).toHaveLength(2);
    expect(el<HTMLButtonElement>("users-more").hidden).toBe(false);

    el("users-more").click();
    await flush();

    expect(rows()).toHaveLength(2);
    const moreCall = api.calls.find((call) => call.url.includes("pageToken=page-2"));
    expect(moreCall).toBeTruthy();
  });

  it("tìm email không thấy thì báo rõ, không đổi danh sách", async () => {
    fakeApi({ lookupMissing: true });
    await boot();
    el<HTMLInputElement>("users-search-input").value = "no@example.com";
    el("users-search-btn").click();
    await flush();

    expect(el("users-note").textContent).toContain("Không tìm thấy");
    expect(el("users-note").hidden).toBe(false);
    expect(rows()).toHaveLength(2);
  });

  it("tìm thấy thì thay danh sách bằng kết quả và render email dạng text", async () => {
    fakeApi();
    await boot();
    el<HTMLInputElement>("users-search-input").value = "alice@example.com";
    el("users-search-btn").click();
    await flush();

    expect(rows()).toHaveLength(1);
    const cell = rows()[0].querySelector(".users-email") as HTMLElement;
    expect(cell.textContent).toContain("<img src=x");
    expect(cell.querySelector("img")).toBeNull();
    expect(el("users-state").textContent).toBe("1 kết quả");
  });

  it("email trống thì nhắc nhập, không gọi API", async () => {
    const api = fakeApi();
    await boot();
    el<HTMLInputElement>("users-search-input").value = "  ";
    el("users-search-btn").click();
    await flush();

    expect(el("users-note").textContent).toContain("Nhập email");
    expect(api.calls.some((call) => call.url.includes("/lookup?"))).toBe(false);
  });

  it("data-api lỗi thì bảng rỗng và có thông báo, không treo tab", async () => {
    fakeApi({ failList: true });
    await boot();

    expect(rows()).toHaveLength(1);
    expect(rows()[0].textContent).toContain("Không có người dùng");
    expect(el("users-state").textContent).toContain("Lỗi");
    expect(el("users-note").textContent).toContain("data-api");
  });

  it("làm mới xóa ô tìm và tải lại trang đầu", async () => {
    const api = fakeApi();
    await boot();
    el<HTMLInputElement>("users-search-input").value = "alice@example.com";
    el("users-refresh").click();
    await flush();

    expect(el<HTMLInputElement>("users-search-input").value).toBe("");
    const listCalls = api.calls.filter((call) => call.url.startsWith("/api/admin/users?"));
    expect(listCalls).toHaveLength(2);
  });

  it("chi tiết hiện hạn chế hiện tại và số câu chat hôm nay", async () => {
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    expect(el<HTMLInputElement>("users-restrict-ai").checked).toBe(false);
    expect(el<HTMLInputElement>("users-restrict-rooms").checked).toBe(false);
    expect(el("users-quota-count").textContent).toBe("7");
  });

  it("lưu hạn chế gửi POST đúng payload và báo đã lưu", async () => {
    const api = fakeApi();
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    el<HTMLInputElement>("users-restrict-ai").checked = true;
    el<HTMLTextAreaElement>("users-restrict-note").value = "Tạm khóa AI.";
    el("users-restrict-save").click();
    await flush();

    const post = api.calls.find(
      (call) =>
        call.url === "/api/admin/users/uid_alice/restrictions" &&
        call.init?.method === "POST",
    );
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      aiDisabled: true,
      roomsDisabled: false,
      note: "Tạm khóa AI.",
    });
    expect(el("users-restrict-state").textContent).toContain("Đã lưu hạn chế");
  });

  it("đặt lại hạn mức chat gửi POST và đưa số câu về 0", async () => {
    const api = fakeApi();
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    el("users-chat-reset").click();
    await flush();

    const post = api.calls.find(
      (call) =>
        call.url === "/api/admin/users/uid_alice/chat-reset" &&
        call.init?.method === "POST",
    );
    expect(post).toBeTruthy();
    expect(el("users-quota-count").textContent).toBe("0");
    expect(el("users-chat-reset-state").textContent).toContain("Đã đặt lại");
    expect(rows()[0].textContent).toContain("0");
  });
});
