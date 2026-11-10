// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function loadProdLogger() {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", "production");
  return import("@/lib/logger");
}

function errorSummary(): unknown {
  return vi.mocked(console.error).mock.calls[0]?.[1];
}

describe("logger ở production", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("không bật cờ thì devWarn im lặng, logError chỉ in bản tóm tắt", async () => {
    const { devWarn, logError } = await loadProdLogger();
    const err = Object.assign(new Error("Missing or insufficient permissions."), {
      code: "permission-denied",
    });

    devWarn("chi tiết nội bộ", { uid: "uid-123" });
    logError("Chat:onSnapshot", err);

    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "[Chat:onSnapshot]",
      "Error · permission-denied · Missing or insufficient permissions."
    );
  });

  it("cờ zs:debug trong sessionStorage cho phép in log thô trong tab hiện tại", async () => {
    sessionStorage.setItem("zs:debug", "1");
    const { devWarn, logError } = await loadProdLogger();
    const err = { code: "permission-denied", uid: "uid-123" };

    devWarn("chi tiết nội bộ", err);
    logError("Chat:onSnapshot", err);

    expect(console.warn).toHaveBeenCalledWith("chi tiết nội bộ", err);
    expect(console.error).toHaveBeenCalledWith("[Chat:onSnapshot]", err);
  });

  it("bỏ qua cờ cũ nằm trong localStorage để không sót quyền in log thô", async () => {
    localStorage.setItem("zs:debug", "1");
    const { devWarn } = await loadProdLogger();

    devWarn("chi tiết nội bộ");

    expect(console.warn).not.toHaveBeenCalled();
  });

  it("lọc token, email, UID và đường dẫn document khỏi bản tóm tắt", async () => {
    const { logError } = await loadProdLogger();
    const err = new Error(
      "Fetch https://api.zenstudy.space/cb?access_token=secret-value&state=xyz failed for ban@example.com at projects/demo/databases/(default)/documents/user_data/AbCdEfGhIjKlMnOpQrStUvWxYz12"
    );

    logError("Sync", err);

    const summary = errorSummary();
    expect(summary).toContain("access_token=<redacted>&state=xyz");
    expect(summary).toContain("<email>");
    expect(summary).not.toContain("ban@example.com");
    expect(summary).toContain("documents/user_data/<id>");
    expect(summary).not.toContain("AbCdEfGhIjKlMnOpQrStUvWxYz12");
  });

  it("lọc Bearer và JWT", async () => {
    const { logError } = await loadProdLogger();
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";

    logError("Auth", `Authorization: Bearer ${jwt} rejected`);

    expect(errorSummary()).toBe("Authorization: Bearer <redacted> rejected");
  });

  it("giữ giới hạn 300 ký tự sau khi lọc", async () => {
    const { logError } = await loadProdLogger();

    logError("Long", "x".repeat(400));

    expect((errorSummary() as string).length).toBe(300);
  });
});
