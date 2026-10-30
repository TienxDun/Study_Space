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
  resolve(__dirname, "../../../../admin-host/scripts/reports.js"),
  "utf8",
);

type Call = { url: string; init?: RequestInit };
type Row = Record<string, any>;

const LIST: Row[] = [
  {
    id: "report-0001",
    source: "ai",
    reporterUid: "user_alice",
    targetUid: null,
    room: null,
    sessionId: "sid-1",
    messageId: "msg-1",
    contentPreview: "Câu trả lời sai.",
    question: "Newton là gì?",
    reason: "inaccurate",
    detail: "demo",
    status: "open",
    createdAt: 1700000000000,
    resolvedAt: 0,
    resolvedBy: "",
    resolutionNote: "",
  },
  {
    id: "report-0002",
    source: "room",
    reporterUid: "user_alice",
    targetUid: "user_bob",
    room: "phong-1",
    sessionId: null,
    messageId: null,
    contentPreview: "Quấy rối.",
    reason: "harassment",
    status: "open",
    createdAt: 1699999999000,
    resolvedAt: 0,
    resolvedBy: "",
    resolutionNote: "",
  },
];

const DETAIL_XSS = `<img src=x onerror="alert(1)"> Nội dung bị báo cáo`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function fakeApi(options: { failResolve?: boolean } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const method = init?.method || "GET";

      if (url.startsWith("/api/admin/reports?")) {
        return json({
          ok: true,
          reports: LIST,
          counts: { open: 2, resolved: 0, dismissed: 0, total: 2 },
          nextBefore: null,
        });
      }
      if (url === "/api/admin/reports/report-0001") {
        return json({
          ok: true,
          report: {
            ...LIST[0],
            content: DETAIL_XSS,
          },
        });
      }
      if (url === "/api/admin/reports/report-0002") {
        return json({
          ok: true,
          report: {
            ...LIST[1],
            content: DETAIL_XSS,
          },
        });
      }
      if (url.endsWith("/resolve")) {
        if (options.failResolve) return json({ error: "d1_error" }, 500);
        return json({ ok: true, id: "report-0001", status: "resolved" });
      }
      if (url === "/api/admin/users/user_bob/restrictions" && method === "GET") {
        return json({
          ok: true,
          restrictions: {
            uid: "user_bob",
            aiDisabled: false,
            roomsDisabled: false,
            note: "",
            updatedAt: 0,
            updatedBy: "",
          },
        });
      }
      if (url === "/api/admin/users/user_bob/restrictions" && method === "POST") {
        return json({ ok: true, restrictions: { uid: "user_bob" } });
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
  return Array.from(document.querySelectorAll("#reports-rows tr")) as HTMLElement[];
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

describe("panel Báo cáo", () => {
  it("hiện danh sách, số đếm và nút xem", async () => {
    await boot();
    expect(rows()).toHaveLength(2);
    expect(el("reports-count-open").textContent).toBe("2");
    expect(el("reports-state").textContent).toContain("2 chờ xử lý");
    expect(rows()[0].textContent).toContain("Trợ lý AI");
    expect(rows()[1].textContent).toContain("Phòng học");
  });

  it("mở chi tiết và render nội dung dạng text, không chạy HTML", async () => {
    await boot();
    const button = rows()[0].querySelector("button") as HTMLButtonElement;
    button.click();
    await flush();

    expect(el("reports-detail").hidden).toBe(false);
    const content = el("reports-detail-content");
    expect(content.textContent).toContain("<img src=x");
    expect(content.querySelector("img")).toBeNull();
    expect(el("reports-detail-meta").textContent).toContain("Thông tin sai/lạc hậu");
  });

  it("hiện ghi chú của người báo cáo trong khối chi tiết", async () => {
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    const meta = el("reports-detail-meta").textContent || "";
    expect(meta).toContain("Ghi chú của người báo cáo");
    expect(meta).toContain("demo");
  });

  it("hiện câu hỏi của người dùng khi báo cáo có lưu", async () => {
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    expect(el("reports-question-wrap").hidden).toBe(false);
    expect(el("reports-detail-question").textContent).toBe("Newton là gì?");
  });

  it("hết trang thì ẩn nút Xem thêm và bấm cũng không tải lại", async () => {
    const api = fakeApi();
    await boot();

    expect(el<HTMLButtonElement>("reports-more").hidden).toBe(true);
    expect(rows()).toHaveLength(2);
    const listCalls = () =>
      api.calls.filter((call) => call.url.startsWith("/api/admin/reports?")).length;
    expect(listCalls()).toBe(1);

    el("reports-more").click();
    await flush();

    expect(listCalls()).toBe(1);
    expect(rows()).toHaveLength(2);
  });

  it("nối trang sau không lặp báo cáo đã có", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input);
        if (url.startsWith("/api/admin/reports?")) {
          return json({
            ok: true,
            reports: LIST,
            counts: { open: 2, resolved: 0, dismissed: 0, total: 2 },
            nextBefore: 123,
          });
        }
        return json({ error: "not_found" }, 404);
      }),
    );
    await boot();
    expect(rows()).toHaveLength(2);

    el("reports-more").click();
    await flush();

    expect(rows()).toHaveLength(2);
  });

  it("đánh dấu đã xử lý gửi POST kèm ghi chú và trạng thái", async () => {
    const api = fakeApi();
    await boot();
    (rows()[0].querySelector("button") as HTMLButtonElement).click();
    await flush();

    el<HTMLTextAreaElement>("reports-resolve-note").value = "Đã kiểm tra.";
    el("reports-resolve").click();
    await flush();

    const post = api.calls.find(
      (call) => call.url.endsWith("/resolve") && call.init?.method === "POST",
    );
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post?.init?.body))).toEqual({
      status: "resolved",
      note: "Đã kiểm tra.",
    });
    expect(el("reports-detail-note").textContent).toContain("Đã đánh dấu xử lý");
  });

  it("báo cáo phòng hiện khối hạn chế và gửi đúng payload", async () => {
    const api = fakeApi();
    await boot();
    (rows()[1].querySelector("button") as HTMLButtonElement).click();
    await flush();

    expect(el("reports-restrict-block").hidden).toBe(false);
    expect(el("reports-restrict-uid").textContent).toContain("user_bob");

    el<HTMLInputElement>("reports-restrict-ai").checked = true;
    el<HTMLTextAreaElement>("reports-restrict-note").value = "Tạm khóa AI.";
    el("reports-restrict-save").click();
    await flush();

    const post = api.calls.find(
      (call) =>
        call.url === "/api/admin/users/user_bob/restrictions" &&
        call.init?.method === "POST",
    );
    expect(post).toBeTruthy();
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({
      aiDisabled: true,
      roomsDisabled: false,
      note: "Tạm khóa AI.",
    });
  });
});
