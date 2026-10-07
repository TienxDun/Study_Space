import { StudyEmbedItem } from "../types";
import { MIN_SPLIT_RATIO, MAX_SPLIT_RATIO, DEFAULT_SPLIT_RATIO } from "../constants";

/**
 * Kẹp tỷ lệ chia cột Studio trong giới hạn hợp lý [MIN, MAX]
 */
export function clampSplitRatio(val: number): number {
  if (isNaN(val)) return DEFAULT_SPLIT_RATIO;
  const rounded = Math.round(val * 10) / 10;
  return Math.max(MIN_SPLIT_RATIO, Math.min(MAX_SPLIT_RATIO, rounded));
}

/**
 * Lọc danh sách đài phát theo từ khóa và danh mục
 */
export function filterEmbedItems(
  items: StudyEmbedItem[],
  query: string,
  category: string
): StudyEmbedItem[] {
  const normalizedQuery = query.toLowerCase().trim();

  return items.filter((item) => {
    const matchesSearch = normalizedQuery
      ? item.title.toLowerCase().includes(normalizedQuery) ||
        (item.category && item.category.toLowerCase().includes(normalizedQuery)) ||
        item.url.toLowerCase().includes(normalizedQuery)
      : true;

    if (!matchesSearch) return false;

    if (category === "all" || category === "saved") return true;
    if (category === "youtube") return item.platform === "youtube";
    if (category === "spotify") return item.platform === "spotify";
    return item.category === category;
  });
}
