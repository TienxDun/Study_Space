// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminHtml } from "./load-admin-html";

type Call = { url: string; method: string; body?: Record<string, unknown> };

const html = loadAdminHtml();
const bodyHtml = html
  .slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/g, "");
const chatScript = readFileSync(path.resolve(process.cwd(), "admin-host/scripts/chat.js"), "utf8");
const shellScript = readFileSync(path.resolve(process.cwd(), "admin-host/scripts/dashboard.js"), "utf8");

const GROQ_MODELS: Record<string, { id: string; kind: string }[]> = {
  "groq-1": [
    { id: "llama-3.3-70b", kind: "chat" },
    { id: "mixtral", kind: "chat" },
  ],
  "openrouter-1": [
    { id: "zeta-ai/glm-5", kind: "chat" },
    { id: "mistralai/mistral-large", kind: "chat" },
  ],
};

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
    chain: [{ provider: "groq-1", modelId: "llama-3.3-70b" }],
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
      openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
      openai: { label: "OpenAI", baseUrl: "https://api.openai.com/v1" },
      custom: { label: "Tự nhập địa chỉ", baseUrl: "" },
    },
    prompt: "Bạn là trợ lý học tập.",
    gen: { temperature: 0.7, max_tokens: 1200 },
    ...overrides,
  };
}

async function flush() {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

function boot(
  config: Record<string, unknown> = baseConfig(),
  options: { status?: number; error?: string; failModels?: Record<string, number> } = {},
) {
  document.body.innerHTML = bodyHtml;
  const calls: Call[] = [];
  const failures: Record<string, number> = { ...(options.failModels || {}) };

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
          models: [{ id: "llama-3.3-70b" }, { id: "mixtral" }],
        }),
      );
    }
    if (url.includes("/api/admin/chat/provider-models")) {
      const matched = /[?&]id=([^&]+)/.exec(url);
      const id = matched ? decodeURIComponent(matched[1]) : "";
      if (failures[id] > 0) {
        failures[id] -= 1;
        return Promise.resolve(raw({ error: "chat_proxy_unreachable" }, 502));
      }
      return Promise.resolve(raw({ ok: true, models: GROQ_MODELS[id] || [] }));
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
  // Chạy đúng hai script sẽ deploy, theo thứ tự trong index.html.
  (0, eval)(chatScript);
  (0, eval)(shellScript);

  return { calls, confirm: confirmMock, fetchMock, failures };
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error("Thiếu #" + id);
  return found as T;
}

function setValue(id: string, value: string, event: "input" | "change" = "input") {
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

function chainRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("#chat-chain .chat-step-row"));
}

function providerRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("#chat-providers .chat-provider-row"));
}

function modelValues(row: ParentNode): string[] {
  const select = row.querySelector(".chat-step-model") as HTMLSelectElement | null;
  if (!select) return [];
  return Array.from(select.options).map((option) => option.value);
}

