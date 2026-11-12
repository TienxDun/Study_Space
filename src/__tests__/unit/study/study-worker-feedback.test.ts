import { beforeEach, describe, expect, it } from "vitest";
import { createWorker } from "../../../../workers/data-api/worker.js";

type Row = Record<string, any>;

/** D1 giả lập cho bảng P3.16: user_feedback + deleted_accounts. */
function createMockD1() {
  const tables: Record<string, Row[]> = {
    user_feedback: [],
    deleted_accounts: [],
  };

  const table = (name: string): Row[] => {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  };

  const execute = (sql: string, params: any[]) => {
    const s = sql.replace(/\s+/g, " ").trim();

    if (s.startsWith("INSERT INTO user_feedback")) {
      const [
        id,
        uid,
        name,
        kind,
        message,
        contact,
        app_version,
        platform,
        viewport,
        locale,
        image_key,
        created_at,
      ] = params;
      table("user_feedback").push({
        id,
        uid,
        name,
        kind,
        message,
        contact,
        app_version,
        platform,
        viewport,
        locale,
        image_key,
        status: "open",
        created_at,
      });
      return { meta: { changes: 1 } };
    }

    if (s.startsWith("DELETE FROM user_feedback WHERE created_at < ?")) {
      const [cutoff] = params;
      const before = table("user_feedback").length;
      tables.user_feedback = table("user_feedback").filter(
        (row) => Number(row.created_at) >= Number(cutoff)
      );
      return { meta: { changes: before - tables.user_feedback.length } };
    }

    return { meta: { changes: 0 } };
  };

  const first = (sql: string, params: any[]) => {
    const s = sql.replace(/\s+/g, " ").trim();
    if (s.startsWith("SELECT uid FROM deleted_accounts")) {
      const [uid] = params;
      const row = table("deleted_accounts").find((item) => item.uid === uid);
      return row ? { uid: row.uid } : null;
    }
    if (s.startsWith("SELECT COUNT(*) AS n FROM user_feedback")) {
      const [uid, since] = params;
      const withImage = s.includes("image_key IS NOT NULL");
      const n = table("user_feedback").filter(
        (row) =>
          row.uid === uid &&
          Number(row.created_at) >= Number(since) &&
          (!withImage || Boolean(row.image_key))
      ).length;
      return { n };
    }
    return null;
  };

  const prepare = (sql: string) => {
    let params: any[] = [];
    const stmt = {
      bind(...args: any[]) {
        params = args;
        return stmt;
      },
      async first() {
        return first(sql, params);
      },
      async all() {
        const s = sql.replace(/\s+/g, " ").trim();
        if (s.startsWith("SELECT image_key FROM user_feedback WHERE created_at < ?")) {
          const [cutoff] = params;
          return {
            results: table("user_feedback")
              .filter(
                (row) => Number(row.created_at) < Number(cutoff) && Boolean(row.image_key)
              )
              .map((row) => ({ image_key: row.image_key })),
          };
        }
        return { results: [] };
      },
      async run() {
        return execute(sql, params);
      },
    };
    return stmt;
  };

  return { prepare, _tables: tables };
}

