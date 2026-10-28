-- ZenStudy — Kho dữ liệu D1 Tinh Gọn (zenspace)
-- Chỉ gồm 4 bảng:
-- 1. user_data       : Kho dữ liệu học tập cá nhân (Snapshot Save Game cho data-api)
-- 2. chat_usage      : Sổ đếm câu chat theo ngày của từng học sinh (30 câu/ngày cho chat-proxy)
-- 3. admin_audit     : Nhật ký hành động admin (ai, làm gì, lúc nào) cho Worker zenstudy-admin
-- 4. admin_error_log : Lỗi cuối của chat-proxy và lỗi D1/cấu hình của Worker admin (giữ 14 ngày)
-- Lượt gọi/neurons Workers AI không lưu ở đây; xem số thật trên Cloudflare Dashboard.
-- Đây là script cài mới: đầu file có DROP TABLE. DB đang chạy thì dán riêng phần bảng cần thêm.

-- 1. XÓA SẠCH CÁC BẢNG DƯ THỪA
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS focus_sessions;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS chat_sessions;
DROP TABLE IF EXISTS chat_messages;
-- Bộ đếm neurons cũ: đã bỏ để tránh số liệu sai.
DROP TABLE IF EXISTS cf_usage;

-- 2. BẢNG DỮ LIỆU HỌC TẬP (SNAPSHOT CLOUD SAVE)
CREATE TABLE IF NOT EXISTS user_data (
  uid        TEXT PRIMARY KEY,
  data_json  TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_data_updated ON user_data (updated_at);

-- 3. BẢNG ĐẾM CÂU CHAT THEO NGÀY (GIỚI HẠN 30 CÂU/NGÀY)
CREATE TABLE IF NOT EXISTS chat_usage (
  uid   TEXT NOT NULL,
  day   TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (uid, day)
);
CREATE INDEX IF NOT EXISTS idx_chat_usage_day_count ON chat_usage (day, count DESC);

-- 4. NHẬT KÝ HÀNH ĐỘNG ADMIN (Worker zenstudy-admin)
CREATE TABLE IF NOT EXISTS admin_audit (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email  TEXT NOT NULL,
  action       TEXT NOT NULL,
  target       TEXT,
  detail_json  TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit (created_at);

-- 5. NHẬT KÝ LỖI CUỐI (chat-proxy + Worker zenstudy-admin)
-- created_at là mili giây. Xóa bản ghi quá 14 ngày ở lần ghi kế tiếp.
CREATE TABLE IF NOT EXISTS admin_error_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  source     TEXT NOT NULL,
  code       TEXT NOT NULL,
  message    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_error_log_created ON admin_error_log (created_at);

-- 6. BẢN PHÁT HÀNH NỘI DUNG (cảnh / âm thanh / nhạc) — P2c
-- Mỗi lần lưu là một version mới gồm đủ 3 dòng (kind = scenes | sounds | tracks).
-- Lịch sử chỉ được thêm; quay lại bản cũ = ghi tiếp một version mới cùng nội dung.
CREATE TABLE IF NOT EXISTS content_manifest (
  version    INTEGER NOT NULL,
  kind       TEXT NOT NULL,
  json       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  PRIMARY KEY (version, kind)
);
CREATE INDEX IF NOT EXISTS idx_content_manifest_created ON content_manifest (created_at DESC);
