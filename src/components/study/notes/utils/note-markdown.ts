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

/**
 * Chuyển đổi nội dung HTML của ghi chú thành văn bản sạch sẽ (giữ checklist, đề mục, ngắt dòng)
 * dùng để gửi cho AI Chatbot.
 */
export function noteHtmlToPlainText(html: string): string {
  if (!html) return "";

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n")
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n")
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n")
      .replace(/<div class="todo-item"[^>]*>[\s\S]*?checked[\s\S]*?<span[^>]*>(.*?)<\/span><\/div>/gi, "\n- [x] $1\n")
      .replace(/<div class="todo-item"[^>]*>[\s\S]*?<span[^>]*>(.*?)<\/span><\/div>/gi, "\n- [ ] $1\n")
      .replace(/<li[^>]*>(.*?)<\/li>/gi, "\n- $1\n")
      .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, "\n> $1\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\n\s*\n+/g, "\n\n")
      .trim();
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild ?? doc.body;

  // 1. Checklist
  root.querySelectorAll(".todo-item").forEach((todo) => {
    const input = todo.querySelector("input[type='checkbox']") as HTMLInputElement | null;
    const isChecked = input?.checked || input?.hasAttribute("checked") || input?.getAttribute("checked") === "true";
    const checkSign = isChecked ? "[x]" : "[ ]";
    const text = todo.textContent?.trim() || "";
    const p = doc.createElement("div");
    p.textContent = `\n- ${checkSign} ${text}\n`;
    todo.replaceWith(p);
  });

  // 2. Headings
  root.querySelectorAll("h1, h2, h3").forEach((h) => {
    const prefix = h.tagName.toLowerCase() === "h1" ? "# " : h.tagName.toLowerCase() === "h2" ? "## " : "### ";
    const text = h.textContent?.trim() || "";
    const p = doc.createElement("div");
    p.textContent = `\n${prefix}${text}\n`;
    h.replaceWith(p);
  });

  // 3. Lists
  root.querySelectorAll("li").forEach((li) => {
    const text = li.textContent?.trim() || "";
    const p = doc.createElement("div");
    p.textContent = `\n- ${text}\n`;
    li.replaceWith(p);
  });

  // 4. Blockquotes
  root.querySelectorAll("blockquote").forEach((bq) => {
    const text = bq.textContent?.trim() || "";
    const p = doc.createElement("div");
    p.textContent = `\n> ${text}\n`;
    bq.replaceWith(p);
  });

  // 5. Code blocks
  root.querySelectorAll("pre").forEach((pre) => {
    const code = pre.textContent?.trim() || "";
    const p = doc.createElement("div");
    p.textContent = `\n\`\`\`\n${code}\n\`\`\`\n`;
    pre.replaceWith(p);
  });

  // 6. Paragraphs & br
  root.querySelectorAll("p, br").forEach((el) => {
    if (el.tagName.toLowerCase() === "br") {
      el.replaceWith(doc.createTextNode("\n"));
    } else {
      el.prepend(doc.createTextNode("\n"));
      el.append(doc.createTextNode("\n"));
    }
  });

  return (root.textContent || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
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
  // Ghi chú cũ có thể chứa HTML lạ (dán từ web khác): lọc lại cho sạch
  return sanitizeRichHtml(sanitized);
}

// Thẻ cho phép trong ghi chú (giữ todo + định dạng cơ bản, bỏ hết cái khác)
const ALLOWED_NOTE_TAGS = new Set([
  "p", "br", "div", "span", "ul", "ol", "li",
  "h1", "h2", "h3", "blockquote", "pre", "code",
  "strong", "em", "u", "s", "b", "i", "a", "input", "mark",
  "table", "thead", "tbody", "tr", "th", "td", "hr",
]);
// Thẻ nguy hiểm: xóa cả thẻ lẫn nội dung bên trong
const DROP_NOTE_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "link", "meta",
  "base", "form", "button", "select", "textarea", "video", "audio",
  "img", "picture", "source", "canvas", "svg", "math", "noscript",
  "template", "slot", "head", "html", "body",
]);
// Class giữ lại (todo của app); class rác từ Word/web khác bỏ hết
const ALLOWED_NOTE_CLASSES = new Set(["todo-item", "todo-checkbox", "todo-checked-text", "study-highlight"]);
const SAFE_URL_PATTERN = /^(https?:|mailto:)/i;
const MAX_PASTE_CHARS = 100000;

/**
 * Lọc HTML bẩn (dán từ Word/trang web) theo danh sách cho phép:
 * bỏ script/iframe/hình, bỏ sự kiện on*, bỏ link javascript:, bỏ style.
 * Giữ nguyên todo + định dạng chữ của app.
 */
