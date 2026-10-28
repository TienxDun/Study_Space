import { beforeEach, describe, expect, it } from "vitest";
import { createWorker } from "../../../../workers/data-api/worker.js";

type Row = { version: number; kind: string; json: string; created_at: number };

function createContentD1(options: { fail?: boolean } = {}) {
  const rows: Row[] = [];

  return {
    rows,
    prepare(sql: string) {
      const q = sql.replace(/\s+/g, " ").trim();
      const stmt = {
        bind() {
          return stmt;
        },
        async first() {
          return null;
        },
        async all() {
          if (options.fail) throw new Error("D1 hỏng");
          if (!q.includes("FROM content_manifest")) return { results: [] };
          const max = rows.reduce((value, row) => Math.max(value, row.version), 0);
          return { results: rows.filter((row) => row.version === max) };
        },
      };
      return stmt;
    },
  };
}

const baseEnv = {
  FIREBASE_PROJECT_ID: "test-zenspace-project",
  ALLOWED_ORIGINS: "http://localhost:3001",
};

const worker = createWorker({
  verifyToken: async () => ({ error: "INVALID_TOKEN" }),
});

function contentRequest(method = "GET", origin?: string) {
  return new Request("https://api.zenspace.app/content", {
    method,
    headers: origin ? { Origin: origin } : {},
  });
}

function seedVersion(version: number, rows: Row[]) {
  rows.push(
    {
      version,
      kind: "scenes",
      json: JSON.stringify([
        {
          id: "scene-a",
          name: "Cảnh A",
          category: "chill",
          type: "IMAGE",
          mediaPath: "scenes/a.webp",
          thumbnailPath: "thumbnails/a.webp",
        },
      ]),
      created_at: 1_760_000_000_000,
    },
    {
      version,
      kind: "sounds",
      json: JSON.stringify([
        { id: "sound-a", name: "Mưa", icon: "CloudRain", category: "rain", audioPath: "sounds/a.mp3" },
      ]),
      created_at: 1_760_000_000_000,
    },
    {
      version,
      kind: "tracks",
      json: JSON.stringify({
        lofi: [
          {
            id: "track-a",
            title: "Bài A",
            artist: "Ai",
            genre: "lofi",
            category: "lofi",
            audioPath: "music/a.mp3",
            coverPath: "https://cdn.test/a.jpg",
          },
        ],
        jazz: [],
        relax: [],
      }),
      created_at: 1_760_000_000_000,
    },
  );
}

describe("/content — catalog công khai", () => {
  let db: ReturnType<typeof createContentD1>;

  beforeEach(() => {
    db = createContentD1();
  });

  it("không cần token vẫn trả catalog mới nhất", async () => {
    seedVersion(1, db.rows);
    seedVersion(2, db.rows);

    const res = await worker.fetch(contentRequest(), { ...baseEnv, DB: db });
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toMatchObject({
      ok: true,
      version: 2,
      updatedAt: 1_760_000_000_000,
      counts: { scenes: 1, sounds: 1, tracks: 1 },
    });
    expect(body.scenes).toHaveLength(1);
    expect(body.sounds[0].id).toBe("sound-a");
    expect(body.tracks.lofi[0].id).toBe("track-a");
    expect(body.tracks.jazz).toEqual([]);
  });

  it("bảng trống trả version 0 với catalog rỗng", async () => {
    const res = await worker.fetch(contentRequest(), { ...baseEnv, DB: db });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      version: 0,
      updatedAt: 0,
      counts: { scenes: 0, sounds: 0, tracks: 0 },
      scenes: [],
      sounds: [],
      tracks: { lofi: [], jazz: [], relax: [] },
    });
  });

  it("gắn Cache-Control công khai và CORS theo Origin được phép", async () => {
    const res = await worker.fetch(contentRequest("GET", "http://localhost:3001"), {
      ...baseEnv,
      DB: db,
    });
    expect(res.headers.get("Cache-Control")).toContain("public");
    expect(res.headers.get("Cache-Control")).toContain("max-age=60");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3001");
  });

  it("origin lạ không được cấp Access-Control-Allow-Origin", async () => {
    const res = await worker.fetch(contentRequest("GET", "https://evil.example"), {
      ...baseEnv,
      DB: db,
    });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("DB hỏng trả 500 và không cache", async () => {
    const broken = createContentD1({ fail: true });
    const res = await worker.fetch(contentRequest(), { ...baseEnv, DB: broken });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("JSON hỏng trong bảng trả 500 thay vì đoán nội dung", async () => {
    db.rows.push({ version: 1, kind: "scenes", json: "{hỏng", created_at: 1 });
    const res = await worker.fetch(contentRequest(), { ...baseEnv, DB: db });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("invalid_json");
  });

  it("thiếu binding DB trả 500", async () => {
    const res = await worker.fetch(contentRequest(), { ...baseEnv });
    expect(res.status).toBe(500);
  });

  it("chỉ nhận GET", async () => {
    const res = await worker.fetch(contentRequest("POST"), { ...baseEnv, DB: db });
    expect(res.status).toBe(405);
  });

  it("route /data vẫn đòi token", async () => {
    const res = await worker.fetch(
      new Request("https://api.zenspace.app/data", { method: "GET" }),
      { ...baseEnv, DB: db },
    );
    expect(res.status).toBe(401);
  });
});
