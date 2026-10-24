import { describe, expect, it, vi } from "vitest";
import { logAudit, type AdminEnv } from "../../../../admin-worker/_worker";

type Db = NonNullable<AdminEnv["DB"]>;

function stubDb(run = vi.fn(async () => ({ success: true }))) {
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));
  const db = { prepare } as unknown as Db;
  return { db, prepare, bind, run };
}

describe("logAudit", () => {
  it("ghi đủ cột và thời điểm dạng số", async () => {
    const { db, prepare, bind } = stubDb();

    const ok = await logAudit(
      { DB: db },
      {
        actor: "admin@example.com",
        action: "scene.update",
        target: "scenes.json",
        detail: { id: "rain" },
      },
    );

    expect(ok).toBe(true);
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO admin_audit"),
    );
    expect(bind).toHaveBeenCalledWith(
      "admin@example.com",
      "scene.update",
      "scenes.json",
      '{"id":"rain"}',
      expect.any(Number),
    );
  });

  it("detail không có thì ghi null", async () => {
    const { db, bind } = stubDb();

    await logAudit({ DB: db }, { actor: "admin@example.com", action: "ping" });

    expect(bind).toHaveBeenCalledWith(
      "admin@example.com",
      "ping",
      null,
      null,
      expect.any(Number),
    );
  });

  it("thiếu binding DB thì trả false, không ném lỗi", async () => {
    await expect(
      logAudit({}, { actor: "admin@example.com", action: "ping" }),
    ).resolves.toBe(false);
  });

  it("D1 lỗi thì trả false để caller chặn hành động", async () => {
    const { db } = stubDb(vi.fn(async () => {
      throw new Error("D1 hỏng");
    }));

    const ok = await logAudit(
      { DB: db },
      { actor: "admin@example.com", action: "ping" },
    );

    expect(ok).toBe(false);
  });
});
