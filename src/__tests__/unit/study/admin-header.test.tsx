import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { AdminHeader } from "@/components/admin/AdminHeader";

describe("AdminHeader Component", () => {
  it("renders all navigation tabs and back link", () => {
    const html = renderToString(
      React.createElement(AdminHeader, {
        activeTab: "limits",
        title: "Bảng Hạn Mức",
      })
    );

    expect(html).toContain("Hạn Mức Hệ Thống");
    expect(html).toContain("Quản Lý Chatbot");
    expect(html).toContain("Studio Bối Cảnh");
    expect(html).toContain("Xem Trước Toasts");
    expect(html).toContain("Về Trang Học");
    expect(html).toContain('href="/"');
  });

  it("applies active styles to the selected tab", () => {
    const html = renderToString(
      React.createElement(AdminHeader, {
        activeTab: "scenes",
      })
    );

    expect(html).toContain("Studio Bối Cảnh");
    expect(html).toContain("text-emerald-300");
  });

  it("renders optional title and description correctly", () => {
    const html = renderToString(
      React.createElement(AdminHeader, {
        activeTab: "toasts",
        title: "Xem Trước Thông Báo",
        description: "Mô tả kiểm thử cho trang toasts",
      })
    );

    expect(html).toContain("Xem Trước Thông Báo");
    expect(html).toContain("Mô tả kiểm thử cho trang toasts");
  });
});
