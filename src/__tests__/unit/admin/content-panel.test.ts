// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAdminHtml } from "./load-admin-html";

const html = loadAdminHtml();
// Bỏ thẻ script: bài test tự chạy admin-content.js trong happy-dom.
const bodyHtml = html
  .slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/gi, "");
const dialogsScript = readFileSync(
  resolve(__dirname, "../../../../admin-host/scripts/dialogs.js"),
  "utf8",
);
const contentScript = readFileSync(
  resolve(__dirname, "../../../../admin-host/scripts/content.js"),
  "utf8",
);

type FetchCall = { url: string; init?: RequestInit };
type Kind = "scenes" | "sounds" | "tracks";
type Row = Record<string, any>;
type Counts = { scenes: number; sounds: number; tracks: number };

const CREATED_AT = new Date("2026-10-28T07:32:00Z").getTime();

type FakeState = {
  version: number;
  createdAt: number;
  createdBy: string;
  scenes: Row[];
  sounds: Row[];
  tracks: { lofi: Row[]; jazz: Row[]; relax: Row[] };
  versions: Array<{ version: number; createdAt: number; createdBy: string; counts: Counts }>;
};

function makeState(): FakeState {
  return {
    version: 3,
    createdAt: CREATED_AT,
    createdBy: "admin@example.com",
    scenes: [
      {
        id: "scene-rain",
        name: "Mưa trên phố Nhật",
        category: "chill",
        type: "IMAGE",
        badge: "Mưa",
        mediaPath: "scenes/rain.mp4",
        thumbnailPath: "thumbnails/rain.webp",
        description: "Mưa nhẹ trên phố",
        tags: ["mua", "pho"],
      },
      {
        id: "scene-night",
        name: "Phố đêm",
        category: "urban",
        type: "IMAGE",
        mediaPath: "scenes/gone.mp4",
        thumbnailPath: "thumbnails/night.webp",
        hidden: true,
      },
    ],
    sounds: [
      {
        id: "sound-rain",
        name: "Mưa rào",
        category: "rain",
        icon: "CloudRain",
        audioPath: "sounds/rain.mp3",
      },
    ],
    tracks: {
      lofi: [
        {
          id: "track-lofi-1",
          title: "Chiều tà",
          artist: "Vy",
          genre: "Lo-fi",
          audioPath: "tracks/lofi-1.mp3",
          coverPath: "covers/lofi-1.webp",
        },
      ],
      jazz: [],
      relax: [],
    },
    versions: [
      { version: 3, createdAt: CREATED_AT, createdBy: "admin@example.com", counts: { scenes: 2, sounds: 1, tracks: 1 } },
      { version: 2, createdAt: CREATED_AT - 3_600_000, createdBy: "admin@example.com", counts: { scenes: 2, sounds: 1, tracks: 0 } },
    ],
  };
}

