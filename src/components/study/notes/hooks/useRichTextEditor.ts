"use client";

import { useState, useRef, useCallback } from "react";
import { ActiveFormats } from "../types";
import { sanitizeRichHtml, markdownToHtml, looksLikeMarkdown } from "../utils/note-markdown";

interface UseRichTextEditorProps {
  onContentChange: (newHtml: string) => void;
}

/**
 * Đảm bảo mọi mục checklist (.todo-item) luôn ở đúng 1 cấp phẳng (1-level flat),
 * tự động tách và xếp thẳng hàng nếu có bất kỳ mục nào bị lồng vào nhau.
 */
export function flattenNestedTodos(root: HTMLElement): boolean {
  let changed = false;
  let nested = root.querySelector(".todo-item .todo-item") as HTMLElement | null;
  while (nested) {
    changed = true;
    let parentTodo: HTMLElement | null = nested.parentElement;
    while (parentTodo && !parentTodo.classList.contains("todo-item") && parentTodo !== root) {
      parentTodo = parentTodo.parentElement;
    }
    if (parentTodo && parentTodo.parentNode) {
      parentTodo.parentNode.insertBefore(nested, parentTodo.nextSibling);
    } else {
      break;
    }
    nested = root.querySelector(".todo-item .todo-item") as HTMLElement | null;
  }
  return changed;
}

