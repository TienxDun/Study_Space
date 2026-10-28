import { describe, expect, it } from "vitest";
import {
  collectCatalogFiles,
  countsOf,
  deleteItem,
  detectMediaKind,
  diffFields,
  insertItem,
  isSafeRelPath,
  makeItemId,
  pickFreeKey,
  sanitizeFileName,
  updateItem,
  validateCatalog,
  type Catalog,
} from "../../../../admin-worker/content";

function scene(overrides: Record<string, unknown> = {}) {
  return {
    id: "scene-1",
    name: "Rainy Valley",
    category: "chill",
    type: "VIDEO",
    mediaPath: "scenes/rainy-valley.mp4",
    thumbnailPath: "thumbnails/rainy-valley.webp",
    ...overrides,
  };
}

function sound(overrides: Record<string, unknown> = {}) {
  return {
    id: "sound-1",
    name: "Forest Rain",
    icon: "CloudRain",
    category: "rain",
    audioPath: "sounds/rain.mp3",
    ...overrides,
  };
}

function track(overrides: Record<string, unknown> = {}) {
  return {
    id: "track-1",
    title: "Good Night",
    artist: "FASSounds",
    genre: "Lo-fi",
    category: "lofi",
    audioPath: "musics/lofi/good-night.mp3",
    coverPath: "https://cdn.pixabay.com/a.jpg",
    ...overrides,
  };
}

function catalog(overrides: Record<string, unknown> = {}) {
  return {
    scenes: [scene()],
    sounds: [sound()],
    tracks: { lofi: [track()], jazz: [], relax: [] },
    ...overrides,
  };
}

describe("content — tên file và đường dẫn", () => {
  it("làm sạch tên file, bỏ dấu và ký tự lạ", () => {
    expect(sanitizeFileName("Cơn Mưa 4K (final).MP4")).toEqual({
      base: "con-mua-4k-final",
      ext: ".mp4",
    });
    expect(sanitizeFileName("../../etc/passwd")).toEqual({ base: "passwd", ext: "" });
    expect(sanitizeFileName("")).toEqual({ base: "tep", ext: "" });
  });

  it("nhận ra loại file theo đuôi", () => {
    expect(detectMediaKind(".MP4")).toBe("video");
    expect(detectMediaKind(".webp")).toBe("image");
    expect(detectMediaKind(".mp3")).toBe("audio");
    expect(detectMediaKind(".exe")).toBeNull();
  });

  it("tránh ghi đè bằng hậu tố -1, -2", () => {
    const used = new Set(["scenes/a.mp4", "scenes/a-1.mp4"]);
    expect(pickFreeKey("scenes/a.mp4", used)).toBe("scenes/a-2.mp4");
    expect(pickFreeKey("scenes/b.mp4", used)).toBe("scenes/b.mp4");
  });

  it("chặn đường dẫn tuyệt đối, có .. hoặc có scheme", () => {
    expect(isSafeRelPath("scenes/a.mp4")).toBe(true);
    expect(isSafeRelPath("/scenes/a.mp4")).toBe(false);
    expect(isSafeRelPath("../a.mp4")).toBe(false);
    expect(isSafeRelPath("https://cdn.example.com/a.mp4")).toBe(false);
  });

  it("sinh id theo loại", () => {
    expect(makeItemId("scenes", 1700000000000)).toBe("scene-custom-1700000000000");
    expect(makeItemId("tracks", 1)).toBe("track-custom-1");
  });
});