// Máy chủ giả có trạng thái: mỗi lần ghi là một bản phát hành mới.
function fakeApi() {
  const state = makeState();
  const calls: FetchCall[] = [];

  const counts = (): Counts => ({
    scenes: state.scenes.length,
    sounds: state.sounds.length,
    tracks: state.tracks.lofi.length + state.tracks.jazz.length + state.tracks.relax.length,
  });

  const bump = () => {
    state.version += 1;
    state.createdAt = Date.now();
    state.createdBy = "admin@example.com";
    state.versions.unshift({
      version: state.version,
      createdAt: state.createdAt,
      createdBy: state.createdBy,
      counts: counts(),
    });
  };

  const tracksFlat = (): Row[] => [
    ...state.tracks.lofi.map((item) => ({ ...item, category: "lofi" })),
    ...state.tracks.jazz.map((item) => ({ ...item, category: "jazz" })),
    ...state.tracks.relax.map((item) => ({ ...item, category: "relax" })),
  ];

  const itemsOf = (kind: Kind): Row[] =>
    kind === "scenes" ? state.scenes : kind === "sounds" ? state.sounds : tracksFlat();

  const findTrack = (id: string): Row | undefined =>
    [...state.tracks.lofi, ...state.tracks.jazz, ...state.tracks.relax].find((item) => item.id === id);

  const media: Record<Kind, Record<string, number>> = {
    scenes: { "scenes/rain.mp4": 12000 },
    sounds: { "sounds/rain.mp3": 5000 },
    tracks: { "tracks/lofi-1.mp3": 9000 },
  };

  // Kho R2 giả: key → dung lượng; tệp nào không mục nào dùng thì là mồ côi.
  const files = new Map<string, { size: number; uploaded: number }>([
    ["scenes/rain.mp4", { size: 12000, uploaded: CREATED_AT }],
    ["scenes/orphan.mp4", { size: 2048, uploaded: CREATED_AT }],
    ["sounds/rain.mp3", { size: 5000, uploaded: CREATED_AT }],
    ["thumbnails/night.webp", { size: 200, uploaded: CREATED_AT }],
    ["thumbnails/rain.webp", { size: 300, uploaded: CREATED_AT }],
    ["tracks/lofi-1.mp3", { size: 9000, uploaded: CREATED_AT }],
  ]);

  const usage = () => {
    const map = new Map<string, Array<{ kind: Kind; id: string; name: string }>>();
    const add = (path: unknown, use: { kind: Kind; id: string; name: string }) => {
      if (typeof path !== "string" || !path || /^https?:\/\//i.test(path)) return;
      const list = map.get(path) || [];
      list.push(use);
      map.set(path, list);
    };
    for (const scene of state.scenes) {
      add(scene.mediaPath, { kind: "scenes", id: scene.id, name: scene.name });
      add(scene.thumbnailPath, { kind: "scenes", id: scene.id, name: scene.name });
    }
    for (const sound of state.sounds) {
      add(sound.audioPath, { kind: "sounds", id: sound.id, name: sound.name });
    }
    for (const track of tracksFlat()) {
      add(track.audioPath, { kind: "tracks", id: track.id, name: track.title });
      add(track.coverPath, { kind: "tracks", id: track.id, name: track.title });
    }
    return map;
  };

  const mediaList = (parsed: URL) => {
    const prefix = parsed.searchParams.get("prefix") || "";
    const query = (parsed.searchParams.get("q") || "").toLowerCase();
    const onlyOrphans = parsed.searchParams.get("orphans") === "1";
    const used = usage();
    const folders = new Map<string, Row>();
    const entries: Row[] = [];
    const orphanKeys: string[] = [];
    let bytes = 0;
    let orphanFiles = 0;
    let orphanBytes = 0;

    for (const [key, meta] of files) {
      const folder = key.split("/")[0] || "";
      const summary = folders.get(folder) || { prefix: folder, files: 0, bytes: 0, orphans: 0, orphanBytes: 0 };
      summary.files += 1;
      summary.bytes += meta.size;
      bytes += meta.size;
      const usedBy = used.get(key) || [];
      const orphan = usedBy.length === 0;
      if (orphan) {
        summary.orphans += 1;
        summary.orphanBytes += meta.size;
        orphanFiles += 1;
        orphanBytes += meta.size;
        orphanKeys.push(key);
      }
      folders.set(folder, summary);
      if (prefix && folder !== prefix) continue;
      if (query && !key.toLowerCase().includes(query)) continue;
      if (onlyOrphans && !orphan) continue;
      entries.push({ key, size: meta.size, uploaded: meta.uploaded, usedBy, orphan });
    }
    entries.sort((a, b) => String(a.key).localeCompare(String(b.key)));

    return {
      ok: true,
      version: state.version,
      summary: { files: files.size, bytes, orphans: orphanFiles, orphanBytes, missing: 1, partial: false },
      folders: [...folders.values()].sort((a, b) => String(a.prefix).localeCompare(String(b.prefix))),
      entries,
      total: entries.length,
      truncated: false,
      orphanKeys,
      missing: [{ kind: "scenes", id: "scene-night", name: "Phố đêm", path: "scenes/gone.mp4" }],
    };
  };

  const payload = (kind: Kind) => ({
    ok: true,
    kind,
    version: state.version,
    createdAt: state.createdAt,
    createdBy: state.createdBy,
    counts: counts(),
    items: itemsOf(kind),
    media: media[kind],
    filesOk: true,
    filesPartial: false,
  });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      const method = init?.method || "GET";

      if (url.startsWith("/api/admin/content/items")) {
        const parsed = new URL(url, "https://admin.test");
        // GET/DELETE mang kind trên query, POST/PATCH mang kind trong body.
        const queryKind = String(parsed.searchParams.get("kind") || "") as Kind;
        if (method === "GET") return json(payload(queryKind));

        if (method === "POST") {
          const body = JSON.parse(String(init?.body || "{}"));
          const kind = body.kind as Kind;
          const item: Row = { id: "new-" + (state.version + 1), ...body.item };
          if (kind === "tracks") state.tracks[item.category as "lofi" | "jazz" | "relax"].push(item);
          else if (kind === "scenes") state.scenes.push(item);
          else state.sounds.push(item);
          bump();
          return json({ ok: true, version: state.version });
        }

        if (method === "PATCH") {
          const body = JSON.parse(String(init?.body || "{}"));
          const kind = body.kind as Kind;
          const target = kind === "tracks" ? findTrack(body.id) : itemsOf(kind).find((item) => item.id === body.id);
          if (!target) return json({ error: "not_found" }, 404);
          Object.assign(target, body.patch);
          bump();
          return json({ ok: true, version: state.version });
        }

        if (method === "DELETE") {
          const kind = queryKind;
          const id = String(parsed.searchParams.get("id") || "");
          if (kind === "tracks") {
            state.tracks.lofi = state.tracks.lofi.filter((item) => item.id !== id);
            state.tracks.jazz = state.tracks.jazz.filter((item) => item.id !== id);
            state.tracks.relax = state.tracks.relax.filter((item) => item.id !== id);
          } else if (kind === "scenes") {
            state.scenes = state.scenes.filter((item) => item.id !== id);
          } else {
            state.sounds = state.sounds.filter((item) => item.id !== id);
          }
          bump();
          return json({ ok: true, version: state.version, files: [] });
        }
      }

      if (url === "/api/admin/content/versions") {
        return json({ ok: true, versions: state.versions });
      }

      if (url.startsWith("/api/admin/content/media/prune")) {
        const body = JSON.parse(String(init?.body || "{}"));
        const used = usage();
        let deleted = 0;
        let skipped = 0;
        let freed = 0;
        for (const key of Array.isArray(body.keys) ? body.keys : []) {
          if ((used.get(key) || []).length) {
            skipped += 1;
            continue;
          }
          const meta = files.get(key);
          if (!meta) continue;
          files.delete(key);
          deleted += 1;
          freed += meta.size;
        }
        return json({ ok: true, deleted, skipped, freed });
      }

      if (url.startsWith("/api/admin/content/media")) {
        const parsed = new URL(url, "https://admin.test");
        if (method === "GET") return json(mediaList(parsed));
        if (method === "DELETE") {
          const key = parsed.searchParams.get("key") || "";
          const usedBy = usage().get(key) || [];
          if (usedBy.length) return json({ error: "media_in_use", usedBy }, 409);
          if (!files.has(key)) return json({ error: "not_found" }, 404);
          files.delete(key);
          return json({ ok: true });
        }
      }

      return json({ error: "not_found" }, 404);
    }),
  );

  return { calls, state };
}

