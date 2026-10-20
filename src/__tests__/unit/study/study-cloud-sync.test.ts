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

describe("Mốc 2 — Pre-pass Merge Ghi chú & Cứu bài khi xung đột (Task 2.3)", () => {
  const noteKey = "huflit_study_multi_notes";

  it("server xóa ghi chú (tombstone) nhưng local có sửa offline -> xóa thắng và sinh bản sao cứu bài tất định", () => {
    const serverNote = [{ id: "n1", title: "Note 1", content: "", updatedAt: 2000, deletedAt: 2000 }];
    const localNote = [{ id: "n1", title: "Note 1", content: "Sửa quan trọng offline", updatedAt: 3000 }];

    const r = planSync({
      keys: [noteKey],
      local: { [noteKey]: JSON.stringify(localNote) },
      server: { [noteKey]: JSON.stringify(serverNote) },
      serverUpdated: { [noteKey]: 2000 },
      meta: { [noteKey]: { local: 3000, synced: 1000, dirty: true } },
      now: 4000,
    });

    const parsedApply = JSON.parse(r.apply[noteKey]);
    expect(parsedApply.length).toBe(2);

    // 1. Bản gốc giữ tombstone xóa
    const orig = parsedApply.find((n: any) => n.id === "n1");
    expect(orig).toBeDefined();
    expect(orig.deletedAt).toBe(2000);

    // 2. Bản sao cứu bài với id tất định chứa ~conflict~
    const rescued = parsedApply.find((n: any) => n.id.startsWith("n1~conflict~"));
    expect(rescued).toBeDefined();
    expect(rescued.content).toBe("Sửa quan trọng offline");
    expect(rescued.title).toContain("[Bản sao ghi chú đã xóa");
    expect(rescued.deletedAt).toBeUndefined();
  });

  it("cả hai bên cùng sửa nội dung khác nhau -> server làm chủ và local được cứu thành bản sao xung đột", () => {
    const serverNote = [{ id: "n2", title: "Task list", content: "Nội dung server A", updatedAt: 2500 }];
    const localNote = [{ id: "n2", title: "Task list", content: "Nội dung máy local B", updatedAt: 2600 }];

    const r = planSync({
      keys: [noteKey],
      local: { [noteKey]: JSON.stringify(localNote) },
      server: { [noteKey]: JSON.stringify(serverNote) },
      serverUpdated: { [noteKey]: 2500 },
      meta: { [noteKey]: { local: 2600, synced: 2000, dirty: true } },
      now: 4000,
    });

    const parsed = JSON.parse(r.apply[noteKey]);
    expect(parsed.length).toBe(2);

    // 1. Bản chính mang nội dung server
    const main = parsed.find((n: any) => n.id === "n2");
    expect(main.content).toBe("Nội dung server A");

    // 2. Bản sao cứu nội dung local
    const conflict = parsed.find((n: any) => n.id.startsWith("n2~conflict~"));
    expect(conflict).toBeDefined();
    expect(conflict.content).toBe("Nội dung máy local B");
    expect(conflict.title).toContain("[Bản sao xung đột");
  });

  it("cả hai bên cùng sửa nhưng cùng nội dung -> không sinh bản sao xung đột", () => {
    const serverNote = [{ id: "n3", title: "Test", content: "Giống nhau", updatedAt: 2000 }];
    const localNote = [{ id: "n3", title: "Test", content: "Giống nhau", updatedAt: 3000 }];

    const r = planSync({
      keys: [noteKey],
      local: { [noteKey]: JSON.stringify(localNote) },
      server: { [noteKey]: JSON.stringify(serverNote) },
      serverUpdated: { [noteKey]: 2000 },
      meta: { [noteKey]: { local: 3000, synced: 2000 } },
      now: 4000,
    });

    const parsed = JSON.parse(r.push[noteKey] || r.apply[noteKey] || "[]");
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe("n3");
    expect(parsed[0].updatedAt).toBe(3000);
  });
});

describe("Mốc 2 — Lệch đồng hồ & Cờ dirty (Task 2.4)", () => {
  it("máy khách chạy chậm 15 phút (mốc local nhỏ hơn server) nhưng có cờ dirty -> đẩy lên mạng, không bị đè mất bài", () => {
    const r = planSync({
      keys: ["k_drift"],
      local: { k_drift: "Nội dung vừa gõ ở máy chạy chậm" },
      server: { k_drift: "Nội dung cũ trên server" },
      serverUpdated: { k_drift: 10_000 }, // Server mốc 10.000
      meta: {
        k_drift: {
          local: 1_000, // Đồng hồ máy chỉ 1.000 (chậm hơn server rất nhiều)
          synced: 10_000, // Đã từng sync ở mốc 10.000
          dirty: true, // Người dùng vừa gõ sửa
        },
      },
      now: 20_000,
    });

    // Nhờ cờ dirty, máy khách giữ bản máy và đẩy lên server
    expect(r.push).toEqual({ k_drift: "Nội dung vừa gõ ở máy chạy chậm" });
    expect(r.apply).toEqual({});
  });
});

describe("Mốc 2 — Delta Sync Semantics (Task 2.5)", () => {
  it("server chỉ trả key k1 thay đổi, k2 không có trong delta response và không dirty -> k2 không bị push oan và giữ nguyên", () => {
    const r = planSync({
      keys: ["k1", "k2"],
      local: { k1: "old_local", k2: "untouched_local" },
      server: { k1: "new_server", k2: null }, // Delta GET: k2 không xuất hiện trên server
      serverUpdated: { k1: 5000, k2: 0 },
      meta: {
        k1: { local: 1000, synced: 1000, dirty: false },
        k2: { local: 1000, synced: 1000, dirty: false },
      },
      now: 10_000,
      isDelta: true,
    });

    // k1 được cập nhật từ server
    expect(r.apply.k1).toBe("new_server");
    // k2 không bị xóa và không bị ghi đè
    expect(r.apply.k2).toBeUndefined();
    expect(r.remove).not.toContain("k2");
    // QUAN TRỌNG: k2 KHÔNG được push lên server vì không có cờ dirty
    expect(r.push.k2).toBeUndefined();
  });

  it("trong delta sync, nếu key k2 vắng mặt trên server nhưng máy có sửa (dirty = true) thì vẫn push", () => {
    const r = planSync({
      keys: ["k1", "k2"],
      local: { k1: "old_local", k2: "edited_local" },
      server: { k1: "new_server", k2: null },
      serverUpdated: { k1: 5000, k2: 0 },
      meta: {
        k1: { local: 1000, synced: 1000, dirty: false },
        k2: { local: 8000, synced: 1000, dirty: true },
      },
      now: 10_000,
      isDelta: true,
    });

    expect(r.push.k2).toBe("edited_local");
    expect(r.apply.k1).toBe("new_server");
  });
});
