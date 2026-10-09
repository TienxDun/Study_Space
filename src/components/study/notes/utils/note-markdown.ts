// Helper to strip HTML tags and decode entities for clean sidebar card excerpts
export function getNoteExcerpt(content: string, maxLength: number = 55): string {
  if (!content) return "Chưa có nội dung...";

  // 1. Remove style, script, and HTML tags
  let text = content
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ");

  // 2. Decode standard HTML entities
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, "/");

  // 3. Strip leading blockquote indicators (>), quotes, dashes, bullets, or hashes
  text = text.replace(/^[>\s•*#\-"'“”«»]+/g, "").replace(/["'“”«»]+$/g, "");

  // 4. Normalize multiple whitespaces
  text = text.replace(/\s+/g, " ").trim();

  if (!text) return "Chưa có nội dung...";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
}

// Helper to sanitize and fix notes stored previously with unrendered blockquotes or language identifiers
export function sanitizeStoredNoteContent(rawContent: string): string {
  if (!rawContent) return "<p><br></p>";
  let sanitized = rawContent;
  // Convert any corrupted <p>&gt; ...</p> into <blockquote>
  sanitized = sanitized.replace(/<p>&gt;\s*(.*?)<\/p>/gi, "<blockquote>$1</blockquote>");
  // Clean raw entity prefixes
  sanitized = sanitized.replace(/&gt;\s*💡/g, "💡");
  sanitized = sanitized.replace(/&gt;\s*🚀/g, "🚀");
  sanitized = sanitized.replace(/&gt;\s*•/g, "•");
  // Clean stray language identifier in <pre><code>
  sanitized = sanitized.replace(/<pre><code>typescript\s*\n?/gi, "<pre><code>");
  sanitized = sanitized.replace(/<pre><code>javascript\s*\n?/gi, "<pre><code>");
  return sanitized;
}

// Helper to convert legacy markdown text into clean rich HTML for Word-like rendering
export function markdownToHtml(md: string): string {
  if (!md) return "<p><br></p>";

  const cleaned = md
    .replace(/#fef08a/g, "rgba(251, 191, 36, 0.25)")
    .replace(/#ffff00/g, "rgba(251, 191, 36, 0.25)");

  // If already clean HTML and without unrendered markdown blockquote symbols
  if (/<[a-z][\s\S]*>/i.test(cleaned) && !/(&gt;|^>)\s/m.test(cleaned)) {
    return cleaned;
  }

  // Pre-process: Extract and protect code blocks (and strip language identifier from body)
  const codeBlocks: string[] = [];
  let text = cleaned.replace(/```(?:[a-zA-Z0-9_-]+)?\s*\n?([\s\S]*?)```/g, (_, code) => {
    const escapedCode = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code>${escapedCode}</code></pre>`);
    return placeholder;
  });

  // Escape HTML in the rest of markdown
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Blockquotes: match consecutive lines starting with &gt; or > and wrap in <blockquote>
  text = text.replace(/(?:^&gt;\s?.*$\n?)+/gim, (match) => {
    const inner = match
      .split(/\r?\n/)
      .map((line) => line.replace(/^&gt;\s?/, "").trim())
      .filter(Boolean)
      .join("<br>");
    return `<blockquote>${inner}</blockquote>\n\n`;
  });

  // Headers
  text = text.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  text = text.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  text = text.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Checklists (Strictly 1-level flat)
  text = text.replace(
    /^\s*- \[x\] (.*$)/gim,
    '<div class="todo-item"><input type="checkbox" checked="true" class="todo-checkbox" /><span class="todo-checked-text">$1</span></div>'
  );
  text = text.replace(
    /^\s*- \[ \] (.*$)/gim,
    '<div class="todo-item"><input type="checkbox" class="todo-checkbox" /><span>$1</span></div>'
  );

  // Bold, Italic, Inline Code
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Nested bullets (sub-levels with 2 or 4 spaces indent)
  text = text.replace(
    /^ {2,4}- (.*$)/gim,
    '<ul style="list-style-type:circle;padding-left:1.4rem;margin:0.2rem 0;"><li>$1</li></ul>'
  );

  // Top-level bullet items
  text = text.replace(/^- (.*$)/gim, "<li>$1</li>");

  // Group consecutive loose <li> items into <ul>
  text = text.replace(/(?:<li>[\s\S]*?<\/li>\n?)+/gim, (match) => `<ul>${match}</ul>`);

  // Restore code blocks
  codeBlocks.forEach((cb, idx) => {
    text = text.replace(`__CODE_BLOCK_${idx}__`, cb);
  });

  // Line breaks to paragraphs / br
  const paragraphs = text.split(/\n\n+/);
  return paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("<pre") ||
        trimmed.startsWith("<div") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<ol") ||
        trimmed.startsWith("<li")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}