function fakeUpload(key: string, status = 200) {
  const uploads: Array<{ method: string; url: string }> = [];
  class FakeUpload {
    method = "";
    url = "";
    status = status;
    responseText = JSON.stringify(status === 200
      ? { ok: true, key, size: 3, contentType: "application/octet-stream" }
      : { error: "unsupported_type" });
    upload: { onprogress?: unknown } = {};
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
      uploads.push(this);
    }
    send() {
      this.onload?.();
    }
  }
  vi.stubGlobal("XMLHttpRequest", FakeUpload);
  return uploads;
}

function el<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function rows(id: string): HTMLElement[] {
  // Bảng luôn có sẵn một dòng trạng thái rỗng (hidden) cho trường hợp không có mục.
  return Array.from(document.querySelectorAll(`#${id} tr`)).filter(
    (node) => !(node as HTMLElement).hidden,
  ) as HTMLElement[];
}

function rowButton(index: number, label: string): HTMLButtonElement {
  const button = Array.from(rows("scene-rows")[index].querySelectorAll("button")).find(
    (node) => node.textContent === label,
  );
  if (!button) throw new Error(`Không thấy nút ${label} ở dòng ${index}`);
  return button as HTMLButtonElement;
}

async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function boot() {
  document.body.innerHTML = bodyHtml;
  new Function(dialogsScript)();
  new Function(contentScript)();
  await flush();
}

