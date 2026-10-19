import { describe, it, expect } from "vitest";
import { planSync, type CloudMeta } from "@/lib/cloud-sync";

const TOL = 2000;

function plan(opts: {
  local: Record<string, string | null>;
  server: Record<string, string | null>;
  serverUpdated?: Record<string, number>;
  meta?: CloudMeta;
  now?: number;
  unionKeys?: Set<string>;
}) {
  return planSync({
    keys: Object.keys({ ...opts.local, ...opts.server }),
    local: opts.local,
    server: opts.server,
    serverUpdated: opts.serverUpdated || {},
    meta: opts.meta || {},
    now: opts.now ?? 10_000,
    tol: TOL,
    unionKeys: opts.unionKeys,
  });
}

describe("planSync — bản mới nhất thắng", () => {
  it("máy mới (máy trống, mạng có dữ liệu) thì kéo về", () => {
    const r = plan({ local: { k: null }, server: { k: "S" }, serverUpdated: { k: 5000 } });
    expect(r.apply).toEqual({ k: "S" });
    expect(r.push).toEqual({});
    expect(r.meta.k).toEqual({ local: 5000, synced: 5000 });
  });

  it("máy có dữ liệu, mạng trống thì đẩy lên", () => {
    const r = plan({ local: { k: "L" }, server: { k: null } });
    expect(r.push).toEqual({ k: "L" });
    expect(r.apply).toEqual({});
  });

  it("mạng mới hơn hẳn thì lấy bản mạng", () => {
    const r = plan({
      local: { k: "L" },
      server: { k: "S" },
      serverUpdated: { k: 5000 },
      meta: { k: { local: 1000, synced: 1000 } },
    });
    expect(r.apply).toEqual({ k: "S" });
    expect(r.push).toEqual({});
  });

  it("máy mới hơn hẳn thì giữ bản máy và đẩy lên", () => {
    const r = plan({
      local: { k: "L" },
      server: { k: "S" },
      serverUpdated: { k: 5000 },
      meta: { k: { local: 9000, synced: 1000 } },
    });
    expect(r.push).toEqual({ k: "L" });
    expect(r.apply).toEqual({});
  });

  it("lệch trong ngưỡng dung sai thì ưu tiên bản đang mở", () => {
    const r = plan({
      local: { k: "L" },
      server: { k: "S" },
      serverUpdated: { k: 6000 },
      meta: { k: { local: 5000, synced: 1000 } },
    });
    expect(r.push).toEqual({ k: "L" });
    expect(r.apply).toEqual({});
  });

  it("hai bên giống nhau thì không làm gì", () => {
    const r = plan({
      local: { k: "X" },
      server: { k: "X" },
      serverUpdated: { k: 1000 },
      meta: { k: { local: 1000, synced: 1000 } },
    });
    expect(r.apply).toEqual({});
    expect(r.push).toEqual({});
    expect(r.remove).toEqual([]);
  });

  it("xóa ở máy (có ý định xóa) thì xóa trên mạng", () => {
    const r = plan({
      local: { k: null },
      server: { k: "S" },
      serverUpdated: { k: 5000 },
      meta: { k: { local: 9000, synced: 1000, del: true } },
    });
    expect(r.remove).toEqual(["k"]);
    expect(r.apply).toEqual({});
  });

  it("máy không có key nhưng không có ý định xóa thì kéo về", () => {
    const r = plan({
      local: { k: null },
      server: { k: "S" },
      serverUpdated: { k: 5000 },
      meta: { k: { local: 9000, synced: 1000, del: false } },
    });
    expect(r.apply).toEqual({ k: "S" });
    expect(r.remove).toEqual([]);
  });

  it("máy kia đã sửa mới hơn lệnh xóa thì giữ bản mới của mạng", () => {
    const r = plan({
      local: { k: null },
      server: { k: "S" },
      serverUpdated: { k: 12000 },
      meta: { k: { local: 9000, synced: 1000, del: true } },
    });
    expect(r.apply).toEqual({ k: "S" });
    expect(r.remove).toEqual([]);
  });
});

describe("planSync — gộp phiên tập trung theo id", () => {
  const unionKeys = new Set(["focus"]);
  const a = JSON.stringify([{ id: "a", startedAt: 10 }]);
  const b = JSON.stringify([{ id: "b", startedAt: 20 }]);

  it("gộp phiên của cả hai máy, không mất bên nào", () => {
    const r = plan({
      local: { focus: b },
      server: { focus: a },
      serverUpdated: { focus: 1000 },
      unionKeys,
    });
    const merged = JSON.parse(r.push.focus || "[]");
    expect(merged.map((s: { id: string }) => s.id)).toEqual(["a", "b"]);
    expect(r.apply.focus).toBe(r.push.focus);
  });

  it("phiên trùng id thì giữ một bản, không nhân đôi", () => {
    const r = plan({
      local: { focus: a },
      server: { focus: a },
      serverUpdated: { focus: 1000 },
      unionKeys,
    });
    expect(r.push.focus).toBeUndefined();
    expect(r.apply.focus).toBeUndefined();
  });

  it("máy mới lấy toàn bộ phiên của mạng", () => {
    const r = plan({ local: { focus: null }, server: { focus: a }, serverUpdated: { focus: 1000 }, unionKeys });
    expect(r.apply.focus).toBe(a);
  });
});