describe("Worker Data-API — Góp ý/báo lỗi chung", () => {
  let mockDb: ReturnType<typeof createMockD1>;
  let worker: ReturnType<typeof createWorker>;

  const env = (extra: Record<string, unknown> = {}) => ({
    FIREBASE_PROJECT_ID: "test-zenspace-project",
    ALLOWED_ORIGINS: "http://localhost:3000",
    DB: mockDb,
    ...extra,
  });

  const call = (
    path: string,
    options: { method?: string; token?: string; body?: unknown; form?: FormData; extra?: Record<string, unknown> } = {}
  ) => {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    return worker.fetch(
      new Request(`https://api.zenspace.app${path}`, {
        method: options.method || "GET",
        headers,
        body: options.form
          ? options.form
          : options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
      }),
      env(options.extra)
    );
  };

  const createMockR2 = () => {
    const objects = new Map<string, { bytes: Uint8Array; contentType?: string }>();
    const deleted: string[][] = [];
    return {
      objects,
      deleted,
      async put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
        objects.set(key, {
          bytes: new Uint8Array(value),
          contentType: options?.httpMetadata?.contentType,
        });
      },
      async delete(keys: string[] | string) {
        const list = Array.isArray(keys) ? keys : [keys];
        deleted.push(list);
        for (const key of list) objects.delete(key);
      },
    };
  };

  const JPEG = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);

  const imageForm = () => {
    const form = new FormData();
    form.set("kind", "bug");
    form.set("message", "Nút ghi chú không phản hồi trên điện thoại.");
    form.set("name", "Bạn An");
    form.set("image", new File([JPEG], "man-hinh.jpg", { type: "image/jpeg" }));
    return form;
  };

  beforeEach(() => {
    mockDb = createMockD1();
    worker = createWorker({
      verifyToken: async (_env: unknown, token: string) => {
        if (token === "valid-token-alice") return { uid: "user_alice" };
        return { error: "INVALID_TOKEN" };
      },
    });
  });

  it("thiếu token thì 401", async () => {
    const res = await call("/feedback", {
      method: "POST",
      body: { kind: "bug", message: "Nút ghi chú không phản hồi" },
    });
    expect(res.status).toBe(401);
    expect(mockDb._tables.user_feedback).toHaveLength(0);
  });

  it("lưu góp ý đúng trường, cắt khoảng trắng và giới hạn độ dài", async () => {
    const res = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: {
        kind: "bug",
        message: "  Nút ghi chú không phản hồi trên điện thoại.  ",
        name: "Bạn An",
        contact: "  an@example.com  ",
        appVersion: "v0.1.0",
        platform: "android",
        viewport: "390x844",
        locale: "vi-VN",
      },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, status: "open" });
    expect(typeof body.id).toBe("string");

    expect(mockDb._tables.user_feedback[0]).toMatchObject({
      uid: "user_alice",
      name: "Bạn An",
      kind: "bug",
      message: "Nút ghi chú không phản hồi trên điện thoại.",
      contact: "an@example.com",
      app_version: "v0.1.0",
      platform: "android",
      viewport: "390x844",
      locale: "vi-VN",
      status: "open",
    });
  });

  it("từ chối loại góp ý lạ và nội dung quá ngắn", async () => {
    const badKind = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: { kind: "spam", message: "Nội dung đủ dài để qua bước độ dài." },
    });
    expect(badKind.status).toBe(400);
    expect((await badKind.json()).code).toBe("INVALID_KIND");

    const tooShort = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: { kind: "bug", message: "ngắn" },
    });
    expect(tooShort.status).toBe(400);
    expect((await tooShort.json()).code).toBe("VALIDATION");
    expect(mockDb._tables.user_feedback).toHaveLength(0);
  });

  it("giới hạn 5 góp ý/ngày/UID và không tính góp ý cũ", async () => {
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) {
      mockDb._tables.user_feedback.push({
        id: `old-${i}`,
        uid: "user_alice",
        kind: "bug",
        message: "góp ý cũ",
        status: "open",
        created_at: now,
      });
    }

    const blocked = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: { kind: "bug", message: "Góp ý thứ sáu trong ngày." },
    });
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe("RATE_LIMITED");

    // Góp ý từ 2 ngày trước không tính vào hôm nay.
    mockDb._tables.user_feedback = mockDb._tables.user_feedback
      .slice(0, 4)
      .concat({
        id: "old-day",
        uid: "user_alice",
        kind: "bug",
        message: "góp ý cũ",
        status: "open",
        created_at: now - 2 * 24 * 60 * 60 * 1000,
      });

    const allowed = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: { kind: "bug", message: "Góp ý mới trong hôm nay." },
    });
    expect(allowed.status).toBe(200);
  });

  it("dọn góp ý cũ hơn 180 ngày khi ghi mới", async () => {
    mockDb._tables.user_feedback.push({
      id: "too-old",
      uid: "user_alice",
      kind: "bug",
      message: "góp ý rất cũ",
      status: "open",
      created_at: Date.now() - 181 * 24 * 60 * 60 * 1000,
    });

    const res = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: { kind: "idea", message: "Mong có thêm chế độ học nhóm." },
    });
    expect(res.status).toBe(200);
    expect(mockDb._tables.user_feedback.some((row) => row.id === "too-old")).toBe(false);
    expect(mockDb._tables.user_feedback).toHaveLength(1);
  });

  it("tài khoản đã xoá thì không gửi được", async () => {
    mockDb._tables.deleted_accounts.push({ uid: "user_alice", deleted_at: Date.now() });
    const res = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: { kind: "bug", message: "Nút ghi chú không phản hồi." },
    });
    expect(res.status).toBe(403);
    expect(mockDb._tables.user_feedback).toHaveLength(0);
  });

  it("nhận multipart kèm ảnh: lưu R2, ghi khóa vào D1", async () => {
    const r2 = createMockR2();
    const res = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      form: imageForm(),
      extra: { R2: r2 },
    });

    expect(res.status).toBe(200);
    expect((await res.json()).hasImage).toBe(true);
    const row = mockDb._tables.user_feedback[0];
    expect(row.image_key).toMatch(/^feedback\/\d{4}-\d{2}\/.+\.jpg$/);
    expect(row.name).toBe("Bạn An");
    expect(r2.objects.get(row.image_key)?.contentType).toBe("image/jpeg");
    expect(Array.from(r2.objects.get(row.image_key)?.bytes || [])).toEqual(
      Array.from(JPEG)
    );
  });

  it("từ chối ảnh sai định dạng hoặc quá 1 MB", async () => {
    const r2 = createMockR2();
    const wrongType = new FormData();
    wrongType.set("kind", "bug");
    wrongType.set("message", "Nội dung đủ dài để qua bước độ dài.");
    wrongType.set("image", new File([new Uint8Array([1, 2, 3, 4])], "a.jpg", { type: "image/jpeg" }));
    const bad = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      form: wrongType,
      extra: { R2: r2 },
    });
    expect(bad.status).toBe(400);
    expect((await bad.json()).code).toBe("IMAGE_INVALID_TYPE");

    const big = new FormData();
    big.set("kind", "bug");
    big.set("message", "Nội dung đủ dài để qua bước độ dài.");
    big.set(
      "image",
      new File([new Uint8Array(1024 * 1024 + 1)], "big.jpg", { type: "image/jpeg" })
    );
    const tooLarge = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      form: big,
      extra: { R2: r2 },
    });
    expect(tooLarge.status).toBe(400);
    expect((await tooLarge.json()).code).toBe("IMAGE_TOO_LARGE");
    expect(mockDb._tables.user_feedback).toHaveLength(0);
    expect(r2.objects.size).toBe(0);
  });

  it("tối đa 3 ảnh/ngày, góp ý chữ vẫn gửi được", async () => {
    const r2 = createMockR2();
    const now = Date.now();
    for (let i = 0; i < 3; i += 1) {
      mockDb._tables.user_feedback.push({
        id: `with-image-${i}`,
        uid: "user_alice",
        kind: "bug",
        message: "góp ý kèm ảnh",
        status: "open",
        image_key: `feedback/2026-11/img-${i}.jpg`,
        created_at: now,
      });
    }

    const blocked = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      form: imageForm(),
      extra: { R2: r2 },
    });
    expect(blocked.status).toBe(429);
    expect((await blocked.json()).code).toBe("IMAGE_RATE_LIMITED");
    expect(r2.objects.size).toBe(0);

    const textOnly = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: { kind: "bug", message: "Góp ý chữ khi đã hết lượt ảnh." },
    });
    expect(textOnly.status).toBe(200);
  });

  it("thiếu binding R2 thì báo rõ, góp ý chữ không bị ảnh hưởng", async () => {
    const res = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      form: imageForm(),
    });
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe("IMAGE_DISABLED");

    const textOnly = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: { kind: "bug", message: "Góp ý chữ khi chưa bật kho ảnh." },
    });
    expect(textOnly.status).toBe(200);
  });

  it("dọn ảnh của góp ý quá 180 ngày khi ghi mới", async () => {
    const r2 = createMockR2();
    await r2.put("feedback/2026-05/cu.jpg", JPEG.buffer as ArrayBuffer);
    mockDb._tables.user_feedback.push({
      id: "too-old",
      uid: "user_alice",
      kind: "bug",
      message: "góp ý rất cũ",
      status: "open",
      image_key: "feedback/2026-05/cu.jpg",
      created_at: Date.now() - 181 * 24 * 60 * 60 * 1000,
    });

    const res = await call("/feedback", {
      method: "POST",
      token: "valid-token-alice",
      body: { kind: "idea", message: "Mong có thêm chế độ học nhóm." },
      extra: { R2: r2 },
    });
    expect(res.status).toBe(200);
    expect(r2.deleted.flat()).toContain("feedback/2026-05/cu.jpg");
    expect(r2.objects.size).toBe(0);
  });
});
