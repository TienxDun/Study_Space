// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadAdminHtml } from "./load-admin-html";

const html = loadAdminHtml();
// Bỏ thẻ script: bài test tự import tabs.js, không để happy-dom tải file.
const bodyHtml = html
  .slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/gi, "");
const tabsScript = readFileSync(resolve(__dirname, "../../../../admin-host/scripts/tabs.js"), "utf8");

function boot(hash?: string) {
  document.body.innerHTML = bodyHtml;
  if (hash) window.location.hash = hash;
  new Function(tabsScript)();
}

function el<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function visible(id: string) {
  return el(id).hidden === false;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/admin/");
});

afterEach(() => {
  document.body.innerHTML = "";
  window.history.replaceState(null, "", "/admin/");
});

describe("tab quản trị", () => {
  it("mặc định mở Tổng quan và ẩn các tab còn lại", () => {
    boot();

    expect(el("tab-btn-overview").classList.contains("is-active")).toBe(true);
    expect(el("tab-btn-overview").getAttribute("aria-selected")).toBe("true");
    expect(visible("tab-panel-overview")).toBe(true);
    ["diagnostics", "flags", "chat", "content", "reports", "feedback", "users"].forEach((name) => {
      expect(el("tab-btn-" + name).getAttribute("aria-selected")).toBe("false");
      expect(visible("tab-panel-" + name)).toBe(false);
    });
    expect(document.title).toContain("Tổng quan");
  });

  it("mở thẳng tab từ hash khi tải trang", () => {
    boot("#content");

    expect(el("tab-btn-content").getAttribute("aria-selected")).toBe("true");
    expect(visible("tab-panel-content")).toBe(true);
    expect(visible("tab-panel-overview")).toBe(false);
  });

  it("bấm tab thì đổi panel, ghi hash và đổi tiêu đề", () => {
    boot();

    el<HTMLButtonElement>("tab-btn-chat").click();

    expect(visible("tab-panel-chat")).toBe(true);
    expect(visible("tab-panel-overview")).toBe(false);
    expect(el("tab-btn-chat").getAttribute("aria-selected")).toBe("true");
    expect(el("tab-btn-chat").getAttribute("tabindex")).toBe("0");
    expect(el("tab-btn-overview").getAttribute("tabindex")).toBe("-1");
    expect(window.location.hash).toBe("#chat");
    expect(document.title).toContain("Trợ lý chat");
  });

  it("phím mũi tên chuyển tab và vòng lại hai đầu", () => {
    boot();

    const overview = el<HTMLButtonElement>("tab-btn-overview");
    overview.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    expect(visible("tab-panel-diagnostics")).toBe(true);

    el<HTMLButtonElement>("tab-btn-diagnostics").dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
    );
    expect(visible("tab-panel-overview")).toBe(true);

    overview.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    expect(visible("tab-panel-users")).toBe(true);
  });

  it("tiêu đề lớn và phụ đề đổi theo tab đang mở", () => {
    boot("#reports");
    expect(el("page-title").textContent).toBe("Báo cáo vi phạm");
    expect(el("page-subtitle").textContent).toContain("phản ánh");

    el<HTMLButtonElement>("tab-btn-content").click();
    expect(el("page-title").textContent).toBe("Kho nội dung");
    expect(el("page-subtitle").textContent).toContain("hoàn tác");
  });

  it("tiêu đề tab bỏ qua badge số mục chờ", () => {
    boot();
    el("tab-badge-feedback").textContent = "7";
    el<HTMLButtonElement>("tab-btn-feedback").click();
    expect(document.title).toBe("ZenStudy · Phản hồi · Bảng điều khiển hệ thống");
  });
});
