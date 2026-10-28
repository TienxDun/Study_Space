// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AMBIENT_SOUNDS,
  STUDY_SCENES,
  STUDY_TRACKS_BY_MOOD,
  applyCatalog,
  getCatalogMeta,
  loadCachedCatalog,
  parseCatalog,
  refreshCatalog,
  resetCatalog,
  saveCatalogCache,
  type ContentCatalog,
} from "@/lib/content-catalog";
import { STORAGE_KEYS } from "@/lib/storage-keys";

const sceneA = {
  id: "scene-a",
  name: "Cảnh A",
  category: "chill",
  type: "IMAGE" as const,
  mediaPath: "scenes/a.webp",
  thumbnailPath: "thumbnails/a.webp",
};

const sceneHidden = {
  id: "scene-hidden",
  name: "Cảnh ẩn",
  category: "chill",
  type: "IMAGE" as const,
  mediaPath: "scenes/hidden.webp",
  thumbnailPath: "thumbnails/hidden.webp",
  hidden: true,
};

const soundA = {
  id: "sound-a",
  name: "Mưa",
  icon: "CloudRain",
  category: "rain" as const,
  audioPath: "sounds/a.mp3",
};

const trackA = {
  id: "track-a",
  title: "Bài A",
  artist: "Ai",
  genre: "lofi",
  category: "lofi" as const,
  audioPath: "music/a.mp3",
  coverPath: "https://cdn.test/a.jpg",
};

function catalog(): ContentCatalog {
  return {
    scenes: [sceneA, sceneHidden],
    sounds: [soundA],
    tracks: { lofi: [trackA], jazz: [], relax: [] },
  };
}

