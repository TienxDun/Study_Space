-- ZenStudy — Kho dữ liệu D1 Tinh Gọn (zenspace)
-- Chỉ gồm đúng 3 bảng duy nhất:
-- 1. user_data   : Kho dữ liệu học tập cá nhân (Snapshot Save Game cho data-api)
-- 2. chat_usage  : Sổ đếm câu chat theo ngày của từng học sinh (30 câu/ngày cho chat-proxy)
-- 3. admin_audit : Nhật ký hành động admin (ai, làm gì, lúc nào) cho Worker zenstudy-admin
-- Lượt gọi/neurons Workers AI không lưu ở đây; xem số thật trên Cloudflare Dashboard.

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
