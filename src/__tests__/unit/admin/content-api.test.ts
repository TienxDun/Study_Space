import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import worker, {
  __resetAccessCertsCache,
  __resetContentCaches,
  __resetContentWriteLog,
  type AdminEnv,
} from "../../../../admin-worker/_worker";
import {
  ADMIN_EMAIL,
  CERT_URL,
  baseEnv,
  certsResponse,
  createKeyPair,
  exportJwk,
  makeToken,
  validClaims,
} from "./access-fixtures";

let pair: CryptoKeyPair;
let jwk: JsonWebKey;
let token: string;

beforeAll(async () => {
  pair = await createKeyPair();
  jwk = await exportJwk(pair);
  token = await makeToken(pair.privateKey, validClaims());
});

beforeEach(() => {
  __resetAccessCertsCache();
  __resetContentCaches();
  __resetContentWriteLog();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubCerts(): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === CERT_URL) return certsResponse([jwk]);
      return new Response("not found", { status: 404 });
    }),
  );
}

type Row = {
  version: number;
  kind: string;
  json: string;
  created_at: number;
  created_by: string;
};

function fakeContentDb(options: { failAudit?: boolean; failInsert?: string } = {}) {
  const rows: Row[] = [];
  const events: string[] = [];

  const db = {
    prepare(query: string) {
      const q = query.replace(/\s+/g, " ").trim();
      let bound: unknown[] = [];
      const stmt = {
        bind(...values: unknown[]) {
          bound = values;
          return stmt;
        },
        async run() {
          if (q.startsWith("INSERT INTO admin_audit")) {
            if (options.failAudit) throw new Error("D1 audit lỗi");
            events.push(`audit:${String(bound[1])}`);
            return {};
          }
          if (q.startsWith("INSERT INTO content_manifest")) {
            if (options.failInsert) throw new Error(options.failInsert);
            const next: Row[] = [];
            for (let i = 0; i < bound.length; i += 5) {
              next.push({
                version: Number(bound[i]),
                kind: String(bound[i + 1]),
                json: String(bound[i + 2]),
                created_at: Number(bound[i + 3]),
                created_by: String(bound[i + 4]),
              });
            }
            for (const row of next) {
              if (rows.some((r) => r.version === row.version && r.kind === row.kind)) {
                throw new Error("UNIQUE constraint failed: content_manifest.version");
              }
            }
            rows.push(...next);
            events.push("write");
            return {};
          }
          return {};
        },
        async first() {
          return null;
        },
        async all() {
          if (!q.includes("FROM content_manifest")) return { results: [] };
          if (q.includes("MAX(version)")) {
            const max = rows.reduce((value, row) => Math.max(value, row.version), 0);
            return { results: rows.filter((row) => row.version === max) };
          }
          if (q.includes("WHERE version = ?")) {
            const version = Number(bound[0]);
            return { results: rows.filter((row) => row.version === version) };
          }
          if (q.includes("ORDER BY version DESC")) {
            const limit = Number(bound[0]);
            return {
              results: [...rows].sort((a, b) => b.version - a.version).slice(0, limit),
            };
          }
          return { results: [] };
        },
      };
      return stmt;
    },
  };

  return { db: db as unknown as AdminEnv["DB"], rows, events };
}

function fakeR2(objects: Record<string, number>) {
  const list = Object.entries(objects).map(([key, size]) => ({ key, size }));
  return { list: async () => ({ objects: list, truncated: false }) };
}

