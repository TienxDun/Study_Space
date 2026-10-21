import { describe, expect, it } from "vitest";
import { parseNoteChecklistStats } from "@/components/study/notes/utils/note-checklist";

describe("parseNoteChecklistStats", () => {
  it("trả về 0/0 với nội dung rỗng", () => {
    expect(parseNoteChecklistStats("")).toEqual({ total: 0, done: 0 });
  });

  it("đếm đúng số mục đã xong từ checked=\"true\"", () => {
    const html = [
      '<div class="todo-item"><input type="checkbox" checked="true" class="todo-checkbox" /><span class="todo-checked-text">Việc 1</span></div>',
      '<div class="todo-item"><input type="checkbox" class="todo-checkbox" /><span>Việc 2</span></div>',
      '<div class="todo-item"><input type="checkbox" checked="true" class="todo-checkbox" /><span class="todo-checked-text">Việc 3</span></div>',
      '<div class="todo-item"><input type="checkbox" class="todo-checkbox" /><span>Việc 4</span></div>',
    ].join("");

    expect(parseNoteChecklistStats(html)).toEqual({ total: 4, done: 2 });
  });

  it("nhận diện thuộc tính checked dạng boolean", () => {
    const html =
      '<div class="todo-item"><input checked type="checkbox" class="todo-checkbox" /><span>Việc</span></div>';

    expect(parseNoteChecklistStats(html)).toEqual({ total: 1, done: 1 });
  });

  it("không nhầm data-checked với checked", () => {
    const html =
      '<div class="todo-item"><input type="checkbox" data-checked="true" class="todo-checkbox" /><span>Việc</span></div>';

    expect(parseNoteChecklistStats(html)).toEqual({ total: 1, done: 0 });
  });

  it("bỏ qua input không phải checkbox", () => {
    const html = '<input type="text" checked="true" /><input type="checkbox" checked="true" />';

    expect(parseNoteChecklistStats(html)).toEqual({ total: 1, done: 1 });
  });
});