function payload() {
  return {
    ok: true,
    version: 3,
    updatedAt: 1_760_000_000_000,
    scenes: [sceneA, sceneHidden],
    sounds: [soundA],
    tracks: { lofi: [trackA], jazz: [], relax: [] },
  };
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  localStorage.clear();
  resetCatalog();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("content-catalog — áp dụng và ẩn mục", () => {
  it("mục hidden không xuất hiện trong mảng UI", () => {
    applyCatalog(catalog());

    expect(STUDY_SCENES.map((scene) => scene.id)).toEqual(["scene-a"]);
    expect(AMBIENT_SOUNDS.map((sound) => sound.id)).toEqual(["sound-a"]);
    expect(STUDY_TRACKS_BY_MOOD.lofi.map((track) => track.id)).toEqual(["track-a"]);
  });

  it("resolveAssetUrl vẫn đúng sau khi thay catalog", () => {
    applyCatalog(catalog());
    const scene = STUDY_SCENES[0];
    expect(scene.bgUrl).toBe("/study/scenes/a.webp");
    expect(scene.thumbnailUrl).toBe("/study/thumbnails/a.webp");
    expect(STUDY_TRACKS_BY_MOOD.lofi[0].src).toBe("/study/music/a.mp3");
    // Ảnh bìa là URL ngoài thì giữ nguyên.
    expect(STUDY_TRACKS_BY_MOOD.lofi[0].cover).toBe("https://cdn.test/a.jpg");
  });

  it("resetCatalog trả lại bundle đóng gói", () => {
    applyCatalog(catalog());
    expect(STUDY_SCENES).toHaveLength(1);
    resetCatalog();
    expect(STUDY_SCENES.length).toBeGreaterThan(30);
    expect(getCatalogMeta().version).toBe(0);
  });
});

describe("content-catalog — kiểm tra payload", () => {
  it("payload đúng shape thì nhận", () => {
    expect(parseCatalog(payload())).not.toBeNull();
  });

  it("thiếu mảng, sai kiểu hay thiếu trường bắt buộc thì trả null", () => {
    expect(parseCatalog({ ok: true, scenes: [], tracks: {} })).toBeNull();
    expect(parseCatalog({ ok: true, scenes: "x", sounds: [], tracks: { lofi: [], jazz: [], relax: [] } })).toBeNull();
    expect(
      parseCatalog({
        ok: true,
        scenes: [{ id: "a", name: "A" }],
        sounds: [],
        tracks: { lofi: [], jazz: [], relax: [] },
      }),
    ).toBeNull();
    expect(
      parseCatalog({
        ok: true,
        scenes: [],
        sounds: [],
        tracks: { lofi: [trackA], jazz: [], relax: [] },
      }),
    ).not.toBeNull();
    expect(
      parseCatalog({
        ok: true,
        scenes: [],
        sounds: [],
        tracks: { lofi: [{ ...trackA, coverPath: "" }], jazz: [], relax: [] },
      }),
    ).toBeNull();
  });
});

describe("content-catalog — cache localStorage", () => {
  it("ghi rồi đọc lại thì áp dụng đúng bản đã lưu", () => {
    saveCatalogCache(5, 1_760_000_000_000, catalog());
    resetCatalog();

    expect(loadCachedCatalog()).toBe(true);
    expect(getCatalogMeta()).toEqual({ version: 5, updatedAt: 1_760_000_000_000 });
    expect(STUDY_SCENES.map((scene) => scene.id)).toEqual(["scene-a"]);
  });

  it("cache hỏng thì bỏ qua và giữ bundle", () => {
    localStorage.setItem(STORAGE_KEYS.contentCatalog, "{hỏng");
    expect(loadCachedCatalog()).toBe(false);

    localStorage.setItem(
      STORAGE_KEYS.contentCatalog,
      JSON.stringify({ version: 2, updatedAt: 1, catalog: { scenes: [], sounds: [] } }),
    );
    expect(loadCachedCatalog()).toBe(false);
    expect(getCatalogMeta().version).toBe(0);
  });

  it("version 0 hoặc âm trong cache bị bỏ", () => {
    localStorage.setItem(
      STORAGE_KEYS.contentCatalog,
      JSON.stringify({ version: 0, updatedAt: 1, catalog: catalog() }),
    );
    expect(loadCachedCatalog()).toBe(false);
  });
});

describe("content-catalog — tải bản mới", () => {
  it("version mới hơn thì áp dụng, ghi cache và báo updated", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(payload())));

    const result = await refreshCatalog();
    expect(result).toMatchObject({ ok: true, updated: true, version: 3 });
    expect(STUDY_SCENES.map((scene) => scene.id)).toEqual(["scene-a"]);

    const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS.contentCatalog) as string);
    expect(cached.version).toBe(3);
  });

  it("server trả version cũ hơn hoặc bằng thì không đổi gì", async () => {
    saveCatalogCache(5, 1, catalog());
    resetCatalog();
    loadCachedCatalog();

    const fetchMock = vi.fn(async () => jsonResponse(payload()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await refreshCatalog();
    expect(result).toMatchObject({ ok: true, updated: false, version: 5 });
    expect(getCatalogMeta().version).toBe(5);
  });

  it("version 0 (chưa phát hành) thì giữ bundle đóng gói", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          ok: true,
          version: 0,
          updatedAt: 0,
          scenes: [],
          sounds: [],
          tracks: { lofi: [], jazz: [], relax: [] },
        }),
      ),
    );

    const result = await refreshCatalog();
    expect(result).toMatchObject({ ok: true, updated: false, version: 0 });
    expect(STUDY_SCENES.length).toBeGreaterThan(30);
  });

  it("fetch lỗi hoặc payload sai shape thì giữ bundle hiện tại", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 500)));
    expect((await refreshCatalog()).ok).toBe(false);

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true, version: 4, scenes: [] })));
    const bad = await refreshCatalog();
    expect(bad).toMatchObject({ ok: false, error: "bad_payload" });
    expect(STUDY_SCENES.length).toBeGreaterThan(30);
    expect(getCatalogMeta().version).toBe(0);
  });

  it("network throw thì báo lỗi mạng, không ném ra ngoài", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const result = await refreshCatalog();
    expect(result).toMatchObject({ ok: false, error: "network" });
    expect(STUDY_SCENES.length).toBeGreaterThan(30);
  });
});