function contentRequest(
  path: string,
  options: { method?: string; body?: unknown; auth?: string | null } = {},
): Request {
  const method = options.method ?? "GET";
  const auth = options.auth === undefined ? token : options.auth;
  return new Request(`https://admin.zenstudy.space/api/admin/content${path}`, {
    method,
    headers: {
      ...(auth ? { "Cf-Access-Jwt-Assertion": auth } : {}),
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

const sceneA = {
  id: "scene-a",
  name: "Cảnh A",
  category: "chill",
  type: "IMAGE",
  mediaPath: "scenes/a.webp",
  thumbnailPath: "thumbnails/a.webp",
};

const soundA = {
  id: "sound-a",
  name: "Mưa rào",
  icon: "CloudRain",
  category: "rain",
  audioPath: "sounds/a.mp3",
};

const trackA = {
  id: "track-a",
  title: "Bài A",
  artist: "Nghệ sĩ A",
  genre: "lofi",
  category: "lofi",
  audioPath: "music/a.mp3",
  coverPath: "https://cdn.test/a.jpg",
};

function seedBody() {
  // Bản sao để ca test sửa dữ liệu không làm bẩn mẫu dùng chung.
  return {
    scenes: [{ ...sceneA }],
    sounds: [{ ...soundA }],
    tracks: { lofi: [{ ...trackA }], jazz: [], relax: [] },
  };
}

async function call(
  env: AdminEnv,
  path: string,
  options: { method?: string; body?: unknown; auth?: string | null } = {},
) {
  const res = await worker.fetch(contentRequest(path, options), env);
  return { status: res.status, body: (await res.json()) as any };
}

function seededEnv(dbOptions: { failAudit?: boolean; failInsert?: string } = {}, r2 = {}) {
  stubCerts();
  const store = fakeContentDb(dbOptions);
  const env = baseEnv({ DB: store.db, R2: fakeR2(r2) });
  return { env, ...store };
}

describe("content api — đọc", () => {
  it("chưa có version nào thì trả danh sách rỗng, version 0", async () => {
    const { env } = seededEnv();
    const { status, body } = await call(env, "/items?kind=scenes");

    expect(status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      kind: "scenes",
      version: 0,
      createdAt: 0,
      createdBy: "",
      items: [],
      counts: { scenes: 0, sounds: 0, tracks: 0 },
    });
  });

  it("thiếu kind hoặc kind lạ thì 400", async () => {
    const { env } = seededEnv();
    expect((await call(env, "/items")).status).toBe(400);
    expect((await call(env, "/items?kind=users")).status).toBe(400);
  });

  it("thiếu JWT thì 401, không chạm D1", async () => {
    const { env, rows } = seededEnv();
    const { status } = await call(env, "/items?kind=scenes", { auth: null });
    expect(status).toBe(401);
    expect(rows).toHaveLength(0);
  });

  it("thiếu binding DB thì 500", async () => {
    stubCerts();
    const { status, body } = await call(baseEnv({ DB: undefined }), "/items?kind=scenes");
    expect(status).toBe(500);
    expect(body.error).toBe("missing_binding");
  });

  it("báo trạng thái file trong R2: có thì kèm dung lượng, thiếu thì null", async () => {
    const { env } = seededEnv({}, { "scenes/a.webp": 2048 });
    await call(env, "/init", { method: "POST", body: seedBody() });
    const { body } = await call(env, "/items?kind=scenes");

    expect(body.media).toEqual({
      "scenes/a.webp": 2048,
      "thumbnails/a.webp": null,
    });
    expect(body.filesOk).toBe(true);
  });
});

describe("content api — init", () => {
  it("nạp bản đầu tiên thành version 1 và ghi audit trước khi ghi", async () => {
    const { env, events } = seededEnv();
    const { status, body } = await call(env, "/init", { method: "POST", body: seedBody() });

    expect(status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      version: 1,
      counts: { scenes: 1, sounds: 1, tracks: 1 },
    });
    expect(events).toEqual(["audit:content.init", "write"]);
  });

  it("đã có bản phát hành thì 409, không ghi thêm", async () => {
    const { env, rows } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });
    const before = rows.length;

    const { status, body } = await call(env, "/init", { method: "POST", body: seedBody() });
    expect(status).toBe(409);
    expect(body.error).toBe("already_initialized");
    expect(rows).toHaveLength(before);
  });

  it("catalog sai (icon lạ) thì 400 kèm lỗi và không ghi gì", async () => {
    const { env, rows, events } = seededEnv();
    const bad = seedBody();
    bad.sounds[0].icon = "Alien";

    const { status, body } = await call(env, "/init", { method: "POST", body: bad });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_catalog");
    expect(body.errors[0]).toMatchObject({ kind: "sounds", field: "icon" });
    expect(rows).toHaveLength(0);
    expect(events).toEqual([]);
  });

  it("body không phải object thì 400", async () => {
    const { env } = seededEnv();
    const res = await worker.fetch(
      new Request("https://admin.zenstudy.space/api/admin/content/init", {
        method: "POST",
        headers: { "Cf-Access-Jwt-Assertion": token, "Content-Type": "application/json" },
        body: JSON.stringify([1, 2, 3]),
      }),
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("content api — thêm / sửa / xóa mục", () => {
  it("thêm cảnh sinh id khi client không gửi và tăng version", async () => {
    const { env, events } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });

    const { status, body } = await call(env, "/items", {
      method: "POST",
      body: { kind: "scenes", item: { ...sceneA, id: "" } },
    });

    expect(status).toBe(200);
    expect(body.version).toBe(2);
    expect(body.item.id).toMatch(/^scene-custom-\d+$/);
    expect(events).toEqual(["audit:content.init", "write", "audit:content.item.create", "write"]);

    const read = await call(env, "/items?kind=scenes");
    expect(read.body.items).toHaveLength(2);
  });

  it("thêm mục trùng id thì 400", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });

    const { status, body } = await call(env, "/items", {
      method: "POST",
      body: { kind: "sounds", item: soundA },
    });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_catalog");
  });

  it("thêm mục sai trường thì 400 và giữ nguyên catalog", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });

    const { status } = await call(env, "/items", {
      method: "POST",
      body: { kind: "scenes", item: { ...sceneA, id: "scene-b", mediaPath: "/etc/passwd" } },
    });
    expect(status).toBe(400);

    const read = await call(env, "/items?kind=scenes");
    expect(read.body.version).toBe(1);
    expect(read.body.items).toHaveLength(1);
  });

  it("thiếu kind khi thêm thì 400 invalid_kind", async () => {
    const { env } = seededEnv();
    const { status, body } = await call(env, "/items", {
      method: "POST",
      body: { item: sceneA },
    });
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_kind");
  });

  it("sửa tên mục ghi audit kèm tên trường đổi", async () => {
    const { env, events } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });

    const { status, body } = await call(env, "/items", {
      method: "PATCH",
      body: { kind: "scenes", id: "scene-a", patch: { name: "Cảnh B", hidden: true } },
    });

    expect(status).toBe(200);
    expect(body.version).toBe(2);
    expect(body.item).toMatchObject({ id: "scene-a", name: "Cảnh B", hidden: true });
    expect(events).toContain("audit:content.item.update");
  });

  it("sửa mục không tồn tại thì 404", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });

    const { status, body } = await call(env, "/items", {
      method: "PATCH",
      body: { kind: "scenes", id: "scene-x", patch: { name: "X" } },
    });
    expect(status).toBe(404);
    expect(body.error).toBe("not_found");
  });

  it("patch rỗng hoặc toàn trường lạ thì 400", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });

    expect(
      (await call(env, "/items", { method: "PATCH", body: { kind: "scenes", id: "scene-a", patch: {} } }))
        .status,
    ).toBe(400);
    expect(
      (
        await call(env, "/items", {
          method: "PATCH",
          body: { kind: "scenes", id: "scene-a", patch: { id: "hack", nonsense: 1 } },
        })
      ).status,
    ).toBe(400);
  });

  it("đổi mood bài nhạc là chuyển nhóm", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });

    const patched = await call(env, "/items", {
      method: "PATCH",
      body: { kind: "tracks", id: "track-a", patch: { category: "jazz" } },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.item.category).toBe("jazz");

    const read = await call(env, "/items?kind=tracks");
    expect(read.body.items.map((item: any) => [item.id, item.category])).toEqual([
      ["track-a", "jazz"],
    ]);
  });

  it("xóa mục chỉ bỏ khỏi catalog, trả về danh sách file để UI nhắc", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });

    const { status, body } = await call(env, "/items?kind=scenes&id=scene-a", {
      method: "DELETE",
    });

    expect(status).toBe(200);
    expect(body.version).toBe(2);
    expect(body.files).toEqual(["scenes/a.webp", "thumbnails/a.webp"]);

    const read = await call(env, "/items?kind=scenes");
    expect(read.body.items).toHaveLength(0);
  });

  it("xóa mục không tồn tại thì 404", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });
    const { status } = await call(env, "/items?kind=sounds&id=sound-x", { method: "DELETE" });
    expect(status).toBe(404);
  });
});

