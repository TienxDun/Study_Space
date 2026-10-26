import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { SystemBanner } from "@/components/study/SystemBanner";
import { ChatFab } from "@/components/study/chat/components/ChatFab";
import { StudyLeftDock } from "@/components/study/StudyLeftDock";
import type { SystemFlags } from "@/lib/system-flags";

const DEFAULT_FLAGS: SystemFlags = {
  chatEnabled: true,
  roomsEnabled: true,
  maintenance: false,
  banner: "",
};

const noop = () => {};

async function loadModule(url = "https://chat.example.com") {
  vi.stubEnv("NEXT_PUBLIC_CHAT_API_URL", url);
  vi.resetModules();
  return await import("@/lib/system-flags");
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("fetchSystemFlags", () => {
  it("không có địa chỉ chat thì trả mặc định bật và không gọi mạng", async () => {
    const mod = await loadModule("");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    await expect(mod.fetchSystemFlags()).resolves.toEqual(mod.SYSTEM_FLAGS_DEFAULT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lỗi mạng thì trả mặc định bật", async () => {
    const mod = await loadModule();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(mod.fetchSystemFlags()).resolves.toEqual(mod.SYSTEM_FLAGS_DEFAULT);
  });

  it("đọc đúng payload /config và cache trong 60 giây", async () => {
    const mod = await loadModule();
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          chatEnabled: false,
          roomsEnabled: false,
          maintenance: true,
          banner: "Thử bảo trì",
          updatedAt: 123,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchSpy);

    const first = await mod.fetchSystemFlags();
    expect(first).toEqual({
      chatEnabled: false,
      roomsEnabled: false,
      maintenance: true,
      banner: "Thử bảo trì",
    });
    expect(String(fetchSpy.mock.calls[0][0])).toBe("https://chat.example.com/config");

    await mod.fetchSystemFlags();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("lỗi HTTP không được cache: lần sau gọi lại và phục hồi", async () => {
    const mod = await loadModule();
    const fetchSpy = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ chatEnabled: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    await expect(mod.fetchSystemFlags()).resolves.toEqual(mod.SYSTEM_FLAGS_DEFAULT);
    const recovered = await mod.fetchSystemFlags();
    expect(recovered.chatEnabled).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    mod.resetSystemFlagsCache();
    await mod.fetchSystemFlags();
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });
});

describe("parseSystemFlags", () => {
  it("giữ trường hợp lệ, bỏ ký tự điều khiển và cắt banner 140 ký tự", async () => {
    const mod = await loadModule("");
    const parsed = mod.parseSystemFlags({
      chatEnabled: false,
      roomsEnabled: "không phải boolean",
      maintenance: true,
      banner: `  ${"a".repeat(150)}\u0007  `,
      ignored: 1,
    });

    expect(parsed.chatEnabled).toBe(false);
    expect(parsed.roomsEnabled).toBe(true);
    expect(parsed.maintenance).toBe(true);
    expect(parsed.banner).toHaveLength(140);
  });

  it("dữ liệu không phải object thì trả mặc định", async () => {
    const mod = await loadModule("");
    expect(mod.parseSystemFlags(null)).toEqual(mod.SYSTEM_FLAGS_DEFAULT);
    expect(mod.parseSystemFlags("hỏng")).toEqual(mod.SYSTEM_FLAGS_DEFAULT);
  });
});

describe("resolveBannerText", () => {
  it("banner có nội dung thì hiện đúng nội dung", async () => {
    const mod = await loadModule("");
    expect(mod.resolveBannerText({ ...DEFAULT_FLAGS, banner: "  Bảo trì tối nay  " })).toBe(
      "Bảo trì tối nay"
    );
  });

  it("chỉ bật bảo trì thì dùng câu mặc định", async () => {
    const mod = await loadModule("");
    expect(mod.resolveBannerText({ ...DEFAULT_FLAGS, maintenance: true })).toContain("bảo trì");
  });

  it("không bảo trì và banner rỗng thì không hiện", async () => {
    const mod = await loadModule("");
    expect(mod.resolveBannerText(DEFAULT_FLAGS)).toBeNull();
  });
});

describe("giao diện đọc cờ", () => {
  it("banner render text thuần, không chèn HTML", () => {
    const html = renderToString(
      <SystemBanner flags={{ ...DEFAULT_FLAGS, banner: "<b>Bảo trì</b>" }} />
    );

    expect(html).toContain("&lt;b&gt;Bảo trì&lt;/b&gt;");
    expect(html).not.toContain("<b>Bảo trì</b>");
  });

  it("banner ẩn khi không có nội dung", () => {
    expect(renderToString(<SystemBanner flags={DEFAULT_FLAGS} />)).toBe("");
  });

  it("nút chat hiện Tạm tắt và bị disable", () => {
    const html = renderToString(<ChatFab hasNew onOpen={noop} disabled />);

    expect(html).toContain('id="tour-chat-fab"');
    expect(html).toMatch(/id="tour-chat-fab"[^>]*disabled/);
    expect(html).toContain("Tạm tắt");
    expect(html).not.toContain("Hỏi trợ lý");
  });

  it("dock phòng học bị disable khi cờ tắt", () => {
    const html = renderToString(
      <StudyLeftDock
        isZenMode={false}
        isPomodoroVisible={false}
        isTasksOpen={false}
        isNotesOpen={false}
        isScenesOpen={false}
        isEmbedPlayerOpen={false}
        isExternalStreamActive={false}
        isRoomsOpen={false}
        roomsEnabled={false}
        onTogglePomodoro={noop}
        onToggleTasks={noop}
        onToggleNotes={noop}
        onToggleScenes={noop}
        onToggleEmbed={noop}
        onToggleRooms={noop}
      />
    );

    expect(html).toMatch(/id="tour-dock-rooms"[^>]*disabled/);
    expect(html).toContain("Phòng học nhóm (Tạm tắt)");
  });
});
