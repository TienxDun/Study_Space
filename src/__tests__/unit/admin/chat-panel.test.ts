// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAdminHtml } from "./load-admin-html";

const html = loadAdminHtml();
const bodyHtml = html
  .slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/gi, "");
const chatScript = readFileSync(
  resolve(__dirname, "../../../../admin-host/scripts/chat.js"),
  "utf8",
);

const MODELS = [
  {
    id: "motapis/qwen3-30b",
    displayName: "Qwen3 30B",
    provider: "motapis",
    free: true,
    available: true,
    contextTokens: 131072,
    maxOutputTokens: 8192,
    priceIn: 0,
    priceOut: 0,
    priceSource: "models.dev",
    specSource: "models.js",
    checkedAt: "2026-11-20T18:31:59.000Z",
  },
  {
    id: "motapis/llama-4",
    displayName: "Llama 4",
    provider: "motapis",
    free: false,
    available: false,
    contextTokens: 200000,
    maxOutputTokens: 4096,
    priceIn: 0.27,
    priceOut: 0.85,
    priceSource: "",
    specSource: "",
    checkedAt: "2026-11-20T18:31:59.000Z",
  },
  {
    id: "motapis/unchecked",
    displayName: "Mô hình mới",
    provider: "motapis",
    free: false,
    available: null,
    contextTokens: null,
    maxOutputTokens: null,
    priceIn: null,
    priceOut: null,
    priceSource: "",
    specSource: "",
    checkedAt: "",
  },
];

const CATALOG = {
  ok: true,
  generatedAt: "2026-11-20T18:31:59.000Z",
  counts: { total: 3, free: 1, unverified: 1, unavailable: 1 },
  models: MODELS,
};

const USAGE = {
  ok: true,
  day: "2026-11-21",
  days: 30,
  today: { total: 12, users: 3 },
  limit: 30,
  limitFromFlags: false,
  series: [
    { day: "2026-11-20", total: 4, users: 2 },
    { day: "2026-11-21", total: 12, users: 3 },
  ],
  top: [
    { uid: "uid-an", count: 6, name: "An", email: "an@example.com", aiDisabled: false },
    { uid: "uid-bi", count: 3, name: "", email: "", aiDisabled: true },
  ],
};

type Endpoint = { body: unknown; status?: number };

const GOOD = {
  catalog: { body: CATALOG },
  usage: { body: USAGE },
};

function stall() {
  for (let i = 0; i < 50; i += 1) void Promise.resolve();
}

async function flush() {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((done) => setTimeout(done, 0));
  }
}