describe("content api — audit và xung đột", () => {
  it("audit lỗi thì không ghi version mới", async () => {
    const { env, rows } = seededEnv({ failAudit: true });
    const { status, body } = await call(env, "/init", { method: "POST", body: seedBody() });

    expect(status).toBe(500);
    expect(body.error).toBe("audit_failed");
    expect(rows).toHaveLength(0);
  });

  it("version bị chiếm thì 409 version_conflict", async () => {
    const { env } = seededEnv({ failInsert: "UNIQUE constraint failed: content_manifest.version" });
    const { status, body } = await call(env, "/init", { method: "POST", body: seedBody() });
    expect(status).toBe(409);
    expect(body.error).toBe("version_conflict");
  });

  it("lỗi D1 khác thì 500 d1_error", async () => {
    const { env } = seededEnv({ failInsert: "network error" });
    const { status, body } = await call(env, "/init", { method: "POST", body: seedBody() });
    expect(status).toBe(500);
    expect(body.error).toBe("d1_error");
  });
});

describe("content api — lịch sử và quay lại", () => {
  it("liệt kê version mới nhất trước kèm số mục", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });
    await call(env, "/items", {
      method: "POST",
      body: { kind: "sounds", item: { ...soundA, id: "sound-b" } },
    });

    const { status, body } = await call(env, "/versions");
    expect(status).toBe(200);
    expect(body.versions.map((v: any) => v.version)).toEqual([2, 1]);
    expect(body.versions[0].counts).toEqual({ scenes: 1, sounds: 2, tracks: 1 });
    expect(body.versions[1].counts).toEqual({ scenes: 1, sounds: 1, tracks: 1 });
    expect(body.versions[0].createdBy).toBe(ADMIN_EMAIL);
  });

  it("xem lại một version cũ trả đủ catalog", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });
    await call(env, "/items?kind=scenes&id=scene-a", { method: "DELETE" });

    const { status, body } = await call(env, "/versions/1");
    expect(status).toBe(200);
    expect(body.catalog.scenes).toHaveLength(1);
    expect(body.counts).toEqual({ scenes: 1, sounds: 1, tracks: 1 });
  });

  it("version không tồn tại thì 404", async () => {
    const { env } = seededEnv();
    const { status } = await call(env, "/versions/9");
    expect(status).toBe(404);
  });

  it("quay lại tạo version mới cùng nội dung, không xóa lịch sử", async () => {
    const { env, rows } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });
    await call(env, "/items?kind=scenes&id=scene-a", { method: "DELETE" });

    const { status, body } = await call(env, "/rollback", {
      method: "POST",
      body: { version: 1 },
    });
    expect(status).toBe(200);
    expect(body.version).toBe(3);
    expect(rows.filter((row) => row.version === 3)).toHaveLength(3);

    const read = await call(env, "/items?kind=scenes");
    expect(read.body.items).toHaveLength(1);
  });

  it("quay lại version không tồn tại thì 404, body sai kiểu thì 400", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });
    expect((await call(env, "/rollback", { method: "POST", body: { version: 9 } })).status).toBe(404);
    expect((await call(env, "/rollback", { method: "POST", body: { version: "1" } })).status).toBe(400);
  });
});

describe("content api — giới hạn và method", () => {
  it("quá 20 lần ghi mỗi phút thì 429", async () => {
    const { env } = seededEnv();
    await call(env, "/init", { method: "POST", body: seedBody() });

    for (let i = 0; i < 19; i += 1) {
      const res = await call(env, "/items", {
        method: "POST",
        body: { kind: "sounds", item: { ...soundA, id: `sound-${i}` } },
      });
      expect(res.status).toBe(200);
    }
    const blocked = await call(env, "/items", {
      method: "POST",
      body: { kind: "sounds", item: { ...soundA, id: "sound-last" } },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("rate_limited");
  });

  it("sai method thì 405", async () => {
    const { env } = seededEnv();
    expect((await call(env, "/items?kind=scenes", { method: "PUT", body: {} })).status).toBe(405);
    expect((await call(env, "/versions", { method: "POST", body: {} })).status).toBe(405);
  });

  it("endpoint lạ dưới /content thì 404", async () => {
    const { env } = seededEnv();
    expect((await call(env, "/nope")).status).toBe(404);
  });
});
