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
  resolve(__dirname, "../../../../admin-host/scripts/feedback.js"),
  "utf8",
);

type Call = { url: string; init?: RequestInit };
type Row = Record<string, any>;

const LIST: Row[] = [
  {
    id: "feedback-0001",
    uid: "user_alice",
    name: "Bạn An",
    kind: "bug",
    preview: "Nút bấm không phản hồi trên điện thoại.",
    contact: "an@example.com",
    appVersion: "v0.1.0",
    platform: "android",
    viewport: "390x844",
    locale: "vi-VN",
    status: "open",
    createdAt: 1700000000000,
    resolvedAt: 0,
    resolvedBy: "",
    resolutionNote: "",
    hasImage: true,
  },
  {
    id: "feedback-0002",
    uid: "user_bob",
    name: "",
    kind: "idea",
    preview: "Mong có thêm chế độ học nhóm.",
    contact: "",
    appVersion: "v0.1.0",
    platform: "web",
    viewport: "1280x800",
    locale: "vi-VN",
    status: "open",
    createdAt: 1699999999000,
    resolvedAt: 0,
    resolvedBy: "",
    resolutionNote: "",
    hasImage: false,
  },
];

const DETAIL_XSS = `<img src=x onerror="alert(1)"> Nội dung góp ý`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function fakeApi(options: { failList?: boolean; failResolve?: boolean; nextBefore?: number | null; resolved?: number; open?: number } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const method = init?.method || "GET";
      if (url.startsWith("/api/admin/feedback?")) {
        if (options.failList) return json({ error: "d1_error" }, 500);
        return json({
          ok: true,
          feedback: options.open === 0 ? [] : LIST,
          counts: {
            open: options.open ?? 2,
            resolved: options.resolved || 0,
            dismissed: 0,
            total: (options.open ?? 2) + (options.resolved || 0),
          },
          nextBefore: options.nextBefore ?? null,
        });
      }
      if (url === "/api/admin/feedback/purge" && method === "POST") {
        return json({ ok: true, deleted: 1 });
      }
      if (url === "/api/admin/feedback/feedback-0001" && method === "DELETE") {
        return json({ ok: true, deleted: 1 });
      }
      if (url === "/api/admin/feedback/feedback-0001") {
        return json({ ok: true, feedback: { ...LIST[0], message: DETAIL_XSS } });
      }
      if (url === "/api/admin/feedback/feedback-0002") {
        return json({ ok: true, feedback: { ...LIST[1], message: "Mong có thêm chế độ học nhóm." } });
      }
      if (url.endsWith("/status")) {
        if (options.failResolve) return json({ error: "d1_error" }, 500);
        return json({ ok: true, id: "feedback-0001", status: "resolved" });
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
  return Array.from(document.querySelectorAll("#feedback-rows tr")) as HTMLElement[];
}

async function flush() {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function boot(confirmResult = true) {
  document.body.innerHTML = bodyHtml;
  (window as any).AdminDialog = { confirm: vi.fn(async () => confirmResult) };
  new Function(script)();
  await flush();
}

function changeSelect(id: string, value: string) {
  const select = el<HTMLSelectElement>(id);
  select.value = value;
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  fakeApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("panel Phản hồi", () => {
  it("hiện danh sách, loại, tên người gửi và số đếm", async () => {
    await boot();
    expect(rows()).toHaveLength(2);
    expect(el("feedback-count-open").textContent).toBe("2");
    expect(el("feedback-state").textContent).toContain("2 chờ xử lý");
    expect(rows()[0].textContent).toContain("Bạn An");
    expect(rows()[0].textContent).toContain("Báo lỗi");
    expect(rows()[0].textContent).toContain("Nút bấm không phản hồi trên điện thoại.");
    // Ô người gửi hiện tên, UID để trong tooltip; chưa có tên thì lùi về UID rút gọn.
    const personCell = rows()[1].querySelectorAll("td")[1] as HTMLElement;
    expect(personCell.textContent).toBe("user_bob");
    expect(personCell.title).toBe("user_bob");
  });

  it("badge trên rail hiện số mục chờ và ẩn khi hết", async () => {
    await boot();
    const badge = el("tab-badge-feedback");
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe("2");
    expect(badge.title).toBe("2 mục chờ xử lý");
  });

  it("badge ẩn khi không còn mục chờ", async () => {
    fakeApi({ open: 0 });
    await boot();
    expect(el("tab-badge-feedback").hidden).toBe(true);
  });

  it("mở chi tiết và render nội dung dạng text, không chạy HTML", async () => {
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    expect(el("feedback-detail").hidden).toBe(false);
    const message = el("feedback-detail-message");
    expect(message.textContent).toContain("<img src=x");
    expect(message.querySelector("img")).toBeNull();
    const meta = el("feedback-detail-meta").textContent || "";
    expect(meta).toContain("Báo lỗi");
    expect(meta).toContain("Bạn An");
    expect(meta).toContain("an@example.com");
    expect(meta).toContain("Ứng dụng Android");
    expect(meta).toContain("390x844");
  });

  it("đánh dấu góp ý có ảnh và hiện ảnh trong chi tiết", async () => {
    await boot();
    expect(rows()[0].querySelector(".feedback-image-tag")?.textContent).toBe("Có ảnh");
    expect(rows()[1].querySelector(".feedback-image-tag")).toBeNull();

    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();
    const wrap = el("feedback-detail-image-wrap");
    const img = el<HTMLImageElement>("feedback-detail-image");
    const link = el<HTMLAnchorElement>("feedback-detail-image-link");
    expect(wrap.hidden).toBe(false);
    expect(img.getAttribute("src")).toBe("/api/admin/feedback/feedback-0001/image");
    expect(link.getAttribute("href")).toBe("/api/admin/feedback/feedback-0001/image");

    // Đóng chi tiết thì bỏ src để không giữ ảnh đã giải mã trong bộ nhớ.
    el("feedback-detail-close").click();
    expect(wrap.hidden).toBe(true);
    expect(img.getAttribute("src")).toBeNull();
  });

  it("góp ý không có ảnh thì ẩn khối ảnh", async () => {
    await boot();
    (rows()[1].querySelector("button") as HTMLButtonElement).click();
    await flush();
    expect(el("feedback-detail").hidden).toBe(false);
    expect(el("feedback-detail-image-wrap").hidden).toBe(true);
    expect(el<HTMLImageElement>("feedback-detail-image").getAttribute("src")).toBeNull();
  });

  it("đổi bộ lọc trạng thái/loại thì gọi đúng query", async () => {
    const api = fakeApi();
    await boot();

    changeSelect("feedback-kind", "bug");
    await flush();
    expect(api.calls.at(-1)?.url).toContain("status=open");
    expect(api.calls.at(-1)?.url).toContain("kind=bug");

    changeSelect("feedback-status", "all");
    await flush();
    expect(api.calls.at(-1)?.url).toContain("status=all");
    expect(api.calls.at(-1)?.url).toContain("kind=bug");
  });

  it("đổi bộ lọc khi đang tải thì tải lại theo bộ lọc mới nhất", async () => {
    const pending: Array<(res: Response) => void> = [];
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((input: unknown) => {
        urls.push(String(input));
        return new Promise<Response>((resolve) => pending.push(resolve));
      }),
    );

    await boot();
    expect(urls).toHaveLength(1);

    // Request đầu chưa xong; đổi lọc phải được hẹn lại chứ không bị bỏ mất.
    changeSelect("feedback-kind", "bug");
    expect(urls).toHaveLength(1);

    const empty = { open: 0, resolved: 0, dismissed: 0, total: 0 };
    pending[0](json({ ok: true, feedback: [], counts: empty, nextBefore: null }));
    await flush();

    expect(urls).toHaveLength(2);
    expect(urls[1]).toContain("kind=bug");

    pending[1](json({ ok: true, feedback: [], counts: empty, nextBefore: null }));
    await flush();
    expect(el("feedback-state").textContent).toContain("0 chờ xử lý");
  });

  it("hết trang thì ẩn nút Xem thêm và bấm cũng không tải lại", async () => {
    const api = fakeApi();
    await boot();

    expect(el<HTMLButtonElement>("feedback-more").hidden).toBe(true);
    const listCalls = () =>
      api.calls.filter((call) => call.url.startsWith("/api/admin/feedback?")).length;
    expect(listCalls()).toBe(1);

    el("feedback-more").click();
    await flush();
    expect(listCalls()).toBe(1);
    expect(rows()).toHaveLength(2);
  });

  it("nối trang sau không lặp góp ý đã có", async () => {
    fakeApi({ nextBefore: 123 });
    await boot();
    expect(rows()).toHaveLength(2);

    el("feedback-more").click();
    await flush();
    expect(rows()).toHaveLength(2);
  });

  it("đánh dấu đã xử lý gửi POST kèm ghi chú và trạng thái", async () => {
    const api = fakeApi();
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    el<HTMLTextAreaElement>("feedback-resolve-note").value = "Đã sửa ở bản sau.";
    el("feedback-resolve").click();
    await flush();

    const post = api.calls.find(
      (call) => call.url.endsWith("/status") && call.init?.method === "POST",
    );
    expect(post?.url).toBe("/api/admin/feedback/feedback-0001/status");
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      status: "resolved",
      note: "Đã sửa ở bản sau.",
    });
    expect(el("feedback-detail-note").textContent).toContain("Đã đánh dấu xử lý");
  });

  it("bỏ qua góp ý gửi trạng thái dismissed", async () => {
    const api = fakeApi();
    await boot();
    (rows()[1].querySelector("button") as HTMLButtonElement).click();
    await flush();

    el("feedback-dismiss").click();
    await flush();

    const post = api.calls.find(
      (call) => call.url.endsWith("/status") && call.init?.method === "POST",
    );
    expect(JSON.parse(String(post?.init?.body))).toEqual({ status: "dismissed", note: "" });
    expect(el("feedback-detail-note").textContent).toContain("Đã bỏ qua góp ý");
  });

  it("lỗi đọc danh sách hiện thông báo ở #feedback-note", async () => {
    fakeApi({ failList: true });
    await boot();
    expect(el("feedback-note").hidden).toBe(false);
    expect(el("feedback-note").textContent).toContain("Không tải được dữ liệu");
    expect(el("feedback-state").textContent).toContain("Lỗi đọc góp ý");
  });

  it("lỗi xử lý giữ chi tiết mở và báo ở #feedback-detail-note", async () => {
    fakeApi({ failResolve: true });
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    el("feedback-resolve").click();
    await flush();

    expect(el("feedback-detail").hidden).toBe(false);
    expect(el("feedback-detail-note").textContent).toContain("Không tải được dữ liệu");
  });

  it("nút Xóa gửi DELETE sau khi xác nhận", async () => {
    const api = fakeApi();
    await boot();
    const deleteButton = rows()[0].querySelectorAll("button")[1] as HTMLButtonElement;
    expect(deleteButton.textContent).toBe("Xóa");

    deleteButton.click();
    await flush();

    const del = api.calls.find((call) => call.init?.method === "DELETE");
    expect(del?.url).toBe("/api/admin/feedback/feedback-0001");
    expect(el("feedback-note").textContent).toContain("Đã xóa góp ý");
  });

  it("hủy hộp xác nhận thì không xóa", async () => {
    const api = fakeApi();
    await boot(false);
    (rows()[0].querySelectorAll("button")[1] as HTMLButtonElement).click();
    await flush();
    expect(api.calls.some((call) => call.init?.method === "DELETE")).toBe(false);
  });

  it("nút xóa loạt tắt khi chưa có mục đã xử lý, bật khi có", async () => {
    await boot();
    expect(el<HTMLButtonElement>("feedback-purge").disabled).toBe(true);
  });

  it("xóa loạt gửi POST /purge", async () => {
    const api = fakeApi({ resolved: 1 });
    await boot();
    const purge = el<HTMLButtonElement>("feedback-purge");
    expect(purge.disabled).toBe(false);

    purge.click();
    await flush();

    const post = api.calls.find(
      (call) => call.url === "/api/admin/feedback/purge" && call.init?.method === "POST",
    );
    expect(post).toBeTruthy();
    expect(el("feedback-note").textContent).toContain("Đã xóa 1 góp ý");
  });
});
