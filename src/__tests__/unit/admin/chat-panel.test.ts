// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Call = { url: string; method: string; body?: Record<string, unknown> };

const html = readFileSync(path.resolve(process.cwd(), "admin-host/index.html"), "utf8");
const bodyHtml = html
  .slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/g, "");
const script = readFileSync(path.resolve(process.cwd(), "admin-host/admin.js"), "utf8");

function raw(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    current: "qwen3-30b",
    available: [
      { key: "qwen3-30b", label: "Qwen3 30B" },
      { key: "llama-4", label: "Llama 4" },
    ],
    chain: [{ provider: "cf", modelId: "qwen3-30b" }],
    maxChain: 5,
    providers: [
      {
        id: "groq-1",
        type: "groq",
        label: "Groq chính",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: "***abcd",
        enabled: true,
      },
    ],
    presets: {
      groq: { label: "Groq", baseUrl: "https://api.groq.com/openai/v1" },
      openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
      custom: { label: "Tự nhập địa chỉ", baseUrl: "" },
    },
    prompt: "Bạn là trợ lý học tập.",
    gen: { temperature: 0.7, max_tokens: 1200 },
    ...overrides,
  };
}

async function flush() {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
}

function boot(
  config: Record<string, unknown> = baseConfig(),
  options: { status?: number; error?: string } = {},
) {
  document.body.innerHTML = bodyHtml;
  const calls: Call[] = [];

  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = String(init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });

    if (url.includes("/api/admin/overview")) {
      return Promise.resolve(
        raw({
          health: { checks: [] },
          flags: { ok: false, error: "missing_binding" },
          errors: {},
        }),
      );
    }
    if (url.endsWith("/api/admin/chat/config") && method === "GET") {
      const status = options.status ?? 200;
      if (status !== 200) {
        return Promise.resolve(raw({ error: options.error || "chat_proxy_unreachable" }, status));
      }
      return Promise.resolve(raw({ ok: true, config }));
    }
    if (url.endsWith("/api/admin/chat/config") && method === "POST") {
      return Promise.resolve(raw({ ok: true }));
    }
    if (url.endsWith("/api/admin/chat/check-key")) {
      return Promise.resolve(
        raw({
          ok: true,
          count: 2,
          models: [{ id: "llama-3.3-70b", kind: "chat" }, { id: "mixtral", kind: "chat" }],
        }),
      );
    }
    if (url.includes("/api/admin/chat/provider-models")) {
      return Promise.resolve(
        raw({
          ok: true,
          models: [{ id: "llama-3.3-70b", kind: "chat" }, { id: "mixtral", kind: "chat" }],
        }),
      );
    }
    if (url.endsWith("/api/admin/chat/test")) {
      return Promise.resolve(
        raw({ ok: true, text: "Chào bạn!", provider: "cf", model: "qwen3-30b", ms: 420 }),
      );
    }
    return Promise.resolve(raw({ ok: true }));
  });

  vi.stubGlobal("fetch", fetchMock);
  const confirmMock = vi.fn(() => true);
  (window as unknown as { confirm: () => boolean }).confirm = confirmMock;
  // Chạy đúng script shell thật để test chính hành vi sẽ deploy.
  (0, eval)(script);

  return { calls, confirm: confirmMock, fetchMock };
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error("Thiếu #" + id);
  return found as T;
}

function setValue(
  id: string,
  value: string,
  event: "input" | "change" = "input",
) {
  const node = el<HTMLInputElement>(id);
  node.value = value;
  node.dispatchEvent(new Event(event, { bubbles: true }));
}

function findButton(root: ParentNode, label: string): HTMLButtonElement {
  const found = Array.from(root.querySelectorAll("button")).find(
    (button) => button.textContent === label,
  );
  if (!found) throw new Error("Không thấy nút " + label);
  return found as HTMLButtonElement;
}