export function useRichTextEditor({ onContentChange }: UseRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isUndoRedoActionRef = useRef<boolean>(false);
  const typingSessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [wordCount, setWordCount] = useState<number>(0);
  const [charCount, setCharCount] = useState<number>(0);
  const [floatingToolbarPos, setFloatingToolbarPos] = useState<{ x: number; y: number } | null>(null);

  const [activeFormats, setActiveFormats] = useState<ActiveFormats>({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    highlight: false,
    h1: false,
    h2: false,
    quote: false,
    code: false,
    todo: false,
    unorderedList: false,
    orderedList: false,
  });

  const updateCountsFromDom = useCallback((fallbackContent?: string) => {
    let cleanText = "";
    if (editorRef.current) {
      cleanText = (editorRef.current.innerText || "").trim();
    }
    if (!cleanText && fallbackContent) {
      cleanText = fallbackContent.replace(/<[^>]*>/g, " ").trim();
    }
    const words = cleanText ? cleanText.split(/\s+/).filter(Boolean).length : 0;
    const len = cleanText.length;
    setWordCount((prev) => (prev === words ? prev : words));
    setCharCount((prev) => (prev === len ? prev : len));
  }, []);

  const pushExplicitSnapshot = useCallback(() => {
    if (isUndoRedoActionRef.current || !editorRef.current) return;
    if (typingSessionTimeoutRef.current) clearTimeout(typingSessionTimeoutRef.current);
    const html = editorRef.current.innerHTML;
    const stack = undoStackRef.current;
    if (stack.length === 0 || stack[stack.length - 1] !== html) {
      stack.push(html);
      if (stack.length > 60) stack.shift();
      redoStackRef.current = [];
    }
  }, []);

  const recordTypingChange = useCallback((currentHtml: string) => {
    if (isUndoRedoActionRef.current) return;
    if (typingSessionTimeoutRef.current) clearTimeout(typingSessionTimeoutRef.current);
    typingSessionTimeoutRef.current = setTimeout(() => {
      const stack = undoStackRef.current;
      if (stack.length === 0 || stack[stack.length - 1] !== currentHtml) {
        stack.push(currentHtml);
        if (stack.length > 60) stack.shift();
        redoStackRef.current = [];
      }
    }, 450);
  }, []);

  const getHighlightElement = useCallback((selection: Selection | null): HTMLElement | null => {
    if (!selection || !editorRef.current) return null;
    let node: Node | null = selection.anchorNode;
    while (node && node !== editorRef.current) {
      if (node instanceof HTMLElement) {
        if (node.tagName === "MARK" || node.classList.contains("study-highlight")) {
          return node;
        }
        const bg = node.style.backgroundColor;
        if (
          bg &&
          (bg.includes("250, 204, 21") ||
            bg.includes("251, 191, 36") ||
            bg.includes("254, 240, 138") ||
            bg === "yellow")
        ) {
          return node;
        }
      }
      node = node.parentNode;
    }
    return null;
  }, []);

  const isSelectionHighlighted = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return false;
    return getHighlightElement(selection) !== null;
  }, [getHighlightElement]);

  const checkActiveFormats = useCallback(() => {
    try {
      let isInsideCode = false;
      let isInsideTodo = false;
      let block = "";
      try {
        block = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "");
      } catch {}

      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        let curr: Node | null = selection.anchorNode;
        while (curr && curr !== editorRef.current) {
          if (curr instanceof HTMLElement) {
            const tag = curr.tagName.toLowerCase();
            if (tag === "pre" || tag === "code") {
              isInsideCode = true;
            }
            if (curr.classList.contains("todo-item")) {
              isInsideTodo = true;
            }
            if (["h1", "h2", "blockquote"].includes(tag)) {
              block = tag;
            }
          }
          curr = curr.parentNode;
        }
      }

      setActiveFormats((prev) => {
        const next = {
          bold: document.queryCommandState("bold"),
          italic: document.queryCommandState("italic"),
          underline: document.queryCommandState("underline"),
          strikethrough: document.queryCommandState("strikeThrough"),
          highlight: isSelectionHighlighted(),
          h1: block === "h1",
          h2: block === "h2",
          quote: block === "blockquote",
          code: isInsideCode,
          todo: isInsideTodo,
          unorderedList: document.queryCommandState("insertUnorderedList"),
          orderedList: document.queryCommandState("insertOrderedList"),
        };
        if (
          prev.bold === next.bold &&
          prev.italic === next.italic &&
          prev.underline === next.underline &&
          prev.strikethrough === next.strikethrough &&
          prev.highlight === next.highlight &&
          prev.h1 === next.h1 &&
          prev.h2 === next.h2 &&
          prev.quote === next.quote &&
          prev.code === next.code &&
          prev.todo === next.todo &&
          prev.unorderedList === next.unorderedList &&
          prev.orderedList === next.orderedList
        ) {
          return prev;
        }
        return next;
      });
    } catch {}
  }, [isSelectionHighlighted]);

  const updateFloatingToolbar = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !editorRef.current) {
      setFloatingToolbarPos(null);
      return;
    }

    if (!editorRef.current.contains(selection.anchorNode) || !editorRef.current.contains(selection.focusNode)) {
      setFloatingToolbarPos(null);
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setFloatingToolbarPos(null);
      return;
    }

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setFloatingToolbarPos(null);
        return;
      }
      setFloatingToolbarPos({
        x: Math.max(30, rect.left + rect.width / 2),
        y: Math.max(20, rect.top - 46),
      });
    } catch {
      setFloatingToolbarPos(null);
    }
  }, []);

  const handleSelectionOrFormatChange = useCallback(() => {
    checkActiveFormats();
    updateFloatingToolbar();
  }, [checkActiveFormats, updateFloatingToolbar]);

  const triggerInputSave = useCallback(() => {
    if (!editorRef.current) return;
    if (!(editorRef.current.innerText || "").trim()) {
      editorRef.current.innerHTML = "";
    }
    const newHtml = editorRef.current.innerHTML;
    updateCountsFromDom();
    recordTypingChange(newHtml);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      onContentChange(newHtml);
    }, 350);
  }, [updateCountsFromDom, recordTypingChange, onContentChange]);

  const handleUndo = useCallback(() => {
    if (!editorRef.current) return;

    if (typingSessionTimeoutRef.current) {
      clearTimeout(typingSessionTimeoutRef.current);
    }

    const stack = undoStackRef.current;
    const currentHtml = editorRef.current.innerHTML;

    if (stack.length > 0 && stack[stack.length - 1] === currentHtml) {
      stack.pop();
    }

    if (stack.length === 0) {
      try {
        document.execCommand("undo");
      } catch {}
      return;
    }

    isUndoRedoActionRef.current = true;
    redoStackRef.current.push(currentHtml);

    const prevState = stack[stack.length - 1];
    editorRef.current.innerHTML = prevState || "<p><br></p>";
    updateCountsFromDom();
    onContentChange(prevState);

    setTimeout(() => {
      isUndoRedoActionRef.current = false;
      checkActiveFormats();
    }, 40);
  }, [updateCountsFromDom, onContentChange, checkActiveFormats]);

  const handleRedo = useCallback(() => {
    if (!editorRef.current) return;

    if (redoStackRef.current.length === 0) {
      try {
        document.execCommand("redo");
      } catch {}
      return;
    }

    isUndoRedoActionRef.current = true;
    const currentHtml = editorRef.current.innerHTML;
    undoStackRef.current.push(currentHtml);

    const nextState = redoStackRef.current.pop()!;
    editorRef.current.innerHTML = nextState;
    updateCountsFromDom();
    onContentChange(nextState);

    setTimeout(() => {
      isUndoRedoActionRef.current = false;
      checkActiveFormats();
    }, 40);
  }, [updateCountsFromDom, onContentChange, checkActiveFormats]);

  const execFormat = useCallback(
    (command: string, value: string | undefined = undefined) => {
      if (!editorRef.current) return;
      pushExplicitSnapshot();
      editorRef.current.focus();
      document.execCommand(command, false, value);
      checkActiveFormats();
      triggerInputSave();
    },
    [pushExplicitSnapshot, checkActiveFormats, triggerInputSave]
  );

  const toggleHeading = useCallback(
    (tag: "h1" | "h2" = "h2") => {
      if (!editorRef.current) return;
      pushExplicitSnapshot();
      editorRef.current.focus();
      let currentBlock = "";
      try {
        currentBlock = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "");
      } catch {}

      if (currentBlock === "h2" || currentBlock === "h1" || activeFormats.h1 || activeFormats.h2) {
        document.execCommand("formatBlock", false, "<p>");
      } else {
        document.execCommand("formatBlock", false, `<${tag}>`);
      }
      checkActiveFormats();
      triggerInputSave();
    },
    [pushExplicitSnapshot, activeFormats, checkActiveFormats, triggerInputSave]
  );

  const insertChecklist = useCallback(() => {
    if (!editorRef.current) return;
    pushExplicitSnapshot();
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    // Kiểm tra xem con trỏ có đang nằm trong một todo-item có sẵn không
    let existingTodo: HTMLElement | null = null;
    let currNode: Node | null = selection.anchorNode;
    while (currNode && currNode !== editorRef.current) {
      if (currNode instanceof HTMLElement && currNode.classList.contains("todo-item")) {
        existingTodo = currNode;
        break;
      }
      currNode = currNode.parentNode;
    }

    if (!selection.isCollapsed) {
      const selectedText = selection.toString();
      const lines = selectedText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length > 0) {
        const todosHtml = lines
          .map(
            (line) =>
              `<div class="todo-item"><input type="checkbox" class="todo-checkbox" /><span>${line}</span></div>`
          )
          .join("");
        document.execCommand("insertHTML", false, todosHtml + "<p><br></p>");
      } else {
        document.execCommand(
          "insertHTML",
          false,
          '<div class="todo-item"><input type="checkbox" class="todo-checkbox" /><span>Việc cần làm...</span></div><p><br></p>'
        );
      }
    } else {
      const todoDiv = document.createElement("div");
      todoDiv.className = "todo-item";
      todoDiv.innerHTML = '<input type="checkbox" class="todo-checkbox" /><span>Việc cần làm...</span>';

      if (existingTodo && existingTodo.parentNode) {
        // Nếu đang ở trong một todo-item, luôn chèn ngang hàng (sibling) ngay bên dưới, không lồng vào trong
        existingTodo.parentNode.insertBefore(todoDiv, existingTodo.nextSibling);
      } else {
        const nextP = document.createElement("p");
        nextP.innerHTML = "<br>";

        range.deleteContents();
        range.insertNode(nextP);
        range.insertNode(todoDiv);
      }

      const span = todoDiv.querySelector("span");
      if (span) {
        const newRange = document.createRange();
        newRange.selectNodeContents(span);
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
    }

    if (editorRef.current) {
      flattenNestedTodos(editorRef.current);
    }

    checkActiveFormats();
    triggerInputSave();
  }, [pushExplicitSnapshot, checkActiveFormats, triggerInputSave]);

  const insertCodeSnippet = useCallback(() => {
    if (!editorRef.current) return;
    pushExplicitSnapshot();
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);

    if (!selection.isCollapsed) {
      const selectedText = selection.toString();
      const escaped = selectedText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      let parentNode: Node | null = range.commonAncestorContainer;
      let existingCodeEl: HTMLElement | null = null;
      while (parentNode && parentNode !== editorRef.current) {
        if (
          parentNode instanceof HTMLElement &&
          (parentNode.tagName === "CODE" || parentNode.tagName === "PRE")
        ) {
          existingCodeEl = parentNode;
          break;
        }
        parentNode = parentNode.parentNode;
      }

      if (
        existingCodeEl &&
        existingCodeEl.tagName === "CODE" &&
        existingCodeEl.parentElement?.tagName !== "PRE"
      ) {
        const textNode = document.createTextNode(existingCodeEl.textContent || "");
        existingCodeEl.parentNode?.replaceChild(textNode, existingCodeEl);
      } else if (!selectedText.includes("\n")) {
        document.execCommand("insertHTML", false, `<code>${escaped}</code>`);
      } else {
        const codeHtml = `<pre><code>${escaped}</code></pre><p><br></p>`;
        document.execCommand("insertHTML", false, codeHtml);
      }
    } else {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = "// Nhập mã nguồn tại đây...";
      pre.appendChild(code);

      const nextP = document.createElement("p");
      nextP.innerHTML = "<br>";

      range.deleteContents();
      range.insertNode(nextP);
      range.insertNode(pre);

      const newRange = document.createRange();
      newRange.selectNodeContents(code);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }

    checkActiveFormats();
    triggerInputSave();
  }, [pushExplicitSnapshot, checkActiveFormats, triggerInputSave]);

  const toggleHighlight = useCallback(() => {
    if (!editorRef.current) return;
    pushExplicitSnapshot();
    editorRef.current.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const existingHighlight = getHighlightElement(selection);

    if (existingHighlight) {
      const parent = existingHighlight.parentNode;
      if (parent) {
        while (existingHighlight.firstChild) {
          parent.insertBefore(existingHighlight.firstChild, existingHighlight);
        }
        parent.removeChild(existingHighlight);
        parent.normalize();
      }
    } else {
      const range = selection.getRangeAt(0);
      if (selection.isCollapsed) {
        const mark = document.createElement("mark");
        mark.className = "study-highlight";
        mark.textContent = "\u200B";
        range.insertNode(mark);

        const newRange = document.createRange();
        newRange.selectNodeContents(mark);
        newRange.collapse(false);
        selection.removeAllRanges();
        selection.addRange(newRange);
      } else {
        try {
          const mark = document.createElement("mark");
          mark.className = "study-highlight";
          const fragment = range.extractContents();
          mark.appendChild(fragment);
          range.insertNode(mark);

          const newRange = document.createRange();
          newRange.selectNodeContents(mark);
          selection.removeAllRanges();
          selection.addRange(newRange);
        } catch {
          document.execCommand("hiliteColor", false, "rgba(250, 204, 21, 0.35)");
        }
      }
    }

    checkActiveFormats();
    triggerInputSave();
  }, [pushExplicitSnapshot, getHighlightElement, checkActiveFormats, triggerInputSave]);

  const toggleQuote = useCallback(() => {
    if (!editorRef.current) return;
    pushExplicitSnapshot();
    editorRef.current.focus();
    let currentBlock = "";
    try {
      currentBlock = (document.queryCommandValue("formatBlock") || "").toLowerCase().replace(/[<>]/g, "");
    } catch {}

    if (currentBlock === "blockquote" || activeFormats.quote) {
      document.execCommand("formatBlock", false, "<p>");
    } else {
      document.execCommand("formatBlock", false, "<blockquote>");
    }
    checkActiveFormats();
    triggerInputSave();
  }, [pushExplicitSnapshot, activeFormats.quote, checkActiveFormats, triggerInputSave]);


  const handleEditorClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        pushExplicitSnapshot();
        if (target.checked) {
          target.setAttribute("checked", "true");
          const sibling = target.nextElementSibling;
          if (sibling) sibling.classList.add("todo-checked-text");
        } else {
          target.removeAttribute("checked");
          const sibling = target.nextElementSibling;
          if (sibling) sibling.classList.remove("todo-checked-text");
        }
        triggerInputSave();
      }
    },
    [pushExplicitSnapshot, triggerInputSave]
  );

  const handleEditorKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if (isCtrlOrCmd && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      const selection = window.getSelection();
      if (!selection || !selection.anchorNode) return;

      let node: Node | null = selection.anchorNode;
      let todoItem: HTMLElement | null = null;
      let preBlock: HTMLElement | null = null;

      while (node && node !== editorRef.current) {
        if (node instanceof HTMLElement) {
          if (node.classList.contains("todo-item")) {
            todoItem = node;
          }
          if (node.tagName === "PRE") {
            preBlock = node;
          }
        }
        node = node.parentNode;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        // Checklist luôn ở 1 cấp phẳng duy nhất: chặn phím Tab làm thụt lề lệch hàng
        if (todoItem) {
          return;
        }
        pushExplicitSnapshot();
        let isInsideList = false;
        let checkNode: Node | null = selection.anchorNode;
        while (checkNode && checkNode !== editorRef.current) {
          if (checkNode instanceof HTMLElement && checkNode.tagName === "LI") {
            isInsideList = true;
            break;
          }
          checkNode = checkNode.parentNode;
        }

        if (isInsideList) {
          if (e.shiftKey) {
            document.execCommand("outdent");
          } else {
            document.execCommand("indent");
          }
        } else {
          document.execCommand("insertText", false, "  ");
        }
        triggerInputSave();
        return;
      }

      if (preBlock) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          pushExplicitSnapshot();
          const nextP = document.createElement("p");
          nextP.innerHTML = "<br>";
          preBlock.parentNode?.insertBefore(nextP, preBlock.nextSibling);

          const newRange = document.createRange();
          newRange.selectNodeContents(nextP);
          newRange.collapse(false);
          selection.removeAllRanges();
          selection.addRange(newRange);
          triggerInputSave();
          return;
        }
      }

      if (todoItem) {
        if (e.key === "Enter" && !e.shiftKey) {
          const text = todoItem.innerText.trim();
          if (!text || text === "Việc cần làm...") {
            e.preventDefault();
            pushExplicitSnapshot();
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            todoItem.parentNode?.replaceChild(p, todoItem);

            const range = document.createRange();
            range.selectNodeContents(p);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            triggerInputSave();
            return;
          } else {
            e.preventDefault();
            pushExplicitSnapshot();
            const nextTodo = document.createElement("div");
            nextTodo.className = "todo-item";
            nextTodo.innerHTML = '<input type="checkbox" class="todo-checkbox" /><span>&nbsp;</span>';

            // Tìm node ngoài cùng nếu có lồng thẻ để luôn chèn ngang hàng 1 level
            let insertTarget: HTMLElement = todoItem;
            while (insertTarget.parentElement && insertTarget.parentElement.classList.contains("todo-item")) {
              insertTarget = insertTarget.parentElement;
            }
            insertTarget.parentNode?.insertBefore(nextTodo, insertTarget.nextSibling);

            const span = nextTodo.querySelector("span");
            if (span) {
              const range = document.createRange();
              range.selectNodeContents(span);
              range.collapse(false);
              selection.removeAllRanges();
              selection.addRange(range);
            }
            if (editorRef.current) {
              flattenNestedTodos(editorRef.current);
            }
            triggerInputSave();
            return;
          }
        }

        if (e.key === "Backspace") {
          const text = todoItem.innerText.trim();
          if (!text || text === "Việc cần làm...") {
            e.preventDefault();
            pushExplicitSnapshot();
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            todoItem.parentNode?.replaceChild(p, todoItem);

            const range = document.createRange();
            range.selectNodeContents(p);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
            triggerInputSave();
            return;
          }
        }
      }
    },
    [handleRedo, handleUndo, pushExplicitSnapshot, triggerInputSave]
  );

  // Dán vào là lọc sạch ngay: có HTML lạ (Word/trang web) thì giữ chữ +
  // định dạng cơ bản; không có HTML mà chữ là markdown (copy từ chatbot)
  // thì đổi sang định dạng rồi mới dán; chữ thường thì để trình duyệt dán.
  const handleEditorPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const html = e.clipboardData?.getData("text/html");
      const plain = e.clipboardData?.getData("text/plain") ?? "";
      if ((!html && looksLikeMarkdown(plain)) && editorRef.current) {
        e.preventDefault();
        pushExplicitSnapshot();
        editorRef.current.focus();
        try {
          document.execCommand("insertHTML", false, sanitizeRichHtml(markdownToHtml(plain)));
        } catch {
          document.execCommand("insertText", false, plain);
        }
        triggerInputSave();
        return;
      }
      if (!html || !editorRef.current) return;
      e.preventDefault();
      pushExplicitSnapshot();
      editorRef.current.focus();
      try {
        document.execCommand("insertHTML", false, sanitizeRichHtml(html));
      } catch {
        document.execCommand("insertText", false, e.clipboardData?.getData("text/plain") ?? "");
      }
      triggerInputSave();
    },
    [pushExplicitSnapshot, triggerInputSave]
  );

  return {
    editorRef,
    undoStackRef,
    redoStackRef,
    wordCount,
    charCount,
    floatingToolbarPos,
    activeFormats,
    updateCountsFromDom,
    pushExplicitSnapshot,
    handleUndo,
    handleRedo,
    execFormat,
    toggleHeading,
    insertChecklist,
    insertCodeSnippet,
    toggleHighlight,
    toggleQuote,
    handleEditorClick,
    handleEditorKeyDown,
    handleEditorPaste,
    handleSelectionOrFormatChange,
    triggerInputSave,
  };
}
