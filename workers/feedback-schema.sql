-- P3.16 — góp ý/báo lỗi chung do người dùng gửi trong app.
-- Dán vào D1 `zenspace` đang chạy:
--   npx wrangler d1 execute zenspace --remote --file=workers/feedback-schema.sql
-- Không có DROP: chỉ thêm bảng mới, không đụng bảng cũ.

CREATE TABLE IF NOT EXISTS user_feedback (
  id              TEXT PRIMARY KEY,
  uid             TEXT NOT NULL,
  name            TEXT,                        -- tên hiển thị lúc gửi, admin đọc thay UID
  kind            TEXT NOT NULL,               -- 'bug' | 'idea' | 'other'
  message         TEXT NOT NULL,
  contact         TEXT,                        -- liên hệ người dùng tự nguyện nhập
  app_version     TEXT,
  platform        TEXT,                        -- 'web' | 'android'
  viewport        TEXT,                        -- vd '1280x800', để đoán lỗi giao diện
  locale          TEXT,
  image_key       TEXT,                        -- khóa ảnh đính kèm trong R2 (feedback/...), null nếu không có
  status          TEXT NOT NULL DEFAULT 'open', -- open | resolved | dismissed
  created_at      INTEGER NOT NULL,
  resolved_at     INTEGER,
  resolved_by     TEXT,
  resolution_note TEXT
);
CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON user_feedback (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_uid_created ON user_feedback (uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON user_feedback (created_at);
