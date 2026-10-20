// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";
import {
  hasStoredUserData,
  shouldWipeKey,
  CLOUD_BOOT_PREFIX,
  CLOUD_META_KEY,
  CLOUD_UID_KEY,
} from "@/lib/local-data";
import { STORAGE_KEYS } from "@/lib/storage-keys";

describe("shouldWipeKey", () => {
  it("xóa mọi key dữ liệu học tập", () => {
    for (const key of Object.values(STORAGE_KEYS)) {
      expect(shouldWipeKey(key), key).toBe(true);
    }
  });

  it("xóa key đồng bộ, uid tài khoản và cờ khởi động", () => {
    expect(shouldWipeKey(CLOUD_META_KEY)).toBe(true);
    expect(shouldWipeKey(CLOUD_UID_KEY)).toBe(true);
    expect(shouldWipeKey(`${CLOUD_BOOT_PREFIX}abc`)).toBe(true);
  });

  it("xóa các key động theo UID (lastSyncedAt, focusEpoch, pendingFocusQueue, backups)", () => {
    const testUid = "user-1234-xyz";
    expect(shouldWipeKey(`${STORAGE_KEYS.lastSyncedAt}_${testUid}`)).toBe(true);
    expect(shouldWipeKey(`${STORAGE_KEYS.focusEpoch}_${testUid}`)).toBe(true);
    expect(shouldWipeKey(`${STORAGE_KEYS.pendingFocusQueue}_${testUid}`)).toBe(true);
    expect(shouldWipeKey("study_space_backup_multiNotes_1670000000")).toBe(true);
  });

  it("xóa cache chat của mọi tài khoản", () => {
    expect(shouldWipeKey("chat-msgs:uid1:sess1")).toBe(true);
    expect(shouldWipeKey("chat-remember:uid1")).toBe(true);
  });

  it("giữ nguyên key của trang khác", () => {
    expect(shouldWipeKey("some-other-site-token")).toBe(false);
    expect(shouldWipeKey("")).toBe(false);
  });
});

describe("hasStoredUserData", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("báo không có dữ liệu khi máy trống", () => {
    expect(hasStoredUserData()).toBe(false);
  });

  it("phát hiện ghi chú còn trên máy", () => {
    localStorage.setItem(STORAGE_KEYS.multiNotes, "[]");
    expect(hasStoredUserData()).toBe(true);
  });

  it("bỏ qua key không liên quan", () => {
    localStorage.setItem("unrelated", "1");
    expect(hasStoredUserData()).toBe(false);
  });
});