function tryModelOptions(): string[] {
  const select = document.querySelector(
    "#chat-try-model .chat-try-model",
  ) as HTMLSelectElement | null;
  if (!select) return [];
  return Array.from(select.options).map((option) => option.value);
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
  it("hiển thị cấu hình, danh sách hãng và khối thử", async () => {
    const { calls } = boot();
    await flush();

    expect(el("chat-state").textContent).toBe("Đang dùng cấu hình đã lưu");
    expect(el<HTMLTextAreaElement>("chat-prompt").value).toBe("Bạn là trợ lý học tập.");
    expect(el("chat-prompt-count").textContent).toBe("22");

    const rows = chainRows();
    expect(rows).toHaveLength(1);
    expect(modelValues(rows[0])).toEqual(["llama-3.3-70b", "mixtral", "__custom__"]);
    expect(rows[0].textContent).toContain("Groq chính");

    expect(providerRows()).toHaveLength(1);
    expect(providerRows()[0].textContent).toContain("2 model đã tải");
    expect(providerRows()[0].textContent).toContain("đã có key");
    expect(document.body.textContent).not.toContain("Xem model");
    expect(
      calls.some(
        (call) => call.url.includes("/provider-models") && call.url.includes("id=groq-1"),
      ),
    ).toBe(true);

    const providerSelect = el<HTMLSelectElement>("chat-try-provider");
    expect(Array.from(providerSelect.options).map((option) => option.value)).toEqual([
      "cf",
      "groq-1",
    ]);
    expect(providerSelect.value).toBe("cf");
    expect(tryModelOptions()).toEqual(["qwen3-30b", "llama-4"]);

    expect(el<HTMLButtonElement>("chat-chain-save").disabled).toBe(true);
    expect(el<HTMLButtonElement>("chat-prompt-save").disabled).toBe(true);
    expect(el<HTMLButtonElement>("chat-provider-save").disabled).toBe(true);
    expect(document.getElementById("chat-model-save")).toBeNull();
    expect(document.body.textContent).not.toContain("Lưu model");
  });

  it("mỗi bước chỉ thấy model của hãng mình", async () => {
    boot(
      baseConfig({
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
            id: "openrouter-1",
            type: "openrouter",
            label: "OpenRouter",
            baseUrl: "https://openrouter.ai/api/v1",
            apiKey: "***wxyz",
            enabled: true,
          },
        ],
        chain: [
          { provider: "groq-1", modelId: "llama-3.3-70b" },
          { provider: "openrouter-1", modelId: "zeta-ai/glm-5" },
        ],
      }),
    );
    await flush();

    const rows = chainRows();
    expect(rows).toHaveLength(2);
    expect(modelValues(rows[0])).toEqual(["llama-3.3-70b", "mixtral", "__custom__"]);
    expect(modelValues(rows[1])).toEqual([
      "zeta-ai/glm-5",
      "mistralai/mistral-large",
      "__custom__",
    ]);
  });

  it("đổi model Cloudflare trong khối thử thì gửi đúng model đó", async () => {
    const { calls } = boot();
    await flush();

    const select = document.querySelector(
      "#chat-try-model .chat-try-model",
    ) as HTMLSelectElement;
    select.value = "llama-4";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    el<HTMLButtonElement>("chat-try-run").click();
    await flush();

    const testCall = calls.find((call) => call.url.endsWith("/chat/test"));
    expect(testCall?.body).toEqual({ provider: "cf", modelId: "llama-4" });
    expect(el("chat-try-result").textContent).toContain("Chào bạn!");
    expect(el("chat-try-result").textContent).toContain("Cloudflare:qwen3-30b");
    expect(el("chat-try-result").textContent).toContain("420 ms");
  });

  it("không còn ô độ sáng tạo và độ dài, không gửi kind gen", async () => {
    const { calls } = boot();
    await flush();

    expect(document.getElementById("chat-temp")).toBeNull();
    expect(document.getElementById("chat-tokens")).toBeNull();

    el<HTMLButtonElement>("chat-try-run").click();
    await flush();

    expect(
      postBodies(calls).some((body) => body?.kind === "gen"),
    ).toBe(false);
  });

  it("thêm bước, đổi hãng và đổi thứ tự rồi lưu", async () => {
    const { calls } = boot();
    await flush();

    el<HTMLButtonElement>("chat-chain-add").click();
    await flush();
    expect(chainRows()).toHaveLength(2);

    const secondRow = chainRows()[1];
    const providerSelect = secondRow.querySelector(
      ".chat-step-provider",
    ) as HTMLSelectElement;
    providerSelect.value = "cf";
    providerSelect.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    expect(chainRows()[1].querySelector(".chat-step-model")).toBeInstanceOf(
      HTMLSelectElement,
    );
    expect(modelValues(chainRows()[1])).toContain("qwen3-30b");

    findButton(chainRows()[1], "↑").click();
    await flush();
    expect(
      chainRows().map(
        (row) => (row.querySelector(".chat-step-provider") as HTMLSelectElement).value,
      ),
    ).toEqual(["cf", "groq-1"]);

    el<HTMLButtonElement>("chat-chain-save").click();
    await flush();
    expect(postBodies(calls)).toEqual([
      {
        kind: "chain",
        chain: [
          { provider: "cf", modelId: "qwen3-30b" },
          { provider: "groq-1", modelId: "llama-3.3-70b" },
        ],
      },
    ]);
  });

  it("chọn mã model khác thì chuyển sang ô nhập tay", async () => {
    const { calls } = boot();
    await flush();

    const select = chainRows()[0].querySelector(".chat-step-model") as HTMLSelectElement;
    select.value = "__custom__";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    const input = chainRows()[0].querySelector(
      ".chat-step-model-input",
    ) as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value = "groq/llama-4-scout";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    el<HTMLButtonElement>("chat-chain-save").click();
    await flush();

    expect(postBodies(calls)).toEqual([
      {
        kind: "chain",
        chain: [{ provider: "groq-1", modelId: "groq/llama-4-scout" }],
      },
    ]);
  });

  it("tải model lỗi thì cho nhập tay và bấm tải lại để thử", async () => {
    const { failures, calls } = boot(baseConfig(), { failModels: { "groq-1": 1 } });
    await flush();

    expect(chainRows()[0].querySelector(".chat-step-model-input")).toBeTruthy();
    expect(providerRows()[0].textContent).toContain("Không tải được model");
    expect(findButton(providerRows()[0], "Tải lại")).toBeTruthy();

    expect(failures["groq-1"]).toBe(0);
    findButton(chainRows()[0], "Tải lại").click();
    await flush();

    expect(failures["groq-1"]).toBe(0);
    expect(chainRows()[0].querySelector(".chat-step-model")).toBeInstanceOf(
      HTMLSelectElement,
    );
    expect(modelValues(chainRows()[0])).toEqual([
      "llama-3.3-70b",
      "mixtral",
      "__custom__",
    ]);
    expect(
      calls.filter((call) => call.url.includes("provider-models") && call.url.includes("groq-1")),
    ).toHaveLength(2);
  });

  it("xóa bớt bước rồi lưu thứ tự còn lại", async () => {
    const { calls } = boot(
      baseConfig({
        chain: [
          { provider: "groq-1", modelId: "llama-3.3-70b" },
          { provider: "cf", modelId: "llama-4" },
        ],
      }),
    );
    await flush();

    findButton(chainRows()[0], "✕").click();
    await flush();
    expect(chainRows()).toHaveLength(1);

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

  it("thêm nhà cung cấp rồi lưu cả danh sách, không lộ key", async () => {
    const { calls } = boot();
    await flush();

    el<HTMLButtonElement>("chat-provider-toggle").click();
    expect(el("chat-provider-form").hidden).toBe(false);

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

    expect(el("chat-provider-form").hidden).toBe(true);
    expect(providerRows()).toHaveLength(2);
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

    el<HTMLButtonElement>("chat-provider-toggle").click();
    setValue("chat-provider-id", "openai-2");
    setValue("chat-provider-type", "openai", "change");
    setValue("chat-provider-key", "sk-check");
    el<HTMLButtonElement>("chat-provider-check").click();
    await flush();

    const checkCall = calls.find((call) => call.url.endsWith("/check-key"));
    expect(checkCall?.body).toMatchObject({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-check",
    });
    expect(el("chat-provider-check-result").hidden).toBe(false);
    expect(el("chat-provider-check-result").textContent).toContain("2 model");
    expect(providerRows()).toHaveLength(1);
    expect(
      calls.filter(
        (call) => call.method === "POST" && call.url.endsWith("/chat/config"),
      ),
    ).toEqual([]);
  });

  it("không xóa nhà cung cấp đang nằm trong thứ tự dự phòng", async () => {
    boot();
    await flush();

    findButton(providerRows()[0], "Xóa").click();
    await flush();

    expect(providerRows()).toHaveLength(1);
    expect(el("chat-provider-save-note").textContent).toContain("Bỏ bước");
  });

  it("thử một bước trong thứ tự gửi đúng hãng và model", async () => {
    const { calls } = boot();
    await flush();

    findButton(chainRows()[0], "Thử").click();
    await flush();

    const testCall = calls.find((call) => call.url.endsWith("/chat/test"));
    expect(testCall?.body).toEqual({
      provider: "groq-1",
      modelId: "llama-3.3-70b",
    });
    expect(chainRows()[0].textContent).toContain("Chào bạn!");
  });

  it("khối thử liệt kê Cloudflare cùng hãng đã lưu", async () => {
    boot(
      baseConfig({
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
            id: "openrouter-1",
            type: "openrouter",
            label: "OpenRouter",
            baseUrl: "https://openrouter.ai/api/v1",
            apiKey: "***wxyz",
            enabled: true,
          },
        ],
      }),
    );
    await flush();

    expect(el("chat-try").hidden).toBe(false);
    const providerSelect = el<HTMLSelectElement>("chat-try-provider");
    expect(Array.from(providerSelect.options).map((option) => option.value)).toEqual([
      "cf",
      "groq-1",
      "openrouter-1",
    ]);
    expect(providerSelect.value).toBe("cf");
    expect(tryModelOptions()).toEqual(["qwen3-30b", "llama-4"]);

    setValue("chat-try-provider", "groq-1", "change");
    await flush();

    expect(tryModelOptions()).toEqual(["llama-3.3-70b", "mixtral", "__custom__"]);
    expect(el<HTMLButtonElement>("chat-try-run").disabled).toBe(false);
  });

  it("đổi hãng trong khối thử thì danh sách model đổi theo", async () => {
    boot(
      baseConfig({
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
            id: "openrouter-1",
            type: "openrouter",
            label: "OpenRouter",
            baseUrl: "https://openrouter.ai/api/v1",
            apiKey: "***wxyz",
            enabled: true,
          },
        ],
      }),
    );
    await flush();

    setValue("chat-try-provider", "openrouter-1", "change");
    await flush();

    const modelSelect = el("chat-try-model").querySelector(
      ".chat-try-model",
    ) as HTMLSelectElement;
    expect(Array.from(modelSelect.options).map((option) => option.value)).toEqual([
      "zeta-ai/glm-5",
      "mistralai/mistral-large",
      "__custom__",
    ]);
    expect(modelSelect.value).toBe("zeta-ai/glm-5");
  });

  it("thử model chỉ gọi test, không lưu cấu hình", async () => {
    const { calls } = boot();
    await flush();

    el<HTMLButtonElement>("chat-try-run").click();
    await flush();

    const testCall = calls.find((call) => call.url.endsWith("/chat/test"));
    expect(testCall?.body).toEqual({ provider: "cf", modelId: "qwen3-30b" });
    expect(el("chat-try-result").hidden).toBe(false);
    expect(el("chat-try-result").textContent).toContain("Chào bạn!");
    expect(el("chat-try-result").textContent).toContain("420 ms");
    expect(
      calls.filter((call) => call.method === "POST" && call.url.endsWith("/chat/config")),
    ).toEqual([]);
  });

  it("chưa có hãng ngoài vẫn thử được Cloudflare", async () => {
    boot(baseConfig({ providers: [], chain: [] }));
    await flush();

    expect(el("chat-try").hidden).toBe(false);
    expect(
      Array.from(el<HTMLSelectElement>("chat-try-provider").options).map(
        (option) => option.value,
      ),
    ).toEqual(["cf"]);
    expect(el<HTMLButtonElement>("chat-try-run").disabled).toBe(false);
  });

  it("chat-proxy lỗi thì khóa panel và báo đúng lý do", async () => {
    const { calls } = boot(baseConfig(), { status: 502, error: "chat_proxy_unreachable" });
    await flush();

    expect(el("chat-panel").classList.contains("is-degraded")).toBe(true);
    expect(el("chat-state").textContent).toBe("Không đọc được");
    expect(el("chat-model-note").textContent).toContain("không kết nối được chat-proxy");
    expect(el("chat-try").hidden).toBe(true);
    expect(el<HTMLButtonElement>("chat-provider-save").disabled).toBe(true);
    expect(el<HTMLButtonElement>("chat-provider-toggle").disabled).toBe(true);
    expect(
      calls.some((call) => call.url.includes("/provider-models")),
    ).toBe(false);
  });
});
