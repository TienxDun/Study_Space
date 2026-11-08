"use client";

import { toast } from "sonner";

const isQuotaError = (e: unknown): boolean =>
  typeof DOMException !== "undefined" &&
  e instanceof DOMException &&
  (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED");

/**
 * Ghi localStorage an toàn: đầy bộ nhớ thì báo 1 lần (không spam),
 * trả false để nơi gọi khỏi báo "Đã lưu" oan.
 */
export function saveStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    if (isQuotaError(e)) {
      toast.error("Bộ nhớ máy đầy, chưa lưu được", {
        id: "storage-quota-full",
        description: "Xóa bớt ghi chú/dữ liệu cũ rồi thử lại để khỏi mất bài.",
        duration: 6000,
      });
    }
    return false;
  }
}

export function saveStorageJSON(key: string, value: unknown): boolean {
  let raw: string;
  try {
    raw = JSON.stringify(value);
  } catch {
    return false;
  }
  return saveStorage(key, raw);
}

/**
 * Đọc localStorage an toàn: tự bắt lỗi JSON và trả về fallback nếu rỗng hoặc lỗi cú pháp
 */
export function loadStorageJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

