export function getCleanExportText(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  const todoItems = clone.querySelectorAll(".todo-item");
  todoItems.forEach((item) => {
    const checkbox = item.querySelector<HTMLInputElement>("input[type='checkbox']");
    const isChecked = checkbox?.checked || checkbox?.getAttribute("checked") === "true";
    const prefix = isChecked ? "- [x] " : "- [ ] ";
    const span = item.querySelector("span");
    const text = (span?.innerText || item.textContent || "").trim();
    const p = document.createElement("p");
    p.textContent = prefix + text;
    item.parentNode?.replaceChild(p, item);
  });
  return clone.innerText || "";
}

export function downloadNoteAsTxt(title: string, rawText: string): void {
  const blob = new Blob([`${title}\n\n${rawText}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeTitle = (title || "ghi_chu").replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, "_");
  a.download = `${safeTitle}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadNoteAsMd(title: string, rawText: string): void {
  const blob = new Blob([`# ${title}\n\n${rawText}`], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeTitle = (title || "ghi_chu").replace(/[^a-zA-Z0-9_\u00C0-\u1EF9]/g, "_");
  a.download = `${safeTitle}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
