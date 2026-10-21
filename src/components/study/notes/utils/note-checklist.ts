// Đếm số việc cần làm trong HTML ghi chú mà không cần DOM (an toàn khi render trên server).
// Một mục được coi là xong khi thẻ input có thuộc tính checked, đúng với dữ liệu editor lưu.
export function parseNoteChecklistStats(html: string): { total: number; done: number } {
  if (!html) return { total: 0, done: 0 };

  const checkboxTags = html.match(/<input\b[^>]*\btype=["']checkbox["'][^>]*>/gi) || [];
  const done = checkboxTags.filter((tag) => /(^|\s)checked(?=[\s=>/])/i.test(tag)).length;

  return { total: checkboxTags.length, done };
}
