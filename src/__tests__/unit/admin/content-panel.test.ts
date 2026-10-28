// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const html = readFileSync(resolve(__dirname, "../../../../admin-host/index.html"), "utf8");
// Bỏ thẻ script: bài test tự chạy admin-content.js trong happy-dom.
const bodyHtml = html
  .slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/gi, "");
const contentScript = readFileSync(
  resolve(__dirname, "../../../../admin-host/admin-content.js"),
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

      return json({ error: "not_found" }, 404);
    }),
  );

  return { calls, state };
}

function el<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

function rows(id: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(`#${id} tr`)) as HTMLElement[];
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
  new Function(contentScript)();
  await flush();
}

function confirmCalls(): string[][] {
  return (confirm as unknown as { mock: { calls: string[][] } }).mock.calls;
}

beforeEach(() => {
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
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
    await flush();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(String(confirmCalls()[0][0])).toContain("File trong kho vẫn giữ nguyên");

    const remove = api.calls.find((call) => call.init?.method === "DELETE");
    expect(remove?.url).toBe("/api/admin/content/items?kind=scenes&id=scene-rain");
    expect(rows("scene-rows")).toHaveLength(1);
    expect(el("content-note").textContent).toContain("File trong kho vẫn còn");
  });

  it("không xác nhận thì không gọi API xóa", async () => {
    const api = fakeApi();
    (confirm as unknown as { mockReturnValue: (value: boolean) => void }).mockReturnValue(false);
    await boot();

    rowButton(0, "Xóa").click();
    await flush();

    expect(api.calls.some((call) => call.init?.method === "DELETE")).toBe(false);
    expect(rows("scene-rows")).toHaveLength(2);
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