function dialog(): HTMLElement {
  const node = document.querySelector(".admin-dialog") as HTMLElement | null;
  if (!node) throw new Error("Không thấy hộp thoại");
  return node;
}

function dialogOpen(): boolean {
  const node = document.querySelector(".admin-dialog") as HTMLElement | null;
  return !!node && !node.hidden;
}

function dialogText(): string {
  return dialog().textContent || "";
}

function dialogOk(): HTMLButtonElement {
  return dialog().querySelector(".admin-dialog-ok") as HTMLButtonElement;
}

function dialogCancel(): HTMLButtonElement {
  return dialog().querySelector(".admin-dialog-cancel") as HTMLButtonElement;
}

function dialogInput(): HTMLInputElement {
  return dialog().querySelector(".admin-dialog-input") as HTMLInputElement;
}

function typeInDialog(value: string) {
  const input = dialogInput();
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function filesRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll("#files-rows tr")) as HTMLElement[];
}

function fileRow(key: string): HTMLElement {
  const row = filesRows().find((node) => (node.textContent || "").includes(key));
  if (!row) throw new Error(`Không thấy dòng tệp ${key}`);
  return row;
}

function rowButtonIn(row: HTMLElement, label: string): HTMLButtonElement {
  const button = Array.from(row.querySelectorAll("button")).find(
    (node) => node.textContent === label,
  );
  if (!button) throw new Error(`Không thấy nút ${label} trong dòng`);
  return button as HTMLButtonElement;
}

