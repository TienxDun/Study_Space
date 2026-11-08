import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Giới hạn giá trị nằm trong khoảng an toàn [min, max]
 */
export function clamp(val: number, min: number, max: number): number {
  if (isNaN(val)) return min;
  return Math.max(min, Math.min(max, val));
}

/**
 * Tạo mã định danh ngẫu nhiên kèm tiền tố tùy chọn
 */
export function generateId(prefix = ""): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const now = Date.now().toString(36);
  return prefix ? `${prefix}-${now}-${rand}` : `${now}-${rand}`;
}

