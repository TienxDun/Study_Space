// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { StudyTopBar } from "@/components/study/StudyTopBar";

// @ts-expect-error test act flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const FEEDBACK_LABEL = "Mở hộp gửi góp ý hoặc báo lỗi";
const MORE_LABEL = "Mở menu thông tin và trợ giúp";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderTopBar(onOpenFeedback?: () => void) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <StudyTopBar
        isZenMode={false}
        isGlobalMuted={false}
        isSettingsOpen={false}
        isFullscreen={false}
        onToggleShortcuts={() => {}}
        onEnterZen={() => {}}
        onExitZen={() => {}}
        onToggleMute={() => {}}
        onToggleSettings={() => {}}
        onToggleFullscreen={() => {}}
        onOpenFeedback={onOpenFeedback}
      />
    );
  });
  return container;
}

/** Bấm nút ⋯ để bung menu "Thông tin & trợ giúp". */
function openMoreMenu(host: HTMLElement) {
  const trigger = host.querySelector<HTMLButtonElement>(`[aria-label="${MORE_LABEL}"]`);
  expect(trigger).not.toBeNull();
  act(() => trigger?.click());
  return trigger;
}

describe("StudyTopBar menu thông tin & trợ giúp", () => {
  it("thanh chính chỉ còn nút có trạng thái, các mục phụ nằm trong menu ⋯", () => {
    const host = renderTopBar(vi.fn());

    expect(host.querySelector(`[aria-label="Thống kê thời gian tập trung"]`)).toBeNull();
    expect(host.querySelector(`[aria-label="Bảng tra cứu phím tắt"]`)).toBeNull();
    expect(host.querySelector(`[aria-label="${FEEDBACK_LABEL}"]`)).toBeNull();

    openMoreMenu(host);
    expect(host.querySelector(`[aria-label="Thống kê thời gian tập trung"]`)).not.toBeNull();
    expect(host.querySelector(`[aria-label="Bảng tra cứu phím tắt"]`)).not.toBeNull();
    expect(host.querySelector(`[aria-label="Mở giới thiệu website"]`)).not.toBeNull();
  });

  it("gọi onOpenFeedback khi bấm mục góp ý trong menu", () => {
    const onOpenFeedback = vi.fn();
    const host = renderTopBar(onOpenFeedback);
    openMoreMenu(host);

    const item = host.querySelector<HTMLButtonElement>(`[aria-label="${FEEDBACK_LABEL}"]`);
    expect(item).not.toBeNull();
    expect(item?.querySelector("svg")).not.toBeNull();

    act(() => item?.click());
    expect(onOpenFeedback).toHaveBeenCalledTimes(1);
  });

  it("không hiện mục góp ý khi không truyền onOpenFeedback", () => {
    const host = renderTopBar();
    openMoreMenu(host);
    expect(host.querySelector(`[aria-label="${FEEDBACK_LABEL}"]`)).toBeNull();
  });
});