afterEach(() => {
  if (dialogOpen()) {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  }
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("panel Nội dung", () => {
  it("hiện danh sách cảnh, số đếm và bản phát hành hiện tại", async () => {
    fakeApi();
    await boot();

    expect(rows("scene-rows")).toHaveLength(2);
    expect(el("count-scenes").textContent).toBe("2");
    expect(el("count-sounds").textContent).toBe("1");
    expect(el("count-tracks").textContent).toBe("1");
    expect(el("content-meta").textContent).toContain("Bản v3 · 2 cảnh");
    expect(el("content-state").textContent).toBe("Đã đọc bản v3");
    expect(el("content-seed").hidden).toBe(true);

    const first = rows("scene-rows")[0].textContent || "";
    expect(first).toContain("Mưa trên phố Nhật");
    expect(first).toContain("Có file · 12 KB");
    // Trang admin đặt no-referrer, CDN lại đòi referer: ảnh phải tự gửi origin.
    expect(rows("scene-rows")[0].querySelector("img.content-thumb")?.getAttribute("referrerpolicy")).toBe("origin");

    const second = rows("scene-rows")[1].textContent || "";
    expect(second).toContain("Đang ẩn");
    expect(second).toContain("Thiếu file");

    expect(rows("content-version-rows")).toHaveLength(2);
  });

  it("chuyển tab thì tải và hiện danh sách âm thanh", async () => {
    const api = fakeApi();
    await boot();

    el("tab-sounds").click();
    await flush();

    expect(api.calls.some((call) => call.url === "/api/admin/content/items?kind=sounds")).toBe(true);
    expect(rows("sound-rows")).toHaveLength(1);
    expect(rows("sound-rows")[0].textContent).toContain("Mưa rào");
    expect(el("pane-sounds").hidden).toBe(false);
    expect(el("pane-scenes").hidden).toBe(true);
    expect(el("tab-sounds").getAttribute("aria-selected")).toBe("true");
  });

  it("bấm Sửa thì điền sẵn giá trị vào biểu mẫu", async () => {
    fakeApi();
    await boot();

    rowButton(0, "Sửa").click();

    expect(el("scene-form").hidden).toBe(false);
    expect(el("scene-form-title").textContent).toBe("Sửa cảnh");
    expect(el<HTMLInputElement>("scene-name").value).toBe("Mưa trên phố Nhật");
    expect(el<HTMLSelectElement>("scene-category").value).toBe("chill");
    expect(el<HTMLInputElement>("scene-media").value).toBe("scenes/rain.mp4");
    expect(el<HTMLInputElement>("scene-thumb").value).toBe("thumbnails/rain.webp");
    expect(el<HTMLInputElement>("scene-tags").value).toBe("mua, pho");
    expect(el<HTMLInputElement>("scene-hidden").checked).toBe(false);
    expect(el("pane-scenes").classList.contains("is-editing")).toBe(true);
    expect(el("content-state").textContent).toBe("Đã đọc bản v3");
  });

  it.each([
    ["scenes", "scene", "video"],
    ["sounds", "sound", "audio"],
    ["tracks", "track", "audio"],
  ])("preview %s gửi Origin qua CORS ẩn danh", async (tab, prefix, tag) => {
    const api = fakeApi();
    api.state.scenes[0].type = "VIDEO";
    await boot();
    el("tab-" + tab).click();
    await flush();
    rowButtonIn(rows(prefix + "-rows")[0], "Sửa").click();

    const node = el(prefix + "-preview").querySelector(tag) as HTMLMediaElement;
    expect(node).not.toBeNull();
    expect(node.crossOrigin).toBe("anonymous");
  });

  it("lưu chỉnh sửa gửi PATCH đúng mục rồi phát hành bản mới", async () => {
    const api = fakeApi();
    await boot();

    rowButton(0, "Sửa").click();
    const name = el<HTMLInputElement>("scene-name");
    name.value = "Mưa đêm";
    name.dispatchEvent(new Event("input", { bubbles: true }));

    expect(el("content-state").textContent).toBe("Có thay đổi chưa lưu");

    el("scene-save").click();
    await flush();

    const patch = api.calls.find((call) => call.init?.method === "PATCH");
    expect(patch?.url).toBe("/api/admin/content/items");
    const body = JSON.parse(String(patch?.init?.body));
    expect(body.kind).toBe("scenes");
    expect(body.id).toBe("scene-rain");
    expect(body.patch).toMatchObject({
      name: "Mưa đêm",
      category: "chill",
      tags: ["mua", "pho"],
      hidden: false,
    });

    expect(el("scene-form").hidden).toBe(true);
    expect(el("content-note").textContent).toContain("Đã lưu và phát hành bản v4");
    expect(rows("scene-rows")[0].textContent).toContain("Mưa đêm");
    expect(el("content-state").textContent).toBe("Đã đọc bản v4");
  });

  it("xóa hỏi xác nhận, gọi DELETE và giữ file trong kho", async () => {
    const api = fakeApi();
    await boot();

    rowButton(0, "Xóa").click();
    expect(dialogOpen()).toBe(true);
    expect(dialogText()).toContain("Mưa trên phố Nhật");
    expect(dialogText()).toContain("File trong kho vẫn giữ nguyên");
    expect(api.calls.some((call) => call.init?.method === "DELETE")).toBe(false);

    dialogOk().click();
    await flush();

    const remove = api.calls.find((call) => call.init?.method === "DELETE");
    expect(remove?.url).toBe("/api/admin/content/items?kind=scenes&id=scene-rain");
    expect(dialogOpen()).toBe(false);
    expect(rows("scene-rows")).toHaveLength(1);
    expect(el("content-note").textContent).toContain("File trong kho vẫn còn");
  });

  it("không xác nhận thì không gọi API xóa", async () => {
    const api = fakeApi();
    await boot();

    rowButton(0, "Xóa").click();
    expect(dialogOpen()).toBe(true);
    dialogCancel().click();
    await flush();

    expect(dialogOpen()).toBe(false);
    expect(api.calls.some((call) => call.init?.method === "DELETE")).toBe(false);
    expect(rows("scene-rows")).toHaveLength(2);
  });

  it("Escape đóng hộp thoại xác nhận và trả focus về nút vừa bấm", async () => {
    const api = fakeApi();
    await boot();

    const remove = rowButton(0, "Xóa");
    remove.focus();
    remove.click();
    expect(dialogOpen()).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flush();

    expect(dialogOpen()).toBe(false);
    expect(document.activeElement).toBe(remove);
    expect(api.calls.some((call) => call.init?.method === "DELETE")).toBe(false);
  });

  it("thêm cảnh mới gửi POST và tự điền ảnh xem trước từ file", async () => {
    const api = fakeApi();
    await boot();

    el("scene-add").click();
    expect(el("scene-form-title").textContent).toBe("Thêm cảnh");
    expect(el<HTMLInputElement>("scene-name").value).toBe("");

    el<HTMLInputElement>("scene-name").value = "Cảnh mới";
    const media = el<HTMLInputElement>("scene-media");
    media.value = "scenes/new.webp";
    media.dispatchEvent(new Event("change", { bubbles: true }));

    expect(el<HTMLInputElement>("scene-thumb").value).toBe("scenes/new.webp");

    el("scene-save").click();
    await flush();

    const post = api.calls.find((call) => call.init?.method === "POST");
    expect(post?.url).toBe("/api/admin/content/items");
    const body = JSON.parse(String(post?.init?.body));
    expect(body.kind).toBe("scenes");
    expect(body.item).toMatchObject({
      name: "Cảnh mới",
      mediaPath: "scenes/new.webp",
      thumbnailPath: "scenes/new.webp",
    });

    expect(el("content-note").textContent).toContain("Đã lưu và phát hành bản v4");
    expect(rows("scene-rows")).toHaveLength(3);
    expect(el("count-scenes").textContent).toBe("3");
  });
});

describe("Kho tệp", () => {
  it("tab Kho tệp hiện tệp, mục đang dùng, tệp mồ côi và tệp thiếu", async () => {
    const api = fakeApi();
    await boot();

    el("tab-files").click();
    await flush();

    expect(api.calls.some((call) => call.url === "/api/admin/content/media")).toBe(true);
    expect(el("pane-files").hidden).toBe(false);
    expect(el("pane-scenes").hidden).toBe(true);
    expect(el("tab-files").getAttribute("aria-selected")).toBe("true");
    expect(el("count-files").textContent).toBe("6");
    expect(el("files-summary").textContent).toContain("6 tệp");
    expect(el("files-summary").textContent).toContain("1 mồ côi");
    expect(el("files-summary").textContent).toContain("scenes/: 2 tệp");

    const orphan = fileRow("scenes/orphan.mp4");
    expect(orphan.textContent).toContain("Mồ côi");
    expect(orphan.textContent).toContain("Không mục nào");
    expect(rowButtonIn(orphan, "Xóa").disabled).toBe(false);
    expect(orphan.querySelector("a.files-open")?.getAttribute("href")).toContain("scenes/orphan.mp4");

    const used = fileRow("scenes/rain.mp4");
    expect(used.textContent).toContain("Đang dùng");
    expect(used.textContent).toContain("Mưa trên phố Nhật · cảnh");
    expect(rowButtonIn(used, "Xóa").disabled).toBe(true);

    expect(el<HTMLButtonElement>("files-prune").disabled).toBe(false);
    expect(el("files-prune").textContent).toBe("Dọn 1 tệp mồ côi");

    expect(el("files-missing-block").hidden).toBe(false);
    expect(el("files-missing-list").textContent).toContain("scenes/gone.mp4");
    expect(el("files-missing-list").textContent).toContain("Phố đêm · cảnh");
  });

  it("lọc theo thư mục và chỉ tệp mồ côi thì hỏi lại máy chủ", async () => {
    const api = fakeApi();
    await boot();

    el("tab-files").click();
    await flush();

    el<HTMLSelectElement>("files-folder").value = "scenes";
    el("files-folder").dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    expect(api.calls.some((call) => call.url === "/api/admin/content/media?prefix=scenes")).toBe(true);
    expect(filesRows()).toHaveLength(2);

    el<HTMLInputElement>("files-orphans").checked = true;
    el("files-orphans").dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    expect(api.calls.some((call) => call.url === "/api/admin/content/media?prefix=scenes&orphans=1")).toBe(true);
    expect(filesRows()).toHaveLength(1);
    expect(filesRows()[0].textContent).toContain("scenes/orphan.mp4");
  });

  it("xóa tệp mồ côi chỉ bật nút khi gõ đúng tên tệp", async () => {
    const api = fakeApi();
    await boot();

    el("tab-files").click();
    await flush();

    rowButtonIn(fileRow("scenes/orphan.mp4"), "Xóa").click();
    expect(dialogOpen()).toBe(true);
    expect(dialogText()).toContain("scenes/orphan.mp4");
    expect(dialogOk().disabled).toBe(true);

    typeInDialog("sai-ten.mp4");
    expect(dialogOk().disabled).toBe(true);
    expect(dialog().querySelector(".admin-dialog-hint")?.textContent).toContain("Chưa khớp");

    typeInDialog("scenes/orphan.mp4");
    expect(dialogOk().disabled).toBe(false);
    expect(dialog().querySelector(".admin-dialog-hint")?.textContent).toContain("Đã khớp");

    dialogOk().click();
    await flush();

    const remove = api.calls.find((call) => call.init?.method === "DELETE");
    expect(remove?.url).toBe("/api/admin/content/media?key=scenes%2Forphan.mp4");
    expect(dialogOpen()).toBe(false);
    expect(el("files-note").textContent).toContain("Đã xóa scenes/orphan.mp4 khỏi kho");
    expect(filesRows().some((row) => (row.textContent || "").includes("scenes/orphan.mp4"))).toBe(false);
    expect(el<HTMLButtonElement>("files-prune").disabled).toBe(true);
    expect(el("count-files").textContent).toBe("5");
  });

  it("hủy hộp thoại gõ tên thì không gọi DELETE", async () => {
    const api = fakeApi();
    await boot();

    el("tab-files").click();
    await flush();

    rowButtonIn(fileRow("scenes/orphan.mp4"), "Xóa").click();
    dialogCancel().click();
    await flush();

    expect(dialogOpen()).toBe(false);
    expect(api.calls.some((call) => call.init?.method === "DELETE")).toBe(false);
    expect(fileRow("scenes/orphan.mp4")).toBeTruthy();
  });

  it("dọn tệp mồ côi hỏi lại danh sách rồi gọi prune", async () => {
    const api = fakeApi();
    await boot();

    el("tab-files").click();
    await flush();

    el("files-prune").click();
    await flush();

    expect(api.calls.some((call) => call.url === "/api/admin/content/media?fresh=1")).toBe(true);
    expect(dialogOpen()).toBe(true);
    expect(dialogText()).toContain("1 tệp mồ côi");
    expect(api.calls.some((call) => call.url === "/api/admin/content/media/prune")).toBe(false);

    dialogOk().click();
    await flush();

    const prune = api.calls.find(
      (call) => call.init?.method === "POST" && call.url === "/api/admin/content/media/prune",
    );
    expect(JSON.parse(String(prune?.init?.body)).keys).toEqual(["scenes/orphan.mp4"]);
    expect(el("files-note").textContent).toContain("Đã xóa 1 tệp mồ côi");
    expect(el<HTMLButtonElement>("files-prune").disabled).toBe(true);
  });

  it.each([
    ["scenes", "scene", "scene-thumb", "thumbnails/new.webp", "img"],
    ["sounds", "sound", "sound-audio", "sounds/new.mp3", "audio"],
    ["tracks", "track", "track-audio", "musics/new.mp3", "audio"],
    ["tracks", "track", "track-cover", "authors/new.webp", "img"],
  ])("upload %s %s %s cập nhật preview ngay", async (tab, prefix, field, key, tag) => {
    fakeApi();
    fakeUpload(key);
    await boot();
    el("tab-" + tab).click();
    await flush();
    rowButtonIn(rows(prefix + "-rows")[0], "Sửa").click();
    const oldSrc = el(prefix + "-preview").querySelector(tag)?.getAttribute("src");

    const fileInput = el<HTMLInputElement>(field + "-file");
    Object.defineProperty(fileInput, "files", { value: [new File(["abc"], key.split("/").pop()!)], configurable: true });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    expect(el<HTMLInputElement>(field).value).toBe(key);
    const newSrc = el(prefix + "-preview").querySelector(tag)?.getAttribute("src");
    expect(newSrc).toBe("https://study-space-shield.leutiendung-hht.workers.dev/" + key);
    expect(newSrc).not.toBe(oldSrc);
    expect(el("content-state").textContent).toBe("Có thay đổi chưa lưu");
    expect(el<HTMLButtonElement>(prefix + "-save").disabled).toBe(false);
  });

  it("upload thất bại giữ nguyên đường dẫn và preview cũ", async () => {
    fakeApi();
    fakeUpload("sounds/new.mp3", 415);
    await boot();
    el("tab-sounds").click();
    await flush();
    rowButtonIn(rows("sound-rows")[0], "Sửa").click();
    const oldSrc = el("sound-preview").querySelector("audio")?.getAttribute("src");
    const fileInput = el<HTMLInputElement>("sound-audio-file");
    Object.defineProperty(fileInput, "files", { value: [new File(["abc"], "invalid.png")], configurable: true });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    expect(el<HTMLInputElement>("sound-audio").value).toBe("sounds/rain.mp3");
    expect(el("sound-preview").querySelector("audio")?.getAttribute("src")).toBe(oldSrc);
    expect(el("content-note").textContent).toContain("Tải tệp thất bại");
    expect(el<HTMLButtonElement>("sound-save").disabled).toBe(false);
  });

  it("chọn tệp trong biểu mẫu thì tải lên kho và điền đường dẫn mới", async () => {
    fakeApi();
    const uploads = fakeUpload("scenes/on-mua.webp");

    await boot();
    el("scene-add").click();

    const fileInput = el<HTMLInputElement>("scene-media-file");
    const file = new File(["abc"], "ơn mưa.webp", { type: "image/webp" });
    Object.defineProperty(fileInput, "files", { value: [file], configurable: true });
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();

    expect(uploads).toHaveLength(1);
    expect(uploads[0].method).toBe("POST");
    expect(uploads[0].url).toBe(
      "/api/admin/content/media?folder=scenes&name=" + encodeURIComponent("ơn mưa.webp"),
    );
    expect(el<HTMLInputElement>("scene-media").value).toBe("scenes/on-mua.webp");
    expect(el<HTMLInputElement>("scene-thumb").value).toBe("scenes/on-mua.webp");
    expect(el("scene-preview").querySelector("img")?.getAttribute("src")).toContain("scenes/on-mua.webp");
    expect(el("content-note").textContent).toContain("Đã tải scenes/on-mua.webp lên kho");
    expect(el("scene-media-progress").hidden).toBe(false);
    expect(el<HTMLButtonElement>("scene-save").disabled).toBe(false);
  });
});
