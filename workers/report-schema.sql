-- P0.5 — bảng báo cáo nội dung, chặn người dùng, hạn chế tài khoản.
-- Dán vào D1 `zenspace` đang chạy:
--   npx wrangler d1 execute zenspace --remote --file=workers/report-schema.sql
-- Không có DROP: chỉ thêm bảng mới, không đụng bảng cũ.

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

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_uid TEXT NOT NULL,
  blocked_uid TEXT NOT NULL,
  blocked_name TEXT,                         -- tên hiển thị lúc chặn
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (blocker_uid, blocked_uid)
);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_uid);

CREATE TABLE IF NOT EXISTS user_restrictions (
  uid            TEXT PRIMARY KEY,
  ai_disabled    INTEGER NOT NULL DEFAULT 0,
  rooms_disabled INTEGER NOT NULL DEFAULT 0,
  note           TEXT,
  updated_at     INTEGER NOT NULL,
  updated_by     TEXT
);
