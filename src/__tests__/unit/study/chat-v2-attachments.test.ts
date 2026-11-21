import { describe, expect, it } from "vitest";
import {
  appendFilesToLastUser,
  attachImagesToLastUser,
  parseAttachments,
} from "../../../../workers/chat-v2/attachments.js";

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";

describe("chat v2 attachments", () => {
  it("nhận ảnh và file text hợp lệ", () => {
    const parsed = parseAttachments({
      images: [{ name: "de.png", data: PIXEL }],
      files: [{ name: "bai.md", text: "Nội dung bài" }],
    });
    expect(parsed.error).toBeUndefined();
    expect(parsed.images![0]).toMatchObject({ name: "de.png", mime: "image/png" });
    expect(parsed.files![0]).toEqual({ name: "bai.md", text: "Nội dung bài" });
  });

  it("chặn quá số ảnh và file quá dài", () => {
    expect(
      parseAttachments({ images: Array.from({ length: 4 }, () => ({ name: "a.png", data: PIXEL })) }).error
    ).toContain("Tối đa 3 ảnh");
    expect(parseAttachments({ files: [{ name: "a.txt", text: "x".repeat(20001) }] }).error).toContain(
      "quá dài"
    );
  });

  it("nối file vào câu hỏi với nhãn tài liệu tham khảo", () => {
    const messages = appendFilesToLastUser(
      [{ role: "user", content: "Đọc file này" }],
      [{ name: "a.txt", text: "nội dung" }]
    );
    expect(messages[0].content).toContain("[Nội dung file a.txt");
    expect(messages[0].content).toContain("nội dung");
  });

  it("gắn ảnh vào content của câu hỏi cuối", () => {
    const messages = attachImagesToLastUser(
      [{ role: "user", content: "Xem ảnh" }],
      [{ name: "a.png", mime: "image/png", data: "AAAA" }]
    );
    const content = messages[0].content as Array<Record<string, unknown>>;
    expect(content[0]).toEqual({ type: "text", text: "Xem ảnh" });
    expect(content[1]).toMatchObject({
      type: "image_url",
      image_url: { url: "data:image/png;base64,AAAA" },
    });
  });
});