export function sanitizeRichHtml(dirty: string): string {
  if (!dirty) return "<p><br></p>";
  const html = dirty.length > MAX_PASTE_CHARS ? dirty.slice(0, MAX_PASTE_CHARS) : dirty;

  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html
      .replace(/<(script|style|iframe|object|embed|link|meta|base|form|img|video|audio|svg)[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<(script|style|iframe|object|embed|link|meta|base|form|img|video|audio|svg)[^>]*\/?>/gi, "")
      .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild ?? doc.body;

  const cleanElement = (el: Element): void => {
    const tag = el.localName.toLowerCase();
    const parent = el.parentNode;
    if (!parent) return;

    if (!ALLOWED_NOTE_TAGS.has(tag)) {
      if (DROP_NOTE_TAGS.has(tag)) {
        parent.removeChild(el);
      } else {
        // Thẻ lạ nhưng vô hại (font, o:p...): giữ chữ, bỏ vỏ —
        // rồi lọc tiếp từng node vừa chuyển ra (khỏi lọt thẻ độc lồng bên trong)
        const moved: ChildNode[] = [];
        while (el.firstChild) {
          moved.push(el.firstChild);
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
        for (const m of moved) {
          if (m instanceof Element) cleanElement(m);
        }
      }
      return;
    }

    // Tô vàng kiểu cũ (span style nền vàng) → đổi sang mark của app cho gọn
    if ((tag === "span" || tag === "font") && /background(-color)?\s*:[^;]*(250,\s*204,\s*21|251,\s*191,\s*36|254,\s*240,\s*138|yellow)/i.test(el.getAttribute("style") || "")) {
      const mark = doc.createElement("mark");
      mark.setAttribute("class", "study-highlight");
      while (el.firstChild) mark.appendChild(el.firstChild);
      parent.replaceChild(mark, el);
      for (const child of Array.from(mark.children)) cleanElement(child);
      return;
    }

    // input chỉ giữ checkbox của todo
    if (tag === "input") {      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type !== "checkbox") {
        parent.removeChild(el);
        return;
      }
      for (const name of [...el.attributes].map((a) => a.name)) {
        if (name !== "type" && name !== "checked" && name !== "class") el.removeAttribute(name);
      }
    } else if (tag === "a") {
      const href = el.getAttribute("href") || "";
      for (const name of [...el.attributes].map((a) => a.name)) el.removeAttribute(name);
      if (SAFE_URL_PATTERN.test(href.trim())) el.setAttribute("href", href.trim());
    } else {
      for (const name of [...el.attributes].map((a) => a.name)) {
        if (name === "class") continue;
        el.removeAttribute(name);
      }
    }

    // Lọc class: chỉ giữ class của app
    if (el.hasAttribute("class")) {
      const kept = (el.getAttribute("class") || "")
        .split(/\s+/)
        .filter((c) => ALLOWED_NOTE_CLASSES.has(c));
      if (kept.length > 0) el.setAttribute("class", kept.join(" "));
      else el.removeAttribute("class");
    }

    for (const child of Array.from(el.children)) cleanElement(child);
  };

  for (const child of Array.from(root.children)) cleanElement(child);
  // Bỏ input[type=hidden]... (đề phòng) — thực tế đã chặn ở trên
  return root.innerHTML.trim() || "<p><br></p>";
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

  // Bold, Italic, Inline Code, Strikethrough
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  text = text.replace(/~~([^~]+)~~/g, "<s>$1</s>");

  // Gạch ngang --- / ***
  text = text.replace(/^\s*(---|\*\*\*)\s*$/gim, "<hr>");

  // Bảng GFM: các dòng | ... | liên tiếp, dòng 2 là vạch | --- |
  text = text.replace(/((?:^\s*\|.*\|\s*$\n?){2,})/gim, (block) => {
    const rows = block
      .trim()
      .split(/\r?\n/)
      .map((r) =>
        r
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim())
      );
    if (rows.length < 2 || !rows[1].every((c) => /^:?-{1,}:?$/.test(c))) return block;
    const head = rows[0].map((c) => `<th>${c}</th>`).join("");
    const body = rows
      .slice(2)
      .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
      .join("");
    return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  });

  // List theo cụm dòng liên tiếp: cùng có thứ tự -> <ol>, còn lại -> <ul>
  // Dấu đầu dòng chấp nhận -, *, + (giữ chỗ checklist - [ ] đã đổi ở trên)
  text = text.replace(/((?:^\s*(?:[-*+]|\d+\.)\s+.*$\n?)+)/gim, (block) => {
    const lines = block.trim().split(/\r?\n/);
    const ordered = lines.every((l) => /^\s*\d+\.\s+/.test(l));
    const items = lines
      .map((l) => l.replace(/^\s*(?:[-*+]|\d+\.)\s+/, "").trim())
      .filter(Boolean)
      .map((c) => `<li>${c}</li>`)
      .join("");
    return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
  });

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
        trimmed.startsWith("<li") ||
        trimmed.startsWith("<table") ||
        trimmed.startsWith("<hr")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

// Đoán văn bản dán vào có phải markdown không (để đổi sang định dạng,
// chứ chữ thường thì giữ nguyên không động vào).
export function looksLikeMarkdown(text: string): boolean {
  if (!text) return false;
  return (
    /^#{1,3}\s+\S/m.test(text) || // # Tiêu đề
    /^>\s*\S/m.test(text) || // > Trích dẫn
    /```/.test(text) || // khối code
    /^\s*[-*+]\s+\S/m.test(text) || // gạch đầu dòng
    /^\s*\d+\.\s+\S/m.test(text) || // danh sách số
    /^\s*[-*+]\s+\[[ xX]\]/m.test(text) || // checklist
    /^\s*\|.*\|\s*$/m.test(text) || // bảng
    /\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|~~[^~]+~~/.test(text) // đậm/nghiêng/code/gạch
  );
}
