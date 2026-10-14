import { describe, it, expect } from "vitest";
import {
  getNoteExcerpt,
  sanitizeStoredNoteContent,
  markdownToHtml,
  looksLikeMarkdown,
  noteHtmlToPlainText,
} from "../../../components/study/notes/utils/note-markdown";

describe("Study Notes Markdown & Excerpt Utilities", () => {
  describe("getNoteExcerpt", () => {
    it("should return default text if content is empty", () => {
      expect(getNoteExcerpt("")).toBe("Chưa có nội dung...");
      expect(getNoteExcerpt("   ")).toBe("Chưa có nội dung...");
    });

    it("should strip HTML tags and decode HTML entities", () => {
      const html = "<p>Xin chào &amp; chúc <strong>ngày mới</strong> tốt lành!</p>";
      const excerpt = getNoteExcerpt(html, 100);
      expect(excerpt).toBe("Xin chào & chúc ngày mới tốt lành!");
    });

    it("should truncate long text with ellipsis", () => {
      const longText = "Đây là một đoạn văn bản rất dài được viết nhằm mục đích kiểm tra khả năng cắt ngắn chuỗi.";
      const excerpt = getNoteExcerpt(longText, 25);
      expect(excerpt.length).toBeLessThanOrEqual(28);
      expect(excerpt.endsWith("...")).toBe(true);
    });

    it("should strip markdown quotes and leading symbols", () => {
      const text = "> *Đây là trích dẫn quan trọng*";
      const excerpt = getNoteExcerpt(text, 100);
      expect(excerpt.startsWith(">")).toBe(false);
    });
  });

  describe("sanitizeStoredNoteContent", () => {
    it("should return empty paragraph for empty content", () => {
      expect(sanitizeStoredNoteContent("")).toBe("<p><br></p>");
    });

    it("should convert corrupted <p>&gt; into <blockquote>", () => {
      const corrupted = "<p>&gt; Nội dung trích dẫn</p>";
      const sanitized = sanitizeStoredNoteContent(corrupted);
      expect(sanitized).toBe("<blockquote>Nội dung trích dẫn</blockquote>");
    });

    it("should clean stray language identifiers in pre/code blocks", () => {
      const input = "<pre><code>typescript\nconst a = 1;</code></pre>";
      const sanitized = sanitizeStoredNoteContent(input);
      expect(sanitized).toContain("<pre><code>");
      expect(sanitized).not.toContain("typescript\n");
    });
  });

  describe("markdownToHtml", () => {
    it("should handle empty markdown gracefully", () => {
      expect(markdownToHtml("")).toBe("<p><br></p>");
    });

    it("should convert headers correctly", () => {
      const md = "# Tiêu đề 1\n\n## Tiêu đề 2\n\n### Tiêu đề 3";
      const html = markdownToHtml(md);
      expect(html).toContain("<h1>Tiêu đề 1</h1>");
      expect(html).toContain("<h2>Tiêu đề 2</h2>");
      expect(html).toContain("<h3>Tiêu đề 3</h3>");
    });

    it("should convert bold, italic, and inline code", () => {
      const md = "**in đậm** và *in nghiêng* và `mã nguồn`";
      const html = markdownToHtml(md);
      expect(html).toContain("<strong>in đậm</strong>");
      expect(html).toContain("<em>in nghiêng</em>");
      expect(html).toContain("<code>mã nguồn</code>");
    });

    it("should convert markdown checklists into interactive checkboxes", () => {
      const md = "- [x] Nhiệm vụ đã xong\n- [ ] Nhiệm vụ chưa xong";
      const html = markdownToHtml(md);
      expect(html).toContain('checked="true"');
      expect(html).toContain("todo-checked-text");
      expect(html).toContain("Nhiệm vụ đã xong");
      expect(html).toContain("Nhiệm vụ chưa xong");
    });

    it("should convert indented markdown checklists into 1-level flat interactive checkboxes", () => {
      const md = "- [ ] Việc 1\n  - [ ] Việc 2 con\n    - [ ] Việc 3 cháu";
      const html = markdownToHtml(md);
      expect(html).toContain("Việc 1");
      expect(html).toContain("Việc 2 con");
      expect(html).toContain("Việc 3 cháu");
      // All 3 should be converted to .todo-item
      const matches = html.match(/class="todo-item"/g);
      expect(matches?.length).toBe(3);
    });

    it("should wrap code fences in pre and code tags", () => {
      const md = "```\nconst x = 42;\n```";
      const html = markdownToHtml(md);
      expect(html).toContain("<pre><code>const x = 42;\n</code></pre>");
    });

    it("should convert ordered lists into ol", () => {
      const md = "1. Bước một\n2. Bước hai\n3. Bước ba";
      const html = markdownToHtml(md);
      expect(html).toContain("<ol>");
      expect(html).toContain("<li>Bước một</li>");
      expect(html).toContain("<li>Bước ba</li>");
    });

    it("should convert star and plus bullets into ul", () => {
      const md = "* Việc một\n+ Việc hai";
      const html = markdownToHtml(md);
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>Việc một</li>");
      expect(html).toContain("<li>Việc hai</li>");
    });

    it("should convert GFM tables into table elements", () => {
      const md = "| Tên | Tuổi |\n| --- | --- |\n| An | 20 |";
      const html = markdownToHtml(md);
      expect(html).toContain("<table>");
      expect(html).toContain("<th>Tên</th>");
      expect(html).toContain("<td>20</td>");
    });

    it("should convert hr and strikethrough", () => {
      const html = markdownToHtml("---\n~~xóa~~");
      expect(html).toContain("<hr>");
      expect(html).toContain("<s>xóa</s>");
    });
  });

  describe("looksLikeMarkdown", () => {
    it("should detect markdown syntax", () => {
      expect(looksLikeMarkdown("# Tiêu đề")).toBe(true);
      expect(looksLikeMarkdown("- Việc 1\n- Việc 2")).toBe(true);
      expect(looksLikeMarkdown("1. Bước một\n2. Bước hai")).toBe(true);
      expect(looksLikeMarkdown("Chào **bạn** nhé")).toBe(true);
      expect(looksLikeMarkdown("| A | B |\n| --- | --- |")).toBe(true);
    });

    it("should leave plain text alone", () => {
      expect(looksLikeMarkdown("")).toBe(false);
      expect(looksLikeMarkdown("Hôm nay trời đẹp quá")).toBe(false);
      expect(looksLikeMarkdown("Mua 2 quả trứng và sữa")).toBe(false);
    });
  });

  describe("noteHtmlToPlainText", () => {
    it("should return empty string for empty input", () => {
      expect(noteHtmlToPlainText("")).toBe("");
    });

    it("should convert rich note HTML with headers, lists, and checklists into clean plain text for AI", () => {
      const html = "<h1>Ôn tập Toán</h1><p>Khái niệm ma trận.</p><div class=\"todo-item\"><input type=\"checkbox\" checked=\"true\" class=\"todo-checkbox\" /><span class=\"todo-checked-text\">Làm bài tập trang 20</span></div>";
      const plain = noteHtmlToPlainText(html);
      expect(plain).toContain("# Ôn tập Toán");
      expect(plain).toContain("Khái niệm ma trận.");
      expect(plain).toContain("- [x] Làm bài tập trang 20");
    });
  });
});