function boot(endpoints: { catalog: Endpoint; usage: Endpoint } = GOOD) {
  document.body.innerHTML = bodyHtml;
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      const match = url.includes("/api/admin/chat/catalog")
        ? endpoints.catalog
        : url.includes("/api/admin/chat/usage")
          ? endpoints.usage
          : { body: { ok: true } };
      return new Response(JSON.stringify(match.body), {
        status: match.status ?? 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
  new Function(chatScript)();
  stall();
  return { calls };
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error("Thiếu #" + id);
  return found as T;
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("#chat-model-rows tr"));
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("panel Trợ lý chat (bước 3)", () => {
  it("đổ danh mục, số liệu và bảng mô hình", async () => {
    boot();
    await flush();

    expect(el("chat-stat-total").textContent).toBe("3");
    expect(el("chat-stat-free").textContent).toBe("1");
    expect(el("chat-stat-unverified").textContent).toBe("1");
    expect(el("chat-stat-unavailable").textContent).toBe("1");
    expect(el("chat-stat-generated").textContent).not.toBe("—");
    expect(el("chat-catalog-chip").textContent).toBe("3 mô hình");
    expect(el("chat-model-count").textContent).toBe("Hiển thị 3/3 mô hình.");
    expect(el("chat-state").textContent).toBe("Đã cập nhật");

    const list = rows();
    expect(list).toHaveLength(3);
    expect(list[0].textContent).toContain("Qwen3 30B");
    expect(list[0].textContent).toContain("motapis/qwen3-30b");
    expect(list[0].textContent).toContain("Miễn phí");
    expect(list[0].textContent).toContain("Khả dụng");
    expect(list[0].textContent).toContain("131K");

    expect(list[1].textContent).toContain("Trả phí");
    expect(list[1].textContent).toContain("Tạm không khả dụng");
    expect(list[1].textContent).toContain("$0,27");

    expect(list[2].textContent).toContain("Chưa xác minh");
  });

  it("tìm theo chữ và lọc theo loại mô hình", async () => {
    boot();
    await flush();

    const search = el<HTMLInputElement>("chat-model-search");
    search.value = "llama";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    expect(rows()).toHaveLength(1);
    expect(el("chat-model-count").textContent).toBe("Hiển thị 1/3 mô hình.");

    search.value = "";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const filter = el<HTMLSelectElement>("chat-model-filter");

    const cases: Array<[string, number]> = [
      ["free", 1],
      ["paid", 2],
      ["unverified", 1],
      ["unavailable", 1],
      ["all", 3],
    ];
    for (const [value, expected] of cases) {
      filter.value = value;
      filter.dispatchEvent(new Event("change", { bubbles: true }));
      expect(rows()).toHaveLength(expected);
    }
  });

  it("không khớp bộ lọc thì hiện dòng trống", async () => {
    boot();
    await flush();

    const search = el<HTMLInputElement>("chat-model-search");
    search.value = "không-tồn-tại";
    search.dispatchEvent(new Event("input", { bubbles: true }));

    const list = rows();
    expect(list).toHaveLength(1);
    expect(list[0].textContent).toContain("Không có mô hình nào khớp bộ lọc.");
  });

  it("vẽ mức sử dụng, biểu đồ và danh sách người chat nhiều", async () => {
    boot();
    await flush();

    expect(el("chat-usage-today").textContent).toBe("12");
    expect(el("chat-usage-users").textContent).toBe("3");
    expect(el("chat-usage-limit").textContent).toBe("30 (mặc định)");

    const bars = Array.from(document.querySelectorAll<HTMLElement>("#chat-usage-bars .chat-bar"));
    expect(bars).toHaveLength(2);
    expect(bars[0].style.height).toBe("33%");
    expect(bars[1].style.height).toBe("100%");
    expect(el("chat-chart-from").textContent).toBe("20/11");
    expect(el("chat-chart-to").textContent).toBe("21/11");

    const items = Array.from(document.querySelectorAll<HTMLElement>("#chat-top-users li"));
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("An");
    expect(items[0].textContent).toContain("an@example.com");
    expect(items[0].textContent).toContain("6 câu");
    expect(items[1].textContent).toContain("uid-bi");
    expect(items[1].textContent).toContain("Đã chặn AI");
    expect(items[1].textContent).toContain("3 câu");
  });

  it("bấm tên người dùng thì chuyển sang tab Người dùng kèm UID", async () => {
    boot();
    await flush();

    const opened: string[] = [];
    document.addEventListener("admin:open-user", (event) => {
      opened.push((event as CustomEvent).detail.uid);
    });

    const name = document.querySelector<HTMLButtonElement>("#chat-top-users .chat-top-name");
    expect(name).not.toBeNull();
    name?.click();

    expect(opened).toEqual(["uid-an"]);
    expect(window.location.hash).toBe("#users");
  });

  it("lỗi danh mục và lỗi D1 hiện ghi chú rõ ràng", async () => {
    boot({
      catalog: { body: { ok: false, error: "chat_v2_unreachable" }, status: 502 },
      usage: { body: { ok: false, error: "d1_unavailable" }, status: 503 },
    });
    await flush();

    expect(el("chat-catalog-note").textContent).toContain(
      "Không kết nối được Worker chat-v2.",
    );
    expect(el("chat-catalog-chip").textContent).toBe("Lỗi");
    expect(el("chat-usage-note").textContent).toContain(
      "Chưa gắn cơ sở dữ liệu D1 nên chưa đọc được số lượt.",
    );
    expect(el("chat-usage-limit").textContent).toBe("—");
    expect(el("chat-state").textContent).toBe("Có lỗi");
    expect(rows()[0].textContent).toContain("Chưa đọc được danh mục.");
  });

  it("nút Làm mới tải lại cả hai nguồn", async () => {
    const { calls } = boot();
    await flush();
    expect(calls).toHaveLength(2);

    el<HTMLButtonElement>("chat-refresh").click();
    await flush();

    expect(calls).toHaveLength(4);
    expect(el("chat-state").textContent).toBe("Đã cập nhật");
  });
});