describe("content — validate catalog", () => {
  it("catalog hợp lệ trả về bản đã chuẩn hoá và số lượng", () => {
    const result = validateCatalog(catalog());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.counts).toEqual({ scenes: 1, sounds: 1, tracks: 1 });
    expect(result.catalog.scenes[0].name).toBe("Rainy Valley");
    expect(result.catalog.tracks.lofi[0].category).toBe("lofi");
  });

  it("bỏ trường lạ thay vì lưu nguyên vào D1", () => {
    const result = validateCatalog(catalog({ scenes: [scene({ evil: "x" })] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.catalog.scenes[0]).not.toHaveProperty("evil");
  });

  it("bắt id trùng trong cùng loại", () => {
    const result = validateCatalog(catalog({ scenes: [scene(), scene({ name: "Khác" })] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain("trùng");
  });

  it("bắt loại cảnh sai", () => {
    const result = validateCatalog(catalog({ scenes: [scene({ type: "GIF" })] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.field)).toContain("type");
  });

  it("bắt icon ngoài danh sách", () => {
    const result = validateCatalog(catalog({ sounds: [sound({ icon: "Ufo" })] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((e) => e.field)).toContain("icon");
  });

  it("bắt mediaPath tuyệt đối", () => {
    const result = validateCatalog(catalog({ scenes: [scene({ mediaPath: "/scenes/a.mp4" })] }));
    expect(result.ok).toBe(false);
  });

  it("bắt nhạc khai sai mood", () => {
    const result = validateCatalog(
      catalog({ tracks: { lofi: [track({ category: "jazz" })], jazz: [], relax: [] } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].field).toBe("category");
  });

  it("bắt thiếu mảng cảnh và quá số lượng", () => {
    expect(validateCatalog({ sounds: [], tracks: { lofi: [], jazz: [], relax: [] } }).ok).toBe(false);
    const many = Array.from({ length: 201 }, (_, i) => scene({ id: `scene-${i}` }));
    const result = validateCatalog(catalog({ scenes: many }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.message.includes("200"))).toBe(true);
  });

  it("chặn số lượng vượt trần của từng loại", () => {
    const manyTracks = Array.from({ length: 101 }, (_, i) => track({ id: `track-${i}` }));
    const result = validateCatalog(catalog({ tracks: { lofi: manyTracks, jazz: [], relax: [] } }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.field === "lofi")).toBe(true);
  });
});

describe("content — sửa danh sách", () => {
  const base = (): Catalog => {
    const result = validateCatalog(
      catalog({
        scenes: [scene(), scene({ id: "scene-2" })],
        tracks: { lofi: [track()], jazz: [], relax: [] },
      }),
    );
    if (!result.ok) throw new Error("catalog mẫu hỏng");
    return result.catalog;
  };

  it("thêm mục vào đúng loại", () => {
    const added = insertItem(base(), "scenes", scene({ id: "scene-3" }));
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(added.catalog.scenes).toHaveLength(3);
  });

  it("đổi mood của bài nhạc thì chuyển nhóm", () => {
    const moved = updateItem(base(), "tracks", "track-1", { category: "jazz" });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.catalog.tracks.lofi).toHaveLength(0);
    expect(moved.catalog.tracks.jazz).toHaveLength(1);
    expect(moved.catalog.tracks.jazz[0].category).toBe("jazz");
  });

  it("không cho đổi id qua patch", () => {
    const updated = updateItem(base(), "scenes", "scene-1", { id: "hack", name: "Mới" });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.catalog.scenes[0].id).toBe("scene-1");
    expect(updated.catalog.scenes[0].name).toBe("Mới");
  });

  it("xóa mục trả về mục đã xóa và giữ nguyên mục khác", () => {
    const removed = deleteItem(base(), "scenes", "scene-1");
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    expect(removed.catalog.scenes.map((s) => s.id)).toEqual(["scene-2"]);
  });

  it("xóa id không tồn tại trả not_found", () => {
    expect(deleteItem(base(), "sounds", "không-có")).toEqual({ ok: false, message: "not_found" });
  });

  it("đếm số lượng và gom file của cả catalog", () => {
    const current = base();
    expect(countsOf(current)).toEqual({ scenes: 2, sounds: 1, tracks: 1 });
    const files = collectCatalogFiles(current);
    expect(files.has("scenes/rainy-valley.mp4")).toBe(true);
    expect(files.has("musics/lofi/good-night.mp3")).toBe(true);
    // scene-1 và scene-2 dùng chung file nên tập hợp chỉ còn 4 đường dẫn.
    expect(files.size).toBe(4);
  });

  it("diffFields chỉ ra trường đã đổi", () => {
    expect(diffFields({ a: 1, b: 2 }, { a: 1, b: 3 })).toEqual(["b"]);
  });
});