function postBodies(calls: Call[]) {
  return calls.filter((call) => call.method === "POST").map((call) => call.body);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("panel Trợ lý chat", () => {
  it("hiển thị cấu hình đọc được và khóa nút lưu", async () => {
    boot();
    await flush();

    const select = el<HTMLSelectElement>("chat-model");
    expect(select.options).toHaveLength(2);
    expect(select.value).toBe("qwen3-30b");
    expect(el("chat-model-current").textContent).toBe("qwen3-30b");
    expect(el<HTMLInputElement>("chat-temp").value).toBe("0.7");
    expect(el<HTMLInputElement>("chat-tokens").value).toBe("1200");
    expect(el("chat-cfg-state").textContent).toBe("Đang dùng cấu hình đã lưu");
    expect(el<HTMLTextAreaElement>("chat-prompt").value).toBe("Bạn là trợ lý học tập.");
    expect(el("chat-prompt-count").textContent).toBe("22");
    expect(document.querySelectorAll("#chat-chain .chat-chain-row")).toHaveLength(1);
    expect(document.querySelectorAll("#chat-providers .chat-provider-row")).toHaveLength(1);
    expect(el<HTMLButtonElement>("chat-model-save").disabled).toBe(true);
    expect(el<HTMLButtonElement>("chat-chain-save").disabled).toBe(true);
    expect(el<HTMLButtonElement>("chat-prompt-save").disabled).toBe(true);
    expect(el<HTMLButtonElement>("chat-provider-save").disabled).toBe(true);
    expect(el<HTMLSelectElement>("chat-model").disabled).toBe(false);
  });

  it("đổi model gửi đúng kind model", async () => {
    const { calls, confirm } = boot();
    await flush();

    setValue("chat-model", "llama-4", "change");
    expect(el<HTMLButtonElement>("chat-model-save").disabled).toBe(false);
    el<HTMLButtonElement>("chat-model-save").click();
    await flush();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(postBodies(calls)).toEqual([{ kind: "model", cfModel: "llama-4" }]);
  });

  it("đổi temperature và max tokens gửi kind gen", async () => {
    const { calls } = boot();
    await flush();

    setValue("chat-temp", "1.1");
    setValue("chat-tokens", "1600");
    el<HTMLButtonElement>("chat-model-save").click();
    await flush();

    expect(postBodies(calls)).toEqual([
      { kind: "gen", temperature: 1.1, max_tokens: 1600 },
    ]);
  });

  it("đổi cả model và gen thì gửi hai lần theo thứ tự", async () => {
    const { calls } = boot();
    await flush();

    setValue("chat-model", "llama-4", "change");
    setValue("chat-temp", "1.1");
    el<HTMLButtonElement>("chat-model-save").click();
    await flush();

    expect(postBodies(calls)).toEqual([
      { kind: "model", cfModel: "llama-4" },
      { kind: "gen", temperature: 1.1, max_tokens: 1200 },
    ]);
  });

  it("temperature ngoài khoảng 0–2 thì không cho lưu", async () => {
    const { calls } = boot();
    await flush();

    setValue("chat-temp", "3");
    expect(el<HTMLButtonElement>("chat-model-save").disabled).toBe(true);
    el<HTMLButtonElement>("chat-model-save").click();
    await flush();

    expect(postBodies(calls)).toEqual([]);
  });

  it("thêm và đổi thứ tự bước rồi lưu chain", async () => {
    const { calls } = boot();
    await flush();

    el<HTMLButtonElement>("chat-chain-add").click();
    await flush();
    expect(document.querySelectorAll("#chat-chain .chat-chain-row")).toHaveLength(2);

    const secondRow = document.querySelectorAll("#chat-chain .chat-chain-row")[1];
    const providerSelect = secondRow.querySelector(
      ".chat-chain-provider",
    ) as HTMLSelectElement;
    providerSelect.value = "cf";
    providerSelect.dispatchEvent(new Event("change", { bubbles: true }));
    const secondInput = secondRow.querySelector(".chat-chain-model") as HTMLInputElement;
    secondInput.value = "llama-4";
    secondInput.dispatchEvent(new Event("input", { bubbles: true }));
    findButton(secondRow, "↑").click();
    await flush();

    const modelInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("#chat-chain .chat-chain-model"),
    );
    expect(modelInputs.map((input) => input.value)).toEqual(["llama-4", "qwen3-30b"]);

    el<HTMLButtonElement>("chat-chain-save").click();
    await flush();
    expect(postBodies(calls)).toEqual([
      {
        kind: "chain",
        chain: [
          { provider: "cf", modelId: "llama-4" },
          { provider: "cf", modelId: "qwen3-30b" },
        ],
      },
    ]);
  });

  it("xóa bớt bước rồi lưu chain", async () => {
    const { calls } = boot(
      baseConfig({
        chain: [
          { provider: "cf", modelId: "qwen3-30b" },
          { provider: "cf", modelId: "llama-4" },
        ],
      }),
    );
    await flush();

    const firstRow = document.querySelector("#chat-chain .chat-chain-row");
    if (!firstRow) throw new Error("Thiếu bước đầu");
    findButton(firstRow, "✕").click();
    await flush();
    expect(document.querySelectorAll("#chat-chain .chat-chain-row")).toHaveLength(1);

    el<HTMLButtonElement>("chat-chain-save").click();
    await flush();
    expect(postBodies(calls)).toEqual([
      { kind: "chain", chain: [{ provider: "cf", modelId: "llama-4" }] },
    ]);
  });

  it("lưu câu lệnh hệ thống và cập nhật bộ đếm", async () => {
    const { calls } = boot();
    await flush();

    setValue("chat-prompt", "Mới ngắn hơn.");
    expect(el("chat-prompt-count").textContent).toBe("13");
    el<HTMLButtonElement>("chat-prompt-save").click();
    await flush();

    expect(postBodies(calls)).toEqual([{ kind: "prompt", prompt: "Mới ngắn hơn." }]);
  });

  it("câu lệnh rỗng bị chặn tại chỗ", async () => {
    const { calls } = boot();
    await flush();

    setValue("chat-prompt", "   ");
    el<HTMLButtonElement>("chat-prompt-save").click();
    await flush();

    expect(postBodies(calls)).toEqual([]);
    expect(el("chat-prompt-note").textContent).toContain("không được để trống");
  });

  it("thêm nhà cung cấp mới rồi lưu cả danh sách", async () => {
    const { calls } = boot();
    await flush();

    setValue("chat-provider-id", "openai-1");
    setValue("chat-provider-type", "openai", "change");
    expect(el<HTMLInputElement>("chat-provider-url").value).toBe(
      "https://api.openai.com/v1",
    );
    setValue("chat-provider-label", "OpenAI chính");
    setValue("chat-provider-key", "sk-test-123");

    expect(el<HTMLButtonElement>("chat-provider-apply").disabled).toBe(false);
    el<HTMLButtonElement>("chat-provider-apply").click();
    await flush();

    expect(document.querySelectorAll("#chat-providers .chat-provider-row")).toHaveLength(2);
    expect(el<HTMLButtonElement>("chat-provider-save").disabled).toBe(false);

    el<HTMLButtonElement>("chat-provider-save").click();
    await flush();

    expect(postBodies(calls)).toEqual([
      {
        kind: "providers",
        providers: [
          {
            id: "groq-1",
            type: "groq",
            label: "Groq chính",
            baseUrl: "https://api.groq.com/openai/v1",
            apiKey: "***abcd",
            enabled: true,
          },
          {
            id: "openai-1",
            type: "openai",
            label: "OpenAI chính",
            baseUrl: "https://api.openai.com/v1",
            apiKey: "sk-test-123",
            enabled: true,
          },
        ],
      },
    ]);
    expect(document.body.textContent).not.toContain("sk-test-123");
  });

  it("kiểm tra key hiện số model nhưng chưa lưu", async () => {
    const { calls } = boot();
    await flush();

    setValue("chat-provider-id", "openai-2");
    setValue("chat-provider-type", "openai", "change");
    setValue("chat-provider-key", "sk-check");
    el<HTMLButtonElement>("chat-provider-check").click();
    await flush();

    const checkCall = calls.find((call) => call.url.endsWith("/check-key"));
    expect(checkCall?.body).toMatchObject({ baseUrl: "https://api.openai.com/v1", apiKey: "sk-check" });
    expect(el("chat-provider-check-result").hidden).toBe(false);
    expect(el("chat-provider-check-result").textContent).toContain("2 model");
    expect(
      calls.filter(
        (call) => call.method === "POST" && call.url.endsWith("/chat/config"),
      ),
    ).toEqual([]);
    expect(document.querySelectorAll("#chat-providers .chat-provider-row")).toHaveLength(1);
  });

  it("xem model của nhà cung cấp đã lưu", async () => {
    boot();
    await flush();

    const row = document.querySelector("#chat-providers .chat-provider-row");
    if (!row) throw new Error("Thiếu nhà cung cấp");
    findButton(row, "Xem model").click();
    await flush();

    expect(row.textContent).toContain("Model: llama-3.3-70b, mixtral");
    const options = Array.from(
      document.querySelectorAll<HTMLOptionElement>("#chat-chain-models option"),
    ).map((option) => option.value);
    expect(options).toContain("llama-3.3-70b");
    expect(options).toContain("mixtral");
    expect(options).not.toContain("[object Object]");
  });

  it("không xóa nhà cung cấp đang nằm trong thứ tự dự phòng", async () => {
    boot(
      baseConfig({ chain: [{ provider: "groq-1", modelId: "llama-3.3-70b" }] }),
    );
    await flush();

    const row = document.querySelector("#chat-providers .chat-provider-row");
    if (!row) throw new Error("Thiếu nhà cung cấp");
    findButton(row, "Xóa").click();
    await flush();

    expect(document.querySelectorAll("#chat-providers .chat-provider-row")).toHaveLength(1);
    expect(el("chat-provider-note").textContent).toContain("Bỏ bước");
  });

  it("thử trả lời hiện nội dung và thời gian", async () => {
    const { calls } = boot();
    await flush();

    el<HTMLButtonElement>("chat-test-model").click();
    await flush();

    const testCall = calls.find((call) => call.url.endsWith("/chat/test"));
    expect(testCall?.body).toEqual({ provider: "cf", modelId: "qwen3-30b" });
    expect(el("chat-test-result").hidden).toBe(false);
    expect(el("chat-test-result").textContent).toContain("Chào bạn!");
    expect(el("chat-test-result").textContent).toContain("420 ms");
  });

  it("chat-proxy lỗi thì khóa panel và báo đúng lý do", async () => {
    boot(baseConfig(), { status: 502, error: "chat_proxy_unreachable" });
    await flush();

    expect(el("chat-cfg-card").classList.contains("is-degraded")).toBe(true);
    expect(el("chat-cfg-state").textContent).toBe("Không đọc được");
    expect(el("chat-model-note").textContent).toContain("không kết nối được chat-proxy");
    expect(el<HTMLSelectElement>("chat-model").disabled).toBe(true);
    expect(el<HTMLButtonElement>("chat-provider-save").disabled).toBe(true);
  });
});
