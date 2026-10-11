import { describe, it, expect } from "vitest";
import { createSeekMemory } from "@/lib/youtube-player-api";

describe("youtube seek memory", () => {
  it("nhớ và khôi phục 1 lần (consume xóa sau khi đọc)", () => {
    const mem = createSeekMemory();
    mem.remember("vid-1", 612.7);
    expect(mem.consume("vid-1")).toBe(612);
    expect(mem.consume("vid-1")).toBeNull();
  });

  it("bỏ qua thời gian quá ngắn và key rỗng", () => {
    const mem = createSeekMemory();
    mem.remember("vid-1", 1.5);
    mem.remember("", 600);
    expect(mem.size()).toBe(0);
  });

  it("hết hạn sau TTL (mở lại video cũ hôm sau phát từ đầu)", () => {
    let t = 1_000_000;
    const mem = createSeekMemory({ ttlMs: 60_000, now: () => t });
    mem.remember("vid-1", 600);
    expect(mem.consume("vid-1")).toBe(600);

    mem.remember("vid-1", 600);
    t += 61_000;
    expect(mem.consume("vid-1")).toBeNull();
  });

  it("giới hạn số entry để khỏi rò rỉ", () => {
    const mem = createSeekMemory({ maxEntries: 3 });
    mem.remember("a", 10);
    mem.remember("b", 20);
    mem.remember("c", 30);
    mem.remember("d", 40);
    expect(mem.size()).toBe(3);
    expect(mem.consume("a")).toBeNull();
    expect(mem.consume("d")).toBe(40);
  });

  it("peek không xóa entry", () => {
    const mem = createSeekMemory();
    mem.remember("vid-1", 100);
    expect(mem.peek("vid-1")).toBe(100);
    expect(mem.consume("vid-1")).toBe(100);
  });
});
