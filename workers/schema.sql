-- ZenStudy — Kho dữ liệu D1 Tinh Gọn (zenspace)
-- Chỉ gồm 5 bảng:
-- 1. user_data       : Kho dữ liệu học tập cá nhân (Snapshot Save Game cho data-api)
-- 2. chat_usage      : Sổ đếm câu chat theo ngày của từng học sinh (30 câu/ngày cho chat-proxy)
-- 3. admin_audit     : Nhật ký hành động admin (ai, làm gì, lúc nào) cho Worker zenstudy-admin
-- 4. admin_error_log : Lỗi cuối của chat-proxy và lỗi D1/cấu hình của Worker admin (giữ 14 ngày)
-- 5. deleted_accounts: UID đã xoá tài khoản — chặn thiết bị còn token cũ đẩy dữ liệu trở lại
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

-- 3b. UID ĐÃ XOÁ TÀI KHOẢN
-- DELETE /account ghi vào đây; GET/POST /data trả 403 cho UID nằm trong bảng.
-- Tài khoản Google đăng nhập lại sẽ nhận UID mới nên không bị chặn nhầm.
CREATE TABLE IF NOT EXISTS deleted_accounts (
  uid        TEXT PRIMARY KEY,
  deleted_at INTEGER NOT NULL
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

-- 7. BÁO CÁO NỘI DUNG & CHẶN NGƯỜI DÙNG (P0.5 — chính sách AI/UGC của Google Play)
-- Báo cáo AI/phòng học do người dùng gửi qua data-api; admin xử lý qua admin-worker.
-- Giữ 180 ngày, dọn ở lần đọc/ghi kế tiếp.
CREATE TABLE IF NOT EXISTS content_reports (
  id              TEXT PRIMARY KEY,
  source          TEXT NOT NULL,              -- 'ai' | 'room'
  reporter_uid    TEXT NOT NULL,
  target_uid      TEXT,
  room            TEXT,
  session_id      TEXT,
  message_id      TEXT,
  question        TEXT,                        -- câu hỏi dẫn tới câu trả lời AI
  content         TEXT,
  reason          TEXT NOT NULL,
  detail          TEXT,
  status          TEXT NOT NULL DEFAULT 'open', -- open | resolved | dismissed
  created_at      INTEGER NOT NULL,
  resolved_at     INTEGER,
  resolved_by     TEXT,
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_created ON content_reports (reporter_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_target ON content_reports (target_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_created ON content_reports (created_at);

-- Chặn 2 chiều: mỗi dòng là một chiều. Server chặn việc vào chung phòng.
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_uid TEXT NOT NULL,
  blocked_uid TEXT NOT NULL,
  blocked_name TEXT,                         -- tên hiển thị lúc chặn
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (blocker_uid, blocked_uid)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_uid);

-- Hạn chế do admin đặt sau khi xử lý báo cáo.
CREATE TABLE IF NOT EXISTS user_restrictions (
  uid            TEXT PRIMARY KEY,
  ai_disabled    INTEGER NOT NULL DEFAULT 0,
  rooms_disabled INTEGER NOT NULL DEFAULT 0,
  note           TEXT,
  updated_at     INTEGER NOT NULL,
  updated_by     TEXT
);
